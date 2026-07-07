import {
  type Scene,
  type Input,
  type RenderPipeline,
  TextureCache,
  useRegistry,
  installPlayerInputSystem,
  installAiControllerSystem,
  installLocomotionSystem,
  installCharacterPhysicsSystem,
  installCollisionSystem,
  installCharacterStateSystem,
  installCameraFollowSystem,
  installSkeletalAnimationSystem,
} from 'viberanium';
import { instantiateStaticProp } from '../world/staticProps.ts';
import { createPlayer } from '../player/player.ts';
import { createGroundMesh } from '../world/ground.ts';

const KAYKIT = `${import.meta.env.BASE_URL}assets/kaykit`;
const CUBE_SMALL = `${KAYKIT}/prototype-bits/Cube_Prototype_Small.gltf`;
const CUBE_LARGE = `${KAYKIT}/prototype-bits/Cube_Prototype_Large_B.gltf`;
const SPACE_RANGER_GLB = `${KAYKIT}/space-ranger/SpaceRanger.glb`;
const ANIM_GENERAL_GLB = `${KAYKIT}/animations/Rig_Medium_General.glb`;
const ANIM_MOVEMENT_GLB = `${KAYKIT}/animations/Rig_Medium_MovementBasic.glb`;

type PropOpts = { x?: number; y?: number; z?: number; scale?: number; yaw?: number };

export type TestSceneDeps = {
  gl: WebGL2RenderingContext;
  input: Input;
  pipeline: RenderPipeline;
  textures: TextureCache;
};

export const useTestScene = (deps: TestSceneDeps): Scene => {
  const registry = useRegistry();
  let loaded = false;

  installPlayerInputSystem(registry, deps.input);
  installAiControllerSystem(registry);
  installLocomotionSystem(registry);
  installCharacterPhysicsSystem(registry);
  installCollisionSystem(registry);
  installCharacterStateSystem(registry);
  installCameraFollowSystem(registry, deps.pipeline, deps.input);
  installSkeletalAnimationSystem(registry);

  const addProp = async (url: string, prefix: string, opts: PropOpts = {}) => {
    await instantiateStaticProp(deps.gl, registry, deps.textures, url, prefix, opts);
  };

  const load = async () => {
    if (loaded) return;
    loaded = true;
    deps.pipeline.setGround(createGroundMesh(deps.gl));

    await addProp(CUBE_SMALL, 'proto', { x: -7.5, z: -2.0 });
    await addProp(CUBE_SMALL, 'proto', { x: -4.2, z: -8.0,  yaw: Math.PI / 6 });
    await addProp(CUBE_SMALL, 'proto', { x: -1.0, z: -4.5,  yaw: Math.PI / 3 });
    await addProp(CUBE_SMALL, 'proto', { x:  2.8, z: -9.5,  yaw: Math.PI / 2 });
    await addProp(CUBE_SMALL, 'proto', { x:  6.7, z: -5.8,  yaw: (2 * Math.PI) / 3 });
    await addProp(CUBE_SMALL, 'proto', { x:  8.5, z:  1.2,  yaw: (5 * Math.PI) / 6 });
    await addProp(CUBE_SMALL, 'proto', { x:  3.3, z:  4.8,  yaw: Math.PI });
    await addProp(CUBE_SMALL, 'proto', { x: -2.6, z:  6.4,  yaw: (7 * Math.PI) / 6 });
    await addProp(CUBE_SMALL, 'proto', { x: -6.8, z:  3.0,  yaw: (4 * Math.PI) / 3 });
    await addProp(CUBE_SMALL, 'proto', { x:  5.8, z: -1.0,  yaw: (3 * Math.PI) / 2 });
    await addProp(CUBE_LARGE, 'proto_large', { x:   5.5, z: -13.5, yaw:  Math.PI / 7 });
    await addProp(CUBE_LARGE, 'proto_large', { x:  14.0, z:   4.5, yaw: -Math.PI / 5 });
    await addProp(CUBE_LARGE, 'proto_large', { x: -11.5, z:   7.0, yaw: -Math.PI / 3 });

    const { entity } = await createPlayer(
      registry, deps.gl, deps.textures,
      { bodyGlb: SPACE_RANGER_GLB, animGeneralGlb: ANIM_GENERAL_GLB, animMovementGlb: ANIM_MOVEMENT_GLB },
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
