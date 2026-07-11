import {
  type Registry,
  type Entity,
  type Material,
  type GltfCache,
  type TextureCache,
  type LocalTransform,
  type RuntimeScene,
  type MeshDrawPart,
  type BoneAttachment,
  type Collider,
  createInterleavedMesh,
  createSkinnedMesh,
  createSkinInstance,
  destroyMesh,
  createTransform,
  createLocalTransform,
  createChildOf,
  createChildren,
  addChildId,
  removeChildId,
  buildRuntimeScene,
  buildGltfMaterials,
  updateWorldFromLocals,
  createSkeletalModel,
  createMeshDraws,
  createAnimationClip,
  createAnimationClipMap,
  createAnimationStateMachine,
  createCharacterController,
  createBoneAttachment,
  createAttachmentOffset,
  bakeColliderWorldFromLocal,
  m4FromTRS,
  m4FromTRSQuat,
  m4Mul,
  m4,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import {
  type ActorDocument,
  type ActorDocumentAttachment,
  type ActorDocumentCharacter,
  type ActorDocumentCollider,
} from '../../catalog/actors/actorDocument.ts';
import { createConstructActorRoot } from './actorRoot.ts';
import { createConstructActorOriginMarker } from './actorOriginMarker.ts';
import { createConstructActorCharacter } from './actorCharacter.ts';
import { createConstructActorAttachment } from './actorAttachment.ts';
import { createConstructActorCollider } from './actorCollider.ts';
import { createConstructSkeletonOverlay } from './skeletonOverlay.ts';
import { createConstructPropPart } from '../propEditor/propPart.ts';
import { createConstructColliderWireframe } from '../propEditor/colliderWireframe.ts';
import { createColliderShapeResources } from '../propEditor/spawnPropEditor.ts';
import { createBoxMesh } from '../gizmos/meshes.ts';

const JOINT_RADIUS = 0.025;
const BONE_HALF_X = 0.008;
const BONE_HALF_Z = 0.008;

const applyTextureToMaterials = (
  materials: Material[],
  tex: WebGLTexture | null,
  defaultTex: WebGLTexture | null,
) => {
  const next = tex ?? defaultTex;

  for (const mat of materials) {
    if (next) mat.baseColorTex = next;
  }
};

const applyPlaceholderMaterials = (materials: Material[]) => {
  for (const mat of materials) {
    mat.baseColorFactor[3] = 0.4;
    mat.alphaMode = 'BLEND';
  }
};

const buildUvSphere = (radius: number, rings: number, segments: number) => {
  const rr = Math.max(3, rings);
  const ss = Math.max(3, segments);
  const vertexCount = (rr + 1) * (ss + 1);
  const v = new Float32Array(vertexCount * 8);
  let vi = 0;

  for (let r = 0; r <= rr; r++) {
    const vFrac = r / rr;
    const phi = vFrac * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let s = 0; s <= ss; s++) {
      const uFrac = s / ss;
      const theta = uFrac * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const nx = cosTheta * sinPhi;
      const ny = cosPhi;
      const nz = sinTheta * sinPhi;
      v[vi++] = nx * radius;
      v[vi++] = ny * radius;
      v[vi++] = nz * radius;
      v[vi++] = nx;
      v[vi++] = ny;
      v[vi++] = nz;
      v[vi++] = uFrac;
      v[vi++] = 1 - vFrac;
    }
  }

  const idx = new Uint32Array(rr * ss * 6);
  let ii = 0;

  for (let r = 0; r < rr; r++) {
    for (let s = 0; s < ss; s++) {
      const a = r * (ss + 1) + s;
      const b = a + ss + 1;
      const c = b + 1;
      const d = a + 1;
      idx[ii++] = a;
      idx[ii++] = b;
      idx[ii++] = d;
      idx[ii++] = d;
      idx[ii++] = b;
      idx[ii++] = c;
    }
  }

  return { v, idx };
};

