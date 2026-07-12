import { type TextureHandle, type TextureCache } from '../render/gl/texture.ts';
import { type Registry } from '../engine/registry.ts';
import { type Material } from '../render/types.ts';
import { type Collider, bakeColliderWorldFromLocal } from '../components/collider.ts';
import { type Mat4, m4, m4Copy, m4FromTRS, m4FromTRSQuat, m4Mul } from '../math/mat4.ts';
import { type Quat } from '../math/quat.ts';
import { type SharedMeshCache } from '../render/gl/sharedMeshCache.ts';
import { type MeshDrawPart, createMeshDraws } from '../components/meshDraws.ts';
import { type StaticPropBatcher } from '../render/gl/staticPropBatcher.ts';
import { createTransform, updateWorldMatrix, type Transform } from '../components/transform.ts';
import { createLocalTransform, type LocalTransform } from '../components/localTransform.ts';
import { createChildOf } from '../components/childOf.ts';
import { createChildren, addChildId } from '../components/children.ts';
import { createInterleavedMesh, destroyMesh } from '../render/gl/mesh.ts';
import { type GltfCache } from '../assets/gltf/cache.ts';
import { getOrBuildRuntimeScene } from '../assets/gltf/runtime.ts';
import { getOrBuildGltfMaterials } from '../assets/gltf/materials.ts';
import { colliderFromShape } from '../components/colliderFromShape.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { markNavGridDirty } from '../navigation/markNavGridDirty.ts';
import { type GpuDevice } from '../render/gl/device.ts';
import {
  type PropAssetPart,
  type PropColliderPart,
  type PropDefinition,
} from '../definitions/props/propDefinition.ts';

export type PropPlacement = {
  x?: number;
  y?: number;
  z?: number;
  scale?: number | [number, number, number];
  yaw?: number;
  position?: [number, number, number];
  rotation?: [number, number, number, number];
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

const applyPartLocal = (local: LocalTransform, part: PropAssetPart | PropColliderPart) => {
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

const bakeChildWorld = (parentT: Transform, childT: Transform, local: LocalTransform) => {
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

const applyRootPlacement = (
  rootT: Transform,
  placement: PropPlacement,
  rotationQuat: Quat | null,
) => {
  const px = placement.position?.[0] ?? placement.x ?? 0;
  const py = placement.position?.[1] ?? placement.y ?? 0;
  const pz = placement.position?.[2] ?? placement.z ?? 0;
  rootT.position[0] = px;
  rootT.position[1] = py;
  rootT.position[2] = pz;

  if (Array.isArray(placement.scale)) {
    rootT.scale[0] = placement.scale[0];
    rootT.scale[1] = placement.scale[1];
    rootT.scale[2] = placement.scale[2];
  } else {
    const rootScale = placement.scale ?? 1;
    rootT.scale[0] = rootT.scale[1] = rootT.scale[2] = rootScale;
  }

  if (rotationQuat) {
    rootT.yaw = 0;
    rootT.dirty = true;
    m4FromTRSQuat(rootT.world, rootT.position, rotationQuat, rootT.scale);
    rootT.dirty = false;
    return;
  }

  rootT.yaw = placement.yaw ?? 0;
  rootT.dirty = true;
  m4FromTRS(rootT.world, rootT.position, rootT.yaw, rootT.scale);
  rootT.dirty = false;
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
  const rotationQuat = (placement.rotation as Quat | undefined) ?? null;
  applyRootPlacement(rootT, placement, rotationQuat);

  const children = createChildren();
  root.components[COMPONENT_KEYS.transform] = rootT;
  root.components[COMPONENT_KEYS.children] = children;
  registry.register(root);

  const meshParts: MeshDrawPart[] = [];
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

  if (meshParts.length > 0) {
    const batcher = options.batcher;
    const drawParts: MeshDrawPart[] = [];
    const sphereCenter = new Float32Array(3);

    if (batcher) {
      for (const part of meshParts) {
        if (part.material.alphaMode === 'BLEND' || part.material.alphaMode === 'MASK') {
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
