import {
  type GpuDevice,
  type TextureHandle,
  type Registry,
  type Material,
  type Collider,
  type Mat4,
  type SharedMeshCache,
  type MeshDrawPart,
  type StaticPropBatcher,
  createTransform,
  createLocalTransform,
  createChildOf,
  createChildren,
  addChildId,
  createInterleavedMesh,
  destroyMesh,
  createMeshDraws,
  type TextureCache,
  type GltfCache,
  getOrBuildRuntimeScene,
  getOrBuildGltfMaterials,
  colliderFromShape,
  bakeColliderWorldFromLocal,
  updateWorldMatrix,
  m4,
  m4Copy,
  m4FromTRS,
  m4FromTRSQuat,
  m4Mul,
  COMPONENT_KEYS,
  markNavGridDirty,
} from 'viberanium';
import {
  type PropAssetPart,
  type PropColliderPart,
  type PropDefinition,
} from '../../catalog/props/propDefinition.ts';

export type PropPlacement = {
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  yaw?: number;
};

export type InstantiatePropOptions = {
  meshes?: SharedMeshCache;
  markNavDirty?: boolean;
  batcher?: StaticPropBatcher;
};

const worldSphereFromLocal = (
  outCenter: Float32Array,
  model: Mat4,
  localCenter: readonly [number, number, number],
  localRadius: number,
): number => {
  const lx = localCenter[0]!;
  const ly = localCenter[1]!;
  const lz = localCenter[2]!;
  outCenter[0] = model[0]! * lx + model[4]! * ly + model[8]! * lz + model[12]!;
  outCenter[1] = model[1]! * lx + model[5]! * ly + model[9]! * lz + model[13]!;
  outCenter[2] = model[2]! * lx + model[6]! * ly + model[10]! * lz + model[14]!;

  const sx2 = model[0]! * model[0]! + model[1]! * model[1]! + model[2]! * model[2]!;
  const sy2 = model[4]! * model[4]! + model[5]! * model[5]! + model[6]! * model[6]!;
  const sz2 = model[8]! * model[8]! + model[9]! * model[9]! + model[10]! * model[10]!;
  return localRadius * Math.sqrt(Math.max(sx2, sy2, sz2));
};