const buildConstructMeshDraws = (
  gl: WebGL2RenderingContext,
  bodyScene: RuntimeScene,
  mats: Material[],
) => {
  const parts: MeshDrawPart[] = [];
  const nameToBody = new Map<string, number>();

  for (let i = 0; i < bodyScene.nodes.length; i++) nameToBody.set(bodyScene.nodes[i]!.name, i);

  for (const pair of bodyScene.meshNodePairs) {
    const model = bodyScene.models[pair.meshIndex];
    if (!model) continue;

    let skinInst = null as ReturnType<typeof createSkinInstance> | null;

    if (pair.skinIndex >= 0) {
      const srcSkin = bodyScene.skins[pair.skinIndex];
      if (!srcSkin) continue;

      const remappedJoints: number[] = [];

      for (const jNode of srcSkin.joints) {
        const jName = bodyScene.nodes[jNode]?.name;
        remappedJoints.push(jName ? (nameToBody.get(jName) ?? 0) : 0);
      }

      const fakeScene = {
        ...bodyScene,
        nodes: bodyScene.nodes,
        skins: [{ ...srcSkin, joints: remappedJoints }],
      } as RuntimeScene;
      skinInst = createSkinInstance(fakeScene, 0, pair.nodeIndex);
    }

    for (const prim of model.primitives) {
      const material =
        prim.materialIndex >= 0 && prim.materialIndex < mats.length
          ? mats[prim.materialIndex]!
          : mats[0]!;

      if (prim.kind === 'skinned' && skinInst) {
        const mesh = createSkinnedMesh(
          gl,
          prim.vertices,
          prim.joints,
          prim.weights,
          prim.indices,
          skinInst.jointCount,
        );
        parts.push({ mesh, material, gltfNodeIndex: pair.nodeIndex, skin: skinInst });
        continue;
      }

      const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
      parts.push({ mesh, material, gltfNodeIndex: pair.nodeIndex });
    }
  }

  return createMeshDraws(parts);
};

const findBoneNodeIndex = (nodes: RuntimeScene['nodes'], boneName: string): number => {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]!.name === boneName) return i;
  }

  throw new Error(`Missing bone '${boneName}' on character rig`);
};

const bakeChildWorld = (
  parentT: ReturnType<typeof createTransform>,
  childT: ReturnType<typeof createTransform>,
  local: LocalTransform,
) => {
  const localM = m4();
  m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
  m4Mul(childT.world, parentT.world, localM);
  childT.dirty = false;
};

const applyAttachmentLocal = (
  local: LocalTransform,
  part: {
    position: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
  },
) => {
  local.position[0] = part.position[0];
  local.position[1] = part.position[1];
  local.position[2] = part.position[2];
  local.rotation[0] = part.rotation[0];
  local.rotation[1] = part.rotation[1];
  local.rotation[2] = part.rotation[2];
  local.rotation[3] = part.rotation[3];
  local.scale[0] = part.scale[0];
  local.scale[1] = part.scale[1];
  local.scale[2] = part.scale[2];
};

export const syncAttachmentOffsetFromLocal = (entity: Entity) => {
  const local = entity.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  const boneAtt = entity.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
  if (!local || !boneAtt) return;

  const next = createAttachmentOffset(
    [local.position[0], local.position[1], local.position[2]],
    [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
    [local.scale[0], local.scale[1], local.scale[2]],
  );
  boneAtt.localOffset.set(next);
};

export const clearActorEditorEntities = (registry: Registry) => {
  const ids = new Set<number>();

  for (const e of registry.view(CONSTRUCT_KEYS.actorAttachment)) ids.add(e.id);
  for (const e of registry.view(CONSTRUCT_KEYS.actorCollider)) ids.add(e.id);
  for (const e of registry.view(CONSTRUCT_KEYS.skeletonOverlay)) ids.add(e.id);

  for (const e of registry.view(CONSTRUCT_KEYS.actorCharacter)) {
    ids.add(e.id);
    const children = e.components[COMPONENT_KEYS.children] as { ids: number[] } | undefined;
    if (children) for (const id of children.ids) ids.add(id);
  }

  for (const e of registry.view(CONSTRUCT_KEYS.actorOriginMarker)) ids.add(e.id);
  for (const e of registry.view(CONSTRUCT_KEYS.actorRoot)) ids.add(e.id);

  for (const id of ids) registry.deregister(id);
};

export const ensureActorRoot = (registry: Registry, doc: ActorDocument) => {
  const existing = registry.view(CONSTRUCT_KEYS.actorRoot)[0];
  if (existing) {
    const root = existing.components[CONSTRUCT_KEYS.actorRoot] as { documentId: string } | undefined;
    if (root) root.documentId = doc.id;
    return existing.id;
  }

  const root = registry.createBare();
  const t = createTransform();
  m4FromTRS(t.world, t.position, t.yaw, t.scale);
  t.dirty = false;
  root.components[COMPONENT_KEYS.transform] = t;
  root.components[COMPONENT_KEYS.children] = createChildren();
  root.components[CONSTRUCT_KEYS.actorRoot] = createConstructActorRoot(doc.id);
  registry.register(root);
  return root.id;
};

export const ensureActorOriginMarker = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  rootId: number,
) => {
  if (registry.view(CONSTRUCT_KEYS.actorOriginMarker)[0]) return;

  const root = registry.get(rootId);
  if (!root) return;

  const rootT = root.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;
  const children = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;
  const marker = createConstructActorOriginMarker();
  const mesh = createBoxMesh(gl, marker.halfExtent, marker.halfExtent, marker.halfExtent);
  const material: Material = {
    name: 'actor-origin-marker',
    baseColorTex: null,
    baseColorFactor: [0.25, 0.45, 0.95, 0.75],
    alphaMode: 'BLEND',
  };

  const child = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  child.components[COMPONENT_KEYS.transform] = t;
  child.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  child.components[COMPONENT_KEYS.localTransform] = local;
  child.components[CONSTRUCT_KEYS.actorOriginMarker] = marker;
  child.components[COMPONENT_KEYS.renderable] = {
    mesh,
    material,
    castShadow: false,
    overlay: true,
  };
  child.onDeregister.push(() => destroyMesh(gl, mesh));
  registry.register(child);
  addChildId(children, child.id);
  bakeChildWorld(rootT, t, local);
};

