import {
  type Scene,
  type Input,
  type RenderPipeline,
  type Registry,
  type GltfCache,
  type TextureCache,
  type EngineOptimizationOptions,
  type SharedMeshCache,
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
  gl: WebGL2RenderingContext;
  input: Input;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  meshes: SharedMeshCache;
  optimization: EngineOptimizationOptions;
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

  installPlayerInputSystem(registry, deps.input, deps.gl);
  installNavGridSystem(registry);
  installTestAiSystem(registry);
  installMovementSystem(registry);
  installCharacterPhysicsSystem(registry);
  installCollisionSystem(registry);
  installColliderTransformSystem(registry);
  installCharacterStateSystem(registry);
  installCameraFollowSystem(registry, deps.pipeline, deps.input);
  installSkeletalCharacterSystems(registry, {
    getLodOrigin: () => deps.pipeline.camera.position,
    optimization: deps.optimization,
  });
  installStaticModelSystem(registry);

  const addProp: AddProp = async (propId, placement = {}) => {
    const def = getPropDefinition(propId);
    await instantiateProp(deps.gl, registry, deps.textures, deps.gltfCache, def, placement, {
      meshes: deps.meshes,
      markNavDirty: false,
    });
  };

  const load = async () => {
    if (loaded) return;
    loaded = true;

    const navGridEntity = registry.createBare();
    navGridEntity.components[COMPONENT_KEYS.navGrid] = createNavGrid(navGridConfig);
    registry.register(navGridEntity);

    spawnGround(deps.gl, registry);
    await spawnProps(addProp);
    markNavGridDirty(registry);
    if (spawnNpcs) await spawnNpcs(registry, deps);
    await createPlayer(registry, deps.gl, deps.textures, deps.gltfCache);
  };

  const unload = () => {
    if (!loaded) return;

    const ids = [...registry.all()].map((entity) => entity.id);
    for (const id of ids) registry.deregister(id);

    loaded = false;
  };

  return { registry, load, unload };
};
