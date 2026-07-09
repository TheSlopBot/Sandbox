import {
  type Scene,
  type Input,
  type RenderPipeline,
  type Registry,
  type GltfCache,
  type TextureCache,
  type EngineOptimizationOptions,
  useRegistry,
  installMovementSystem,
  installNavGridSystem,
  installCharacterPhysicsSystem,
  installCollisionSystem,
  installCharacterStateSystem,
  installCameraFollowSystem,
  installSkeletalCharacterSystems,
  installStaticModelSystem,
  createNavGrid,
  COMPONENT_KEYS,
} from 'viberanium';
import { type LevelNavGridConfig } from '../../catalog/levels/levelDefinition.ts';
import { createPlayer } from '../../entities/player/createPlayer.ts';
import { installTestAiSystem } from '../../entities/enemies/systems/testAiSystem.ts';
import { installPlayerInputSystem } from '../../entities/player/systems/playerInputSystem.ts';
import { createGroundMesh } from './ground.ts';
import { instantiateProp } from './prop.ts';

export type PropOpts = { x?: number; y?: number; z?: number; scale?: number; yaw?: number };

export type SceneDeps = {
  gl: WebGL2RenderingContext;
  input: Input;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  optimization: EngineOptimizationOptions;
};

export type AddProp = (url: string, prefix: string, opts?: PropOpts) => Promise<void>;

export type SpawnNpcs = (registry: Registry, deps: SceneDeps) => Promise<void>;

export const createPlayableScene = (
  deps: SceneDeps,
  navGridConfig: LevelNavGridConfig,
  spawnProps: (addProp: AddProp) => Promise<void>,
  spawnNpcs?: SpawnNpcs,
): Scene => {
  const registry = useRegistry();
  let loaded = false;

  installPlayerInputSystem(registry, deps.input, deps.gl);
  installNavGridSystem(registry);
  installTestAiSystem(registry);
  installMovementSystem(registry);
  installCharacterPhysicsSystem(registry);
  installCollisionSystem(registry);
  installCharacterStateSystem(registry);
  installCameraFollowSystem(registry, deps.pipeline, deps.input);
  installSkeletalCharacterSystems(registry, {
    getLodOrigin: () => deps.pipeline.camera.position,
    optimization: deps.optimization,
  });
  installStaticModelSystem(registry);

  const addProp: AddProp = async (url, prefix, opts = {}) => {
    await instantiateProp(deps.gl, registry, deps.textures, deps.gltfCache, url, prefix, opts);
  };

  const load = async () => {
    if (loaded) return;
    loaded = true;

    const navGridEntity = registry.createBare();
    navGridEntity.components[COMPONENT_KEYS.navGrid] = createNavGrid(navGridConfig);
    registry.register(navGridEntity);

    deps.pipeline.setGround(createGroundMesh(deps.gl));
    await spawnProps(addProp);
    if (spawnNpcs) await spawnNpcs(registry, deps);

    await createPlayer(registry, deps.gl, deps.textures, deps.gltfCache);
  };

  const unload = () => {
    if (!loaded) return;

    const ids = [...registry.all()].map((entity) => entity.id);
    for (const id of ids) registry.deregister(id);

    deps.pipeline.clearGround();
    loaded = false;
  };

  return { registry, load, unload };
};
