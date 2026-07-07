import { useRegistry } from '../engine/registry.ts';
import { useGame } from '../engine/game.ts';
import { createInput } from '../input/input.ts';
import { installRenderPipeline } from '../render/pipeline.ts';
import { TextureCache } from '../render/gl/texture.ts';
import { createGroundMesh } from '../world/ground.ts';
import { instantiateStaticProp } from '../world/staticProps.ts';
import { createPlayer } from '../player/player.ts';
import { installCharacterSystem } from '../systems/characterSystem.ts';
import { installCameraSystem } from '../systems/cameraSystem.ts';
import { installAnimationSystem } from '../systems/animationSystem.ts';
import { type Collider } from '../components/collider.ts';

const KAYKIT = `${import.meta.env.BASE_URL}assets/kaykit`;
const CUBE_SMALL = `${KAYKIT}/prototype-bits/Cube_Prototype_Small.gltf`;
const CUBE_LARGE = `${KAYKIT}/prototype-bits/Cube_Prototype_Large_B.gltf`;
const SPACE_RANGER_GLB = `${KAYKIT}/space-ranger/SpaceRanger.glb`;
const ANIM_GENERAL_GLB = `${KAYKIT}/animations/Rig_Medium_General.glb`;
const ANIM_MOVEMENT_GLB = `${KAYKIT}/animations/Rig_Medium_MovementBasic.glb`;

type PropOpts = { x?: number; y?: number; z?: number; scale?: number; yaw?: number };

export const bootstrap = async () => {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) throw new Error('Missing #game canvas');

  const registry = useRegistry();
  const game = useGame(registry);
  const input = createInput(window, canvas);

  const pipeline = installRenderPipeline(registry, canvas, input);
  const gl = pipeline.device.gl;
  const textures = new TextureCache(gl);

  pipeline.setGround(createGroundMesh(gl));

  const staticColliders: Collider[] = [];
  const addProp = async (url: string, prefix: string, opts: PropOpts = {}) => {
    const c = await instantiateStaticProp(gl, registry, textures, url, prefix, opts);
    if (c) staticColliders.push(c);
  };

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

  installCharacterSystem(registry, input, staticColliders);
  installCameraSystem(registry, pipeline, input, staticColliders);

  const { charT, bodyScene, characterParts, clips } = await createPlayer(
    registry, gl, textures,
    { bodyGlb: SPACE_RANGER_GLB, animGeneralGlb: ANIM_GENERAL_GLB, animMovementGlb: ANIM_MOVEMENT_GLB },
  );

  const characterEntity = registry.view('character')[0];
  if (!characterEntity) throw new Error('No character entity after createPlayer');

  installAnimationSystem(registry, characterEntity, charT, bodyScene, characterParts, clips);

  registry.addAction('commit', () => { input.commitFrame(); }, 0);

  game.start();
};