export const spawnActorCharacter = async (
  gl: WebGL2RenderingContext,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  character: ActorDocumentCharacter,
): Promise<{ entityId: number; boneNames: string[]; bodyScene: RuntimeScene }> => {
  const loaded = await gltfCache.getOrLoad(character.url);
  const bodyScene = buildRuntimeScene(loaded);
  const mats = buildGltfMaterials(loaded, character.materialPrefix, textures);
  const defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

  if (character.textureVariantUrl) {
    const variantTex = await textures.getOrLoad(character.textureVariantUrl);
    applyTextureToMaterials(mats, variantTex, defaultBaseColorTex);
  }

  const emptyClip = (name: string) => ({ name, duration: 1, channels: [] });
  const wrapped = createAnimationClip(emptyClip('idle'));
  const meshDraws = buildConstructMeshDraws(gl, bodyScene, mats);

  const entity = registry.createBare();
  const t = createTransform();
  t.dirty = true;
  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.skeletalModel] = createSkeletalModel(bodyScene, 0);
  entity.components[COMPONENT_KEYS.meshDraws] = meshDraws;
  entity.components[COMPONENT_KEYS.animationClipMap] = createAnimationClipMap({
    idle: wrapped,
    run: wrapped,
    jumpStart: wrapped,
    jumpAir: wrapped,
    jumpLand: wrapped,
  });
  entity.components[COMPONENT_KEYS.animationStateMachine] = createAnimationStateMachine();
  entity.components[COMPONENT_KEYS.children] = createChildren();
  entity.components[CONSTRUCT_KEYS.actorCharacter] = createConstructActorCharacter(character.url);

  for (const part of meshDraws.parts) {
    entity.onDeregister.push(() => destroyMesh(gl, part.mesh));
  }

  registry.register(entity);

  const boneNames =
    bodyScene.skins[0]?.joints
      .map((j) => bodyScene.nodes[j]?.name ?? '')
      .filter((n) => n.length > 0) ?? [];

  return { entityId: entity.id, boneNames, bodyScene };
};

export const spawnSkeletonOverlay = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  bodyScene: RuntimeScene,
  boneNames: string[],
) => {
  const jointSet = new Set(boneNames);
  const nameToIndex = new Map<string, number>();

  for (let i = 0; i < bodyScene.nodes.length; i++) {
    const name = bodyScene.nodes[i]!.name;
    if (jointSet.has(name)) nameToIndex.set(name, i);
  }

  const jointMaterial = (): Material => ({
    name: 'skeleton-joint',
    baseColorTex: null,
    baseColorFactor: [1, 1, 1, 0.95],
    alphaMode: 'BLEND',
  });

  const boneMaterial = (): Material => ({
    name: 'skeleton-bone',
    baseColorTex: null,
    baseColorFactor: [1, 1, 1, 0.85],
    alphaMode: 'BLEND',
  });

  for (const boneName of boneNames) {
    const { v, idx } = buildUvSphere(JOINT_RADIUS, 8, 12);
    const mesh = createInterleavedMesh(gl, v, idx);
    const child = registry.createBare();
    const t = createTransform();
    child.components[COMPONENT_KEYS.transform] = t;
    child.components[CONSTRUCT_KEYS.skeletonOverlay] = createConstructSkeletonOverlay(
      boneName,
      'joint',
      null,
    );
    child.components[COMPONENT_KEYS.renderable] = {
      mesh,
      material: jointMaterial(),
      castShadow: false,
      overlay: true,
    };
    child.onDeregister.push(() => destroyMesh(gl, mesh));
    registry.register(child);
  }

  for (const boneName of boneNames) {
    const nodeIndex = nameToIndex.get(boneName);
    if (nodeIndex === undefined) continue;

    const node = bodyScene.nodes[nodeIndex]!;
    if (node.parent < 0) continue;

    const parentName = bodyScene.nodes[node.parent]?.name;
    if (!parentName || !jointSet.has(parentName)) continue;

    const mesh = createBoxMesh(gl, BONE_HALF_X, 0.5, BONE_HALF_Z);
    const child = registry.createBare();
    const t = createTransform();
    child.components[COMPONENT_KEYS.transform] = t;
    child.components[CONSTRUCT_KEYS.skeletonOverlay] = createConstructSkeletonOverlay(
      boneName,
      'bone',
      parentName,
    );
    child.components[COMPONENT_KEYS.renderable] = {
      mesh,
      material: boneMaterial(),
      castShadow: false,
      overlay: true,
    };
    child.onDeregister.push(() => destroyMesh(gl, mesh));
    registry.register(child);
  }
};

