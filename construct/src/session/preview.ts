import {
  type TextureHandle,
  type Material,
  buildGltfMaterials,
  buildMeshDrawsFromRuntimeScene,
  buildRuntimeScene,
  createAnimationClip,
  createAnimationClipMap,
  createAnimationStateMachine,
  createCharacterController,
  createInterleavedMesh,
  createRenderGroup,
  createSkeletalModel,
  createStaticModel,
  createTransform,
  destroyMesh,
  m4,
  COMPONENT_KEYS,
} from 'viberanium';
import { frameOrbitOnBounds } from '../entities/orbit/orbit.ts';
import { clearActorEditorEntities } from '../entities/actorEditor/spawnActorEditor.ts';
import { clearPropEditorEntities } from '../entities/propEditor/spawnPropEditor.ts';
import {
  boundsCenter,
  boundsRadius,
  createEmptyBounds,
  expandBoundsFromInterleaved,
  isBoundsValid,
} from '../entities/viewer/modelBounds.ts';
import { resetEditorScene } from '../scenes/editorScene.ts';
import {
  ensurePreviewSkeletalSystems,
  ensurePropStaticModelSystem,
} from '../scenes/installEditorSystems.ts';
import {
  type ConstructLoadedModel,
  type ConstructSessionDeps,
  type ConstructSessionState,
  type ConstructTextureVariant,
} from './types.ts';

const applyTextureToMaterials = (materials: Material[], tex: TextureHandle | null) => {
  for (const mat of materials) {
    if (tex) mat.baseColorTex = tex;
  }
};

export const loadModel = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  modelUrl: string,
  nextVariants: ConstructTextureVariant[] = [],
): Promise<ConstructLoadedModel> => {
  const generation = ++state.loadGeneration;

  resetEditorScene(deps, state);
  state.editorMode = 'preview';
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);

  state.loadedModelUrl = modelUrl;
  state.textureVariants = nextVariants;
  state.activeTextureVariantUrl = null;

  const loaded = await deps.gltfCache.getOrLoad(modelUrl);
  if (generation !== state.loadGeneration) {
    return {
      kind: 'StaticProp',
      modelUrl,
      boneNames: [],
      textureVariants: nextVariants,
      activeTextureVariantUrl: null,
    };
  }

  const runtimeScene = buildRuntimeScene(loaded);
  const mats = buildGltfMaterials(loaded, 'construct', deps.textures);
  state.activeMaterials = mats;
  state.defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

  const hasSkin = runtimeScene.skins.length > 0;

  const rootT = createTransform();
  rootT.dirty = true;
  const bounds = createEmptyBounds();

  for (const pair of runtimeScene.meshNodePairs) {
    const model = runtimeScene.models[pair.meshIndex];
    if (!model) continue;

    const nodeWorld = runtimeScene.nodes[pair.nodeIndex]?.worldM;

    for (const prim of model.primitives) {
      expandBoundsFromInterleaved(bounds, prim.vertices, nodeWorld);
    }
  }

  if (isBoundsValid(bounds)) {
    const center = boundsCenter(bounds);

    rootT.position[0] = -center[0];
    rootT.position[1] = -center[1];
    rootT.position[2] = -center[2];
    rootT.dirty = true;

    frameOrbitOnBounds(deps.orbit, [0, 0, 0], boundsRadius(bounds));
  }

  if (hasSkin) {
    const cc = createCharacterController();

    const entity = deps.registry.createBare();
    entity.components[COMPONENT_KEYS.transform] = rootT;
    entity.components[COMPONENT_KEYS.character] = cc;

    const wrapped = createAnimationClip({ name: 'idle', duration: 1, channels: [] });

    const meshDraws = buildMeshDrawsFromRuntimeScene(deps.device, runtimeScene, mats);
    for (const part of meshDraws.parts) {
      entity.onDeregister.push(() => destroyMesh(deps.device, part.mesh));
    }

    entity.components[COMPONENT_KEYS.skeletalModel] = createSkeletalModel(runtimeScene, 0);
    entity.components[COMPONENT_KEYS.meshDraws] = meshDraws;
    entity.components[COMPONENT_KEYS.animationClipMap] = createAnimationClipMap({
      idle: wrapped,
      run: wrapped,
      walkBack: wrapped,
      jumpStart: wrapped,
      jumpAir: wrapped,
      jumpLand: wrapped,
    });
    entity.components[COMPONENT_KEYS.animationStateMachine] = createAnimationStateMachine();
    deps.registry.register(entity);

    ensurePreviewSkeletalSystems(deps.registry, deps.device, deps.pipeline, state);

    const boneNames =
      runtimeScene.skins[0]?.joints
        .map((j) => runtimeScene.nodes[j]?.name ?? '')
        .filter((n) => n.length > 0) ?? [];

    return {
      kind: 'CharacterModel',
      modelUrl,
      boneNames,
      textureVariants: nextVariants,
      activeTextureVariantUrl: state.activeTextureVariantUrl,
    };
  }

  const renderEntityIds: number[] = [];

  for (const pair of runtimeScene.meshNodePairs) {
    const model = runtimeScene.models[pair.meshIndex];
    if (!model) continue;

    for (const prim of model.primitives) {
      const material = prim.materialIndex >= 0 && prim.materialIndex < mats.length ? mats[prim.materialIndex] : mats[0];

      if (prim.kind === 'skinned' && pair.skinIndex >= 0) continue;

      const mesh = createInterleavedMesh(deps.device, prim.vertices, prim.indices);
      const re = deps.registry.createBare();
      re.components[COMPONENT_KEYS.transform] = rootT;
      re.components[COMPONENT_KEYS.gltfNodeIndex] = pair.nodeIndex;
      re.components[COMPONENT_KEYS.renderable] = { mesh, material, model: m4() };
      re.onDeregister.push(() => destroyMesh(deps.device, mesh));
      deps.registry.register(re);
      renderEntityIds.push(re.id);
    }
  }

  const propRoot = deps.registry.createBare();
  propRoot.components[COMPONENT_KEYS.transform] = rootT;
  propRoot.components[COMPONENT_KEYS.staticModel] = createStaticModel(runtimeScene);
  propRoot.components[COMPONENT_KEYS.renderGroup] = createRenderGroup(renderEntityIds);
  deps.registry.register(propRoot);

  if (state.removeStaticModelSystem) {
    state.removeStaticModelSystem();
    state.removeStaticModelSystem = null;
  }
  ensurePropStaticModelSystem(deps.registry, state);

  return {
    kind: 'StaticProp',
    modelUrl,
    boneNames: [],
    textureVariants: nextVariants,
    activeTextureVariantUrl: state.activeTextureVariantUrl,
  };
};

export const setTextureVariant = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  variantUrl: string | null,
) => {
  if (!state.loadedModelUrl) return;
  if (state.activeMaterials.length === 0) return;

  if (!variantUrl) {
    state.activeTextureVariantUrl = null;
    applyTextureToMaterials(state.activeMaterials, state.defaultBaseColorTex);
    return;
  }

  const tex = await deps.textures.getOrLoad(variantUrl);
  state.activeTextureVariantUrl = variantUrl;
  applyTextureToMaterials(state.activeMaterials, tex);
};
