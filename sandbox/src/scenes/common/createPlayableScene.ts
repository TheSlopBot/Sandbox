import {
  type GpuDevice,
  type Scene,
  type Input,
  type RenderPipeline,
  type Registry,
  type GltfCache,
  type TextureCache,
  type EngineOptimizationOptions,
  type SharedMeshCache,
  type StaticPropBatcher,
  useRegistry,
  installMovementSystem,
  installNavGridSystem,
  installCharacterPhysicsSystem,
  installCollisionSystem,
  installColliderTransformSystem,
  installCharacterStateSystem,
  installCameraFollowSystem,
  installSkeletalCharacterSystems,
  installStaticModelSystem,
  createNavGrid,
  COMPONENT_KEYS,
  markNavGridDirty,
} from 'viberanium';
import { type LevelNavGridConfig } from '../../catalog/levels/levelDefinition.ts';
import { getPropDefinition } from '../../catalog/props/registry.ts';
import { createPlayer } from '../../entities/player/createPlayer.ts';
import { installTestAiSystem } from '../../entities/enemies/systems/testAiSystem.ts';
import { installPlayerInputSystem } from '../../entities/player/systems/playerInputSystem.ts';
import { spawnGround } from '../../entities/ground/spawnGround.ts';
import { instantiateProp, type PropPlacement } from './prop.ts';

export type SceneDeps = {
  device: GpuDevice;
  input: Input;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  meshes: SharedMeshCache;
  optimization: EngineOptimizationOptions;
  staticPropBatcher: StaticPropBatcher;
  setPostUpdateFlush: (fn: (() => Promise<void>) | null) => void;
};

export type AddProp = (propId: string, placement?: PropPlacement) => Promise<void>;

export type SpawnNpcs = (registry: Registry, deps: SceneDeps) => Promise<void>;

export const createPlayableScene = (
  deps: SceneDeps,
  navGridConfig: LevelNavGridConfig,
  spawnProps: (addProp: AddProp) => Promise<void>,
  spawnNpcs?: SpawnNpcs,
): Scene => {
  const registry = useRegistry();
  let loaded = false;

  installPlayerInputSystem(registry, deps.input, deps.device);
  installNavGridSystem(registry);
  installTestAiSystem(registry);
  installMovementSystem(registry);
  const useGpuResolve = false;
  installCharacterPhysicsSystem(registry, { skip: useGpuResolve });
  installCollisionSystem(registry, {
    device: deps.device,
    gpuResolve: useGpuResolve,
  });
  installColliderTransformSystem(registry);
  installCharacterStateSystem(registry);
  installCameraFollowSystem(registry, deps.pipeline, deps.input);
  installSkeletalCharacterSystems(registry, {
    device: deps.device,
    getLodOrigin: () => deps.pipeline.camera.position,
    optimization: deps.optimization,
  });
  installStaticModelSystem(registry);

  const addProp: AddProp = async (propId, placement = {}) => {
    const def = getPropDefinition(propId);
    await instantiateProp(deps.device, registry, deps.textures, deps.gltfCache, def, placement, {
      meshes: deps.meshes,
      markNavDirty: false,
      batcher: deps.staticPropBatcher,
    });
  };

  const load = async () => {
    if (loaded) return;
    loaded = true;

    const navGridEntity = registry.createBare();
    navGridEntity.components[COMPONENT_KEYS.navGrid] = createNavGrid(navGridConfig);
    registry.register(navGridEntity);

    spawnGround(deps.device, registry);
    await spawnProps(addProp);
    markNavGridDirty(registry);
    if (spawnNpcs) await spawnNpcs(registry, deps);
    await createPlayer(registry, deps.device, deps.textures, deps.gltfCache);
  };

  const unload = () => {
    if (!loaded) return;

    const ids = [...registry.all()].map((entity) => entity.id);
    for (const id of ids) registry.deregister(id);

    deps.staticPropBatcher.clear();
    loaded = false;
  };

  return { registry, load, unload };
};
