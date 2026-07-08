import {
  type Scene,
  type Input,
  type RenderPipeline,
  type Registry,
  type GltfCache,
  type TextureCache,
  useRegistry,
  installMovementSystem,
  installNavGridSystem,
  installCharacterPhysicsSystem,
  installCollisionSystem,
  installCharacterStateSystem,
  installCameraFollowSystem,
  installSkeletalAnimationSystem,
  createNavGrid,
  COMPONENT_KEYS,
} from 'viberanium';
import { instantiateStaticProp } from '../world/staticProps.ts';
import { createPlayer } from '../player/player.ts';
import { createGroundMesh } from '../world/ground.ts';
import { installTestAiSystem } from '../npcs/systems/testAiSystem.ts';
import { installPlayerInputSystem } from '../player/systems/playerInputSystem.ts';
import { SPACE_RANGER_GLB, ANIM_GENERAL_GLB, ANIM_MOVEMENT_GLB } from '../levels/assets.ts';
import { type LevelNavGridConfig } from '../levels/catalog.ts';

export type PropOpts = { x?: number; y?: number; z?: number; scale?: number; yaw?: number };

export type SceneDeps = {
  gl: WebGL2RenderingContext;
  input: Input;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
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

  installPlayerInputSystem(registry, deps.input);
  installNavGridSystem(registry);
  installTestAiSystem(registry);
  installMovementSystem(registry);
  installCharacterPhysicsSystem(registry);
  installCollisionSystem(registry);
  installCharacterStateSystem(registry);
  installCameraFollowSystem(registry, deps.pipeline, deps.input);
  installSkeletalAnimationSystem(registry);

  const addProp: AddProp = async (url, prefix, opts = {}) => {
    await instantiateStaticProp(deps.gl, registry, deps.textures, deps.gltfCache, url, prefix, opts);
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

    const { entity } = await createPlayer(
      registry, deps.gl, deps.textures, deps.gltfCache,
      { bodyGlb: SPACE_RANGER_GLB, animGeneralGlb: ANIM_GENERAL_GLB, animMovementGlb: ANIM_MOVEMENT_GLB, materialPrefix: 'spaceranger_body' },
    );
    registry.register(entity);
  };

  const unload = () => {
    if (!loaded) return;

    const ids = [...registry.all()].map((e) => e.id);
    for (const id of ids) registry.deregister(id);

    deps.pipeline.clearGround();
    loaded = false;
  };

  return { registry, load, unload };
};