const expandBoundsFromInterleaved = (
  min: [number, number, number],
  max: [number, number, number],
  vertices: Float32Array,
  worldM?: Float32Array,
) => {
  for (let i = 0; i < vertices.length; i += 8) {
    const lx = vertices[i]!;
    const ly = vertices[i + 1]!;
    const lz = vertices[i + 2]!;

    let x = lx;
    let y = ly;
    let z = lz;

    if (worldM) {
      x = worldM[0]! * lx + worldM[4]! * ly + worldM[8]! * lz + worldM[12]!;
      y = worldM[1]! * lx + worldM[5]! * ly + worldM[9]! * lz + worldM[13]!;
      z = worldM[2]! * lx + worldM[6]! * ly + worldM[10]! * lz + worldM[14]!;
    }

    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
};

const applyPartLocal = (
  local: ReturnType<typeof createLocalTransform>,
  part: PropAssetPart | PropColliderPart,
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

const bakeChildWorld = (
  parentT: ReturnType<typeof createTransform>,
  childT: ReturnType<typeof createTransform>,
  local: ReturnType<typeof createLocalTransform>,
) => {
  updateWorldMatrix(parentT);
  const localM = m4();
  m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
  m4Mul(childT.world, parentT.world, localM);
  childT.dirty = false;
};

const createColliderFromPart = (part: PropColliderPart): Collider =>
  colliderFromShape({
    shape: part.shape,
    halfExtents: part.halfExtents,
    radius: part.radius,
    halfHeight: part.halfHeight,
    isStatic: true,
  });

const finalizeStaticChild = (registry: Registry, childId: number): void => {
  const child = registry.get(childId);
  if (!child) return;

  registry.removeComponent(child, COMPONENT_KEYS.childOf);
  registry.removeComponent(child, COMPONENT_KEYS.localTransform);

  const collider = child.components[COMPONENT_KEYS.collider] as Collider | undefined;
  if (collider) delete collider.localShape;
};

const resolveVariantTexture = async (
  textures: TextureCache,
  url: string | null | undefined,
): Promise<TextureHandle | null> => {
  if (!url) return null;

  return textures.getOrLoad(url);
};

const bakeMeshDrawModels = (
  parts: MeshDrawPart[],
  rootWorld: Mat4,
  locals: Mat4[],
) => {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const local = locals[i]!;
    if (!part.model) part.model = m4();
    m4Mul(part.model, rootWorld, local);
  }
};

export const instantiateProp = async (
  device: GpuDevice,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  def: PropDefinition,
  placement: PropPlacement = {},
  options: InstantiatePropOptions = {},
): Promise<boolean> => {
  const root = registry.createBare();
  const rootT = createTransform();
  rootT.position[0] = placement.x ?? 0;
  rootT.position[1] = placement.y ?? 0;
  rootT.position[2] = placement.z ?? 0;
  const rootScale = placement.scale ?? 1;
  rootT.scale[0] = rootT.scale[1] = rootT.scale[2] = rootScale;
  rootT.yaw = placement.yaw ?? 0;
  rootT.dirty = true;
  m4FromTRS(rootT.world, rootT.position, rootT.yaw, rootT.scale);
  rootT.dirty = false;

  const children = createChildren();
  root.components[COMPONENT_KEYS.transform] = rootT;
  root.components[COMPONENT_KEYS.children] = children;
  registry.register(root);

  const boundsMin: [number, number, number] = [Infinity, Infinity, Infinity];
  const boundsMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const meshParts: MeshDrawPart[] = [];
  const meshLocals: Mat4[] = [];
  const ownedMeshes: Array<ReturnType<typeof createInterleavedMesh>> = [];
  let spawnedAsset = false;

  for (const part of def.parts) {
    if (part.kind === 'asset') {
      const loaded = await gltfCache.getOrLoad(part.url);
      const scene = getOrBuildRuntimeScene(loaded);
      const variantTex = await resolveVariantTexture(textures, part.textureVariantUrl);
      const mats = getOrBuildGltfMaterials(loaded, part.materialPrefix, textures, variantTex);

      const local = createLocalTransform();
      applyPartLocal(local, part);
      const partLocalM = m4();
      m4FromTRSQuat(partLocalM, local.position, local.rotation, local.scale);

      for (const pair of scene.meshNodePairs) {
        const model = scene.models[pair.meshIndex];
        if (!model) continue;

        const nodeWorld = scene.nodes[pair.nodeIndex]?.worldM;

        for (let primIndex = 0; primIndex < model.primitives.length; primIndex++) {
          const prim = model.primitives[primIndex]!;
          if (prim.kind === 'skinned') continue;

          const material: Material =
            prim.materialIndex >= 0 && prim.materialIndex < mats.length
              ? mats[prim.materialIndex]!
              : mats[0]!;

          const combinedLocal = m4();
          if (nodeWorld) m4Mul(combinedLocal, partLocalM, nodeWorld);
          else m4Copy(combinedLocal, partLocalM);

          expandBoundsFromInterleaved(boundsMin, boundsMax, prim.vertices, combinedLocal);

          const meshKey = `${part.url}#${pair.meshIndex}:${primIndex}`;
          const mesh = options.meshes
            ? options.meshes.getInterleaved(meshKey, prim.vertices, prim.indices)
            : createInterleavedMesh(device, prim.vertices, prim.indices);
          if (!options.meshes) ownedMeshes.push(mesh);

          const worldModel = m4();
          m4Mul(worldModel, rootT.world, combinedLocal);

          meshParts.push({
            mesh,
            material,
            gltfNodeIndex: pair.nodeIndex,
            model: worldModel,
            castShadow: true,
          });
          meshLocals.push(combinedLocal);
        }
      }

      if (meshParts.length > 0) spawnedAsset = true;
      continue;
    }

    const colEntity = registry.createBare();
    const colT = createTransform();
    const local = createLocalTransform();
    applyPartLocal(local, part);
    const collider = createColliderFromPart(part);

    colEntity.components[COMPONENT_KEYS.transform] = colT;
    colEntity.components[COMPONENT_KEYS.childOf] = createChildOf(root.id);
    colEntity.components[COMPONENT_KEYS.localTransform] = local;
    colEntity.components[COMPONENT_KEYS.collider] = collider;
    registry.register(colEntity);
    addChildId(children, colEntity.id);
    bakeChildWorld(rootT, colT, local);
    bakeColliderWorldFromLocal(collider, colT.world);
  }

  if (!spawnedAsset && def.parts.every((p) => p.kind !== 'collider')) {
    registry.deregister(root.id);
    return false;
  }

  if (placement.y === undefined && Number.isFinite(boundsMin[1])) {
    rootT.position[1] = -boundsMin[1] * rootScale;
    rootT.dirty = true;
    m4FromTRS(rootT.world, rootT.position, rootT.yaw, rootT.scale);
    rootT.dirty = false;

    bakeMeshDrawModels(meshParts, rootT.world, meshLocals);

    for (const childId of children.ids) {
      const child = registry.get(childId);
      if (!child) continue;

      const childT = child.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform> | undefined;
      const local = child.components[COMPONENT_KEYS.localTransform] as ReturnType<typeof createLocalTransform> | undefined;
      if (!childT || !local) continue;

      bakeChildWorld(rootT, childT, local);

      const collider = child.components[COMPONENT_KEYS.collider] as Collider | undefined;
      if (collider) bakeColliderWorldFromLocal(collider, childT.world);
    }
  }

  if (meshParts.length > 0) {
    const batcher = options.batcher;
    const drawParts: MeshDrawPart[] = [];
    const sphereCenter = new Float32Array(3);

    if (batcher) {
      for (const part of meshParts) {
        if (part.material.alphaMode === 'BLEND') {
          drawParts.push(part);
          continue;
        }

        const model = part.model!;
        const radius = worldSphereFromLocal(
          sphereCenter,
          model,
          part.mesh.boundsCenter,
          part.mesh.boundsRadius,
        );
        batcher.add(
          part.mesh,
          part.material,
          model,
          [sphereCenter[0]!, sphereCenter[1]!, sphereCenter[2]!],
          radius,
          part.castShadow !== false,
        );
      }
    } else {
      drawParts.push(...meshParts);
    }

    if (drawParts.length > 0) {
      registry.addComponent(root, COMPONENT_KEYS.meshDraws, createMeshDraws(drawParts));
    }

    if (ownedMeshes.length > 0) {
      root.onDeregister.push(() => {
        for (const mesh of ownedMeshes) destroyMesh(device, mesh);
      });
    }
  }

  for (const childId of children.ids) finalizeStaticChild(registry, childId);

  if (options.markNavDirty !== false) markNavGridDirty(registry);
  return true;
};
