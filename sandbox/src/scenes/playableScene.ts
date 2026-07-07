import {
  type Scene,
  type Input,
  type RenderPipeline,
  type Registry,
  TextureCache,
  useRegistry,
  installMovementSystem,
  installCharacterPhysicsSystem,
  installCollisionSystem,
  installCharacterStateSystem,
  installCameraFollowSystem,
  installSkeletalAnimationSystem,
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

  installPlayerInputSystem(registry, deps.input);
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
    const ids = [...registry.all()].map((e) => e.id);
    for (const id of ids) registry.deregister(id);
    loaded = false;
  };

  return { registry, load, unload };
};
