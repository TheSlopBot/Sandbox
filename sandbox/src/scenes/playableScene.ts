import {
  type Scene,
  type Input,
  type RenderPipeline,
  type Registry,
  TextureCache,
  useRegistry,
  installMovementSystem,
  installNavGridSystem,
  installCharacterPhysicsSystem,
  installCollisionSystem,
  installCharacterStateSystem,
  installCameraFollowSystem,
  installSkeletalAnimationSystem,
  createNavGrid,
  markNavGridDirty,
  COMPONENT_KEYS,
} from 'viberanium';
import { instantiateStaticProp } from '../world/staticProps.ts';
import { createPlayer } from '../player/player.ts';
import { createGroundMesh } from '../world/ground.ts';
import { installRobotAiSystem } from '../robot/systems/robotAiSystem.ts';
import { installPlayerInputSystem } from '../player/systems/playerInputSystem.ts';

export const KAYKIT = `${import.meta.env.BASE_URL}assets/kaykit`;
export const CUBE_SMALL = `${KAYKIT}/prototype-bits/Cube_Prototype_Small.gltf`;
export const CUBE_LARGE = `${KAYKIT}/prototype-bits/Cube_Prototype_Large_B.gltf`;
export const SPACE_RANGER_GLB = `${KAYKIT}/space-ranger/SpaceRanger.glb`;
export const ROBOT_ONE_GLB = `${KAYKIT}/robots/Robot_One.glb`;
export const ANIM_GENERAL_GLB = `${KAYKIT}/animations/Rig_Medium_General.glb`;
export const ANIM_MOVEMENT_GLB = `${KAYKIT}/animations/Rig_Medium_MovementBasic.glb`;

const NAV_MIN_X = -18;
const NAV_MAX_X = 18;
const NAV_MIN_Z = -18;
const NAV_MAX_Z = 18;
const NAV_CELL = 1.0;

export type PropOpts = { x?: number; y?: number; z?: number; scale?: number; yaw?: number };

export type SceneDeps = {
  gl: WebGL2RenderingContext;
  input: Input;
  pipeline: RenderPipeline;
  textures: TextureCache;
};

export type AddProp = (url: string, prefix: string, opts?: PropOpts) => Promise<void>;

export type SpawnNpcs = (registry: Registry, deps: SceneDeps) => Promise<void>;

export const createPlayableScene = (
  deps: SceneDeps,
  spawnProps: (addProp: AddProp) => Promise<void>,
  spawnNpcs?: SpawnNpcs,
): Scene => {
  const registry = useRegistry();
  let loaded = false;

  const navGridEntity = registry.createBare();
  navGridEntity.components[COMPONENT_KEYS.navGrid] = createNavGrid({
    minX: NAV_MIN_X,
    maxX: NAV_MAX_X,
    minZ: NAV_MIN_Z,
    maxZ: NAV_MAX_Z,
    cellSize: NAV_CELL,
  });
  registry.register(navGridEntity);

  installPlayerInputSystem(registry, deps.input);
  installNavGridSystem(registry);
  installRobotAiSystem(registry);
  installMovementSystem(registry);
  installCharacterPhysicsSystem(registry);
  installCollisionSystem(registry);
  installCharacterStateSystem(registry);
  installCameraFollowSystem(registry, deps.pipeline, deps.input);
  installSkeletalAnimationSystem(registry);

  const addProp: AddProp = async (url, prefix, opts = {}) => {
    await instantiateStaticProp(deps.gl, registry, deps.textures, url, prefix, opts);
  };

  const load = async () => {
    if (loaded) return;
    loaded = true;
    deps.pipeline.setGround(createGroundMesh(deps.gl));
    await spawnProps(addProp);
    if (spawnNpcs) await spawnNpcs(registry, deps);

    const { entity } = await createPlayer(
      registry, deps.gl, deps.textures,
      { bodyGlb: SPACE_RANGER_GLB, animGeneralGlb: ANIM_GENERAL_GLB, animMovementGlb: ANIM_MOVEMENT_GLB, materialPrefix: 'spaceranger_body' },
    );
    registry.register(entity);
  };

  const unload = () => {
    if (!loaded) return;
    const ids = [...registry.all()]
      .filter((e) => e.components[COMPONENT_KEYS.navGrid] === undefined)
      .map((e) => e.id);
    for (const id of ids) registry.deregister(id);
    markNavGridDirty(registry);
    loaded = false;
  };

  return { registry, load, unload };
};
