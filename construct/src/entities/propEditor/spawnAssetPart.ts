import {
  type GpuDevice,
  type GltfCache,
  type Material,
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
  m4,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type PropDocumentAssetPart } from '../../catalog/props/propDocument.ts';
import { createConstructPropPart } from './propPart.ts';
import { createConstructPropAssetMaterials } from './propAssetMaterials.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { applyTextureToMaterials } from '../editorCommon/materials.ts';
import { applyLocalFromTRS } from '../editorCommon/trs.ts';
import { syncPartLocalToWorld } from '../editorCommon/syncPartLocal.ts';

export const spawnAssetPartEntity = async (
  device: GpuDevice,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  rootId: number,
  part: PropDocumentAssetPart,
): Promise<number | null> => {
  const root = registry.get(rootId);
  if (!root) return null;

  const children = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const loaded = await gltfCache.getOrLoad(part.url);
  const scene = buildRuntimeScene(loaded);
  const mats = buildGltfMaterials(loaded, part.materialPrefix, textures);
  const defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

  const child = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, part);

  child.components[COMPONENT_KEYS.transform] = t;
  child.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  child.components[COMPONENT_KEYS.localTransform] = local;
  child.components[CONSTRUCT_KEYS.propPart] = createConstructPropPart(part.id, 'asset');
  child.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(part.id);
  child.components[CONSTRUCT_KEYS.propAssetMaterials] = createConstructPropAssetMaterials(
    mats,
    defaultBaseColorTex,
    part.textureVariantUrl ?? null,
  );

  if (part.textureVariantUrl) {
    const variantTex = await textures.getOrLoad(part.textureVariantUrl);
    applyTextureToMaterials(mats, variantTex, defaultBaseColorTex);
  }

  const renderEntityIds: number[] = [];

  for (const pair of scene.meshNodePairs) {
    const model = scene.models[pair.meshIndex];
    if (!model) continue;

    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;

      const mesh = createInterleavedMesh(device, prim.vertices, prim.indices);
      const material: Material =
        prim.materialIndex >= 0 && prim.materialIndex < mats.length
          ? mats[prim.materialIndex]!
          : mats[0]!;

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
    return null;
  }

  child.components[COMPONENT_KEYS.staticModel] = createStaticModel(scene);
  child.components[COMPONENT_KEYS.renderGroup] = createRenderGroup(renderEntityIds);
  registry.register(child);
  addChildId(children, child.id);

  syncPartLocalToWorld(registry, child);

  return child.id;
};