export const spawnActorAttachment = async (
  gl: WebGL2RenderingContext,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  characterEntityId: number,
  bodyScene: RuntimeScene,
  attachment: ActorDocumentAttachment,
): Promise<number | null> => {
  const parent = registry.get(characterEntityId);
  if (!parent) return null;

  const children = parent.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren> | undefined;
  if (!children) return null;

  const loaded = await gltfCache.getOrLoad(attachment.url);
  const attachScene = buildRuntimeScene(loaded);
  updateWorldFromLocals(attachScene.nodes);
  const mats = buildGltfMaterials(loaded, attachment.materialPrefix, textures);
  const defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

  if (attachment.textureVariantUrl) {
    const variantTex = await textures.getOrLoad(attachment.textureVariantUrl);
    applyTextureToMaterials(mats, variantTex, defaultBaseColorTex);
  }

  if (attachment.placeholder) applyPlaceholderMaterials(mats);

  const boneNodeIndex = findBoneNodeIndex(bodyScene.nodes, attachment.boneName);
  const localOffset = createAttachmentOffset(
    attachment.position,
    attachment.rotation,
    attachment.scale,
  );

  const parts: MeshDrawPart[] = [];

  for (const pair of attachScene.meshNodePairs) {
    const model = attachScene.models[pair.meshIndex];
    if (!model) continue;

    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;

      const material =
        prim.materialIndex >= 0 && prim.materialIndex < mats.length
          ? mats[prim.materialIndex]!
          : mats[0]!;
      const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
      parts.push({ mesh, material, gltfNodeIndex: pair.nodeIndex, visible: true });
    }
  }

  if (parts.length === 0) return null;

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyAttachmentLocal(local, attachment);

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(characterEntityId);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.boneAttachment] = createBoneAttachment(
    attachScene,
    boneNodeIndex,
    localOffset,
  );
  entity.components[COMPONENT_KEYS.meshDraws] = createMeshDraws(parts);
  entity.components[CONSTRUCT_KEYS.actorAttachment] = createConstructActorAttachment(attachment.id);
  entity.components[CONSTRUCT_KEYS.propPart] = createConstructPropPart(attachment.id, 'asset');

  for (const part of parts) {
    entity.onDeregister.push(() => destroyMesh(gl, part.mesh));
  }

  registry.register(entity);
  addChildId(children, entity.id);
  return entity.id;
};

export const removeActorAttachmentEntity = (registry: Registry, attachmentId: string): boolean => {
  let entity: Entity | null = null;

  for (const e of registry.view(CONSTRUCT_KEYS.actorAttachment)) {
    const att = e.components[CONSTRUCT_KEYS.actorAttachment] as { attachmentId: string } | undefined;
    if (att?.attachmentId === attachmentId) {
      entity = e;
      break;
    }
  }

  if (!entity) return false;

  const childOf = entity.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (childOf) {
    const parent = registry.get(childOf.parentId);
    const children = parent?.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren> | undefined;
    if (children) removeChildId(children, entity.id);
  }

  registry.deregister(entity.id);
  return true;
};

const findAttachmentEntity = (registry: Registry, attachmentId: string): Entity | null => {
  for (const e of registry.view(CONSTRUCT_KEYS.actorAttachment)) {
    const att = e.components[CONSTRUCT_KEYS.actorAttachment] as { attachmentId: string } | undefined;
    if (att?.attachmentId === attachmentId) return e;
  }
  return null;
};

