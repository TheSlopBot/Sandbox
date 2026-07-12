import {
  type GpuDevice,
  type GltfCache,
  type Material,
  type PropDefinition,
  type Registry,
  type TextureCache,
  createInterleavedMesh,
  destroyMesh,
  createTransform,
  createLocalTransform,
  createChildOf,
  createChildren,
  addChildId,
  buildRuntimeScene,
  buildGltfMaterials,
  createStaticModel,
  createRenderGroup,
  bakeColliderWorldFromLocal,
  m4,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type LevelDocumentPropInstance } from '../../catalog/levels/levelDocument.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { createColliderShapeResources } from '../editorCommon/colliderShapeResources.ts';
import { createConstructLevelPlacement } from './levelPlacement.ts';
import { applyLocalFromTRS, bakeChildWorld } from '../editorCommon/trs.ts';
import { syncPartLocalToWorld } from '../editorCommon/syncPartLocal.ts';
import { applyTextureToMaterials } from '../editorCommon/materials.ts';
import { createConstructColliderWireframe } from '../propEditor/colliderWireframe.ts';

const spawnLevelAssetVisual = async (
  device: GpuDevice,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  instanceRootId: number,
  instanceChildren: ReturnType<typeof createChildren>,
  part: PropDefinition['parts'][number],
) => {
  if (part.kind !== 'asset') return;

  const loaded = await gltfCache.getOrLoad(part.url);
  const scene = buildRuntimeScene(loaded);
  const mats = buildGltfMaterials(loaded, part.materialPrefix, textures);
  const defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

  if (part.textureVariantUrl) {
    const variantTex = await textures.getOrLoad(part.textureVariantUrl);
    applyTextureToMaterials(mats, variantTex, defaultBaseColorTex);
  }

  const child = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, part);

  child.components[COMPONENT_KEYS.transform] = t;
  child.components[COMPONENT_KEYS.childOf] = createChildOf(instanceRootId);
  child.components[COMPONENT_KEYS.localTransform] = local;

  const renderEntityIds: number[] = [];
  for (const pair of scene.meshNodePairs) {
    const model = scene.models[pair.meshIndex];
    if (!model) continue;

    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;

      const mesh = createInterleavedMesh(device, prim.vertices, prim.indices);
      const material: Material =
        prim.materialIndex >= 0 && prim.materialIndex < mats.length ? mats[prim.materialIndex]! : mats[0]!;

      const renderE = registry.createBare();
      renderE.components[COMPONENT_KEYS.transform] = t;
      renderE.components[COMPONENT_KEYS.gltfNodeIndex] = pair.nodeIndex;
      renderE.components[COMPONENT_KEYS.renderable] = { mesh, material, model: m4() };
      renderE.onDeregister.push(() => destroyMesh(device, mesh));
      registry.register(renderE);
      renderEntityIds.push(renderE.id);
    }
  }

  if (renderEntityIds.length === 0) {
    registry.deregister(child.id);
    return;
  }

  child.components[COMPONENT_KEYS.staticModel] = createStaticModel(scene);
  child.components[COMPONENT_KEYS.renderGroup] = createRenderGroup(renderEntityIds);
  registry.register(child);
  addChildId(instanceChildren, child.id);

  syncPartLocalToWorld(registry, child);
};

const spawnLevelColliderVisual = (
  device: GpuDevice,
  registry: Registry,
  instanceRootId: number,
  instanceChildren: ReturnType<typeof createChildren>,
  part: Extract<PropDefinition['parts'][number], { kind: 'collider' }>,
  showColliders: boolean,
) => {
  const parent = registry.get(instanceRootId);
  if (!parent) return;

  const parentT = parent.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;
  const child = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, part);

  child.components[COMPONENT_KEYS.transform] = t;
  child.components[COMPONENT_KEYS.childOf] = createChildOf(instanceRootId);
  child.components[COMPONENT_KEYS.localTransform] = local;
  child.components[CONSTRUCT_KEYS.colliderWireframe] = createConstructColliderWireframe(part.shape);

  const resources = createColliderShapeResources(device, part.shape, {
    halfExtents: part.halfExtents,
    radius: part.radius,
    halfHeight: part.halfHeight,
  });
  const mesh = resources.mesh;
  child.components[COMPONENT_KEYS.collider] = resources.collider;
  child.components[COMPONENT_KEYS.renderable] = {
    mesh,
    material: resources.material,
    castShadow: false,
    overlay: true,
    visible: showColliders,
  };
  child.onDeregister.push(() => destroyMesh(device, mesh));

  registry.register(child);
  addChildId(instanceChildren, child.id);
  bakeChildWorld(parentT, t, local);
  bakeColliderWorldFromLocal(resources.collider, t.world);
};

export const spawnLevelPropPlacementEntity = async (
  device: GpuDevice,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  rootId: number,
  instance: LevelDocumentPropInstance,
  def: PropDefinition,
  showColliders: boolean,
): Promise<number | null> => {
  const root = registry.get(rootId);
  if (!root) return null;

  const rootT = root.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;
  const rootChildren = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const instanceEnt = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, instance);

  instanceEnt.components[COMPONENT_KEYS.transform] = t;
  instanceEnt.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  instanceEnt.components[COMPONENT_KEYS.localTransform] = local;
  instanceEnt.components[COMPONENT_KEYS.children] = createChildren();
  instanceEnt.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(instance.id);
  instanceEnt.components[CONSTRUCT_KEYS.levelPlacement] = createConstructLevelPlacement(instance.id, 'prop');
  registry.register(instanceEnt);
  addChildId(rootChildren, instanceEnt.id);
  bakeChildWorld(rootT, t, local);

  const instanceChildren = instanceEnt.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  for (const part of def.parts) {
    if (part.kind === 'asset') {
      await spawnLevelAssetVisual(device, registry, textures, gltfCache, instanceEnt.id, instanceChildren, part);
      continue;
    }

    if (part.kind === 'collider') {
      spawnLevelColliderVisual(device, registry, instanceEnt.id, instanceChildren, part, showColliders);
    }
  }

  return instanceEnt.id;
};
