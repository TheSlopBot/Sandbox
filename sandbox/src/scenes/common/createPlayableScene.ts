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
  type PropDefinition,
  useRegistry,
  installMovementSystem,
  installNavGridSystem,
  installCharacterPhysicsSystem,
  installColliderTransformSystem,
  installCharacterStateSystem,
  installCameraFollowSystem,
  installSkeletalCharacterSystems,
  installStaticModelSystem,
  createNavGrid,
  COMPONENT_KEYS,
  markNavGridDirty,
} from 'viberanium';
import { type LevelGroundVariant, type LevelNavGridConfig } from '../../catalog/levels/levelDefinition.ts';
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
  setSimFlush: (fn: (() => Promise<void>) | null) => void;
};

export type AddProp = (def: PropDefinition, placement?: PropPlacement) => Promise<void>;

export type SpawnNpcs = (registry: Registry, deps: SceneDeps) => Promise<void>;

export const createPlayableScene = (
  deps: SceneDeps,
  navGridConfig: LevelNavGridConfig,
  spawnProps: (addProp: AddProp) => Promise<void>,
  spawnNpcs?: SpawnNpcs,
  playerSpawn?: {
    position: [number, number, number];
    rotation: [number, number, number, number];
  },
  groundPlane?: {
    position: [number, number, number];
    size: number;
    variant?: LevelGroundVariant;
  },
): Scene => {
  const registry = useRegistry();
  let loaded = false;

  installPlayerInputSystem(registry, deps.input, deps.device);
  installNavGridSystem(registry);
  installTestAiSystem(registry);
  installMovementSystem(registry);
  installCharacterPhysicsSystem(registry);
  installColliderTransformSystem(registry);
  installCharacterStateSystem(registry);
  installCameraFollowSystem(registry, deps.pipeline, deps.input);
  installSkeletalCharacterSystems(registry, {
    device: deps.device,
    setPreDrawEncode: deps.pipeline.setPreDrawEncode,
    getLodOrigin: () => deps.pipeline.camera.position,
    optimization: deps.optimization,
  });
  installStaticModelSystem(registry);

  const addProp: AddProp = async (def, placement = {}) => {
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

    spawnGround(deps.device, registry, groundPlane);
    await spawnProps(addProp);
    markNavGridDirty(registry);
    if (spawnNpcs) await spawnNpcs(registry, deps);
    await createPlayer(registry, deps.device, deps.textures, deps.gltfCache, playerSpawn);
  };

  const unload = () => {
    if (!loaded) return;

    deps.setSimFlush(null);

    const ids = [...registry.all()].map((entity) => entity.id);
    for (const id of ids) registry.deregister(id);

    deps.staticPropBatcher.clear();
    loaded = false;
  };

  return { registry, load, unload };
};