export const spawnActorCollider = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  characterEntityId: number,
  bodyScene: RuntimeScene,
  collider: ActorDocumentCollider,
): number | null => {
  const character = registry.get(characterEntityId);
  if (!character) return null;

  const characterChildren = character.components[COMPONENT_KEYS.children] as
    | ReturnType<typeof createChildren>
    | undefined;
  if (!characterChildren) return null;

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyAttachmentLocal(local, collider);

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[CONSTRUCT_KEYS.propPart] = createConstructPropPart(
    collider.id,
    'collider',
    collider.shape,
  );
  entity.components[CONSTRUCT_KEYS.colliderWireframe] = createConstructColliderWireframe(
    collider.shape,
  );
  entity.components[CONSTRUCT_KEYS.actorCollider] = createConstructActorCollider(
    collider.id,
    collider.shape,
    collider.collision,
    collider.hitbox,
  );

  const resources = createColliderShapeResources(gl, collider.shape, {
    halfExtents: collider.halfExtents,
    radius: collider.radius,
    halfHeight: collider.halfHeight,
    collision: collider.collision,
    hitbox: collider.hitbox,
  });
  entity.components[COMPONENT_KEYS.collider] = resources.collider;
  entity.components[COMPONENT_KEYS.renderable] = {
    mesh: resources.mesh,
    material: resources.material,
    castShadow: false,
    overlay: true,
  };
  entity.onDeregister.push(() => destroyMesh(gl, resources.mesh));

  if (collider.parent.kind === 'bone') {
    const boneNodeIndex = findBoneNodeIndex(bodyScene.nodes, collider.parent.boneName);
    const localOffset = createAttachmentOffset(
      collider.position,
      collider.rotation,
      collider.scale,
    );
    entity.components[COMPONENT_KEYS.childOf] = createChildOf(characterEntityId);
    entity.components[COMPONENT_KEYS.boneAttachment] = createBoneAttachment(
      bodyScene,
      boneNodeIndex,
      localOffset,
    );
    registry.register(entity);
    addChildId(characterChildren, entity.id);
    return entity.id;
  }

  const attachmentEntity = findAttachmentEntity(registry, collider.parent.attachmentId);
  if (!attachmentEntity) {
    registry.deregister(entity.id);
    return null;
  }

  const attachmentChildren = attachmentEntity.components[COMPONENT_KEYS.children] as
    | ReturnType<typeof createChildren>
    | undefined;
  if (!attachmentChildren) {
    attachmentEntity.components[COMPONENT_KEYS.children] = createChildren();
  }

  const children =
    (attachmentEntity.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>);

  entity.components[COMPONENT_KEYS.childOf] = createChildOf(attachmentEntity.id);
  registry.register(entity);
  addChildId(children, entity.id);

  const parentT = attachmentEntity.components[COMPONENT_KEYS.transform] as
    | ReturnType<typeof createTransform>
    | undefined;
  if (parentT) {
    const localM = m4();
    m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
    m4Mul(t.world, parentT.world, localM);
    t.dirty = false;
    bakeColliderWorldFromLocal(resources.collider, t.world);
  }

  return entity.id;
};

export const removeActorColliderEntity = (registry: Registry, colliderId: string): boolean => {
  let entity: Entity | null = null;

  for (const e of registry.view(CONSTRUCT_KEYS.actorCollider)) {
    const col = e.components[CONSTRUCT_KEYS.actorCollider] as { colliderId: string } | undefined;
    if (col?.colliderId === colliderId) {
      entity = e;
      break;
    }
  }

  if (!entity) return false;

  const childOf = entity.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (childOf) {
    const parent = registry.get(childOf.parentId);
    const children = parent?.components[COMPONENT_KEYS.children] as
      | ReturnType<typeof createChildren>
      | undefined;
    if (children) removeChildId(children, entity.id);
  }

  registry.deregister(entity.id);
  return true;
};

export const installActorColliderFollowSystem = (registry: Registry) =>
  registry.addAction(
    'update',
    () => {
      for (const e of registry.view(CONSTRUCT_KEYS.actorCollider)) {
        if (e.components[COMPONENT_KEYS.boneAttachment]) continue;

        const t = e.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform> | undefined;
        const childOf = e.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
        const local = e.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
        if (!t || !childOf || !local) continue;

        const parent = registry.get(childOf.parentId);
        const parentT = parent?.components[COMPONENT_KEYS.transform] as
          | ReturnType<typeof createTransform>
          | undefined;
        if (!parentT) continue;

        const localM = m4();
        m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
        m4Mul(t.world, parentT.world, localM);
        t.dirty = false;

        const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
        if (collider) bakeColliderWorldFromLocal(collider, t.world);
      }
    },
    21,
  );
