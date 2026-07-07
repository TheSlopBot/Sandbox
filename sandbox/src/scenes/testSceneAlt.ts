import {
  createPlayableScene,
  CUBE_SMALL,
  CUBE_LARGE,
  ROBOT_ONE_GLB,
  ANIM_GENERAL_GLB,
  ANIM_MOVEMENT_GLB,
  type SceneDeps,
  type SpawnNpcs,
} from './playableScene.ts';
import { createRobot } from '../robot/robot.ts';

export type TestSceneAltDeps = SceneDeps;

const spawnRobots: SpawnNpcs = async (registry, deps) => {
  const anim = { animGeneralGlb: ANIM_GENERAL_GLB, animMovementGlb: ANIM_MOVEMENT_GLB };

  const robot = await createRobot(registry, deps.gl, deps.textures, anim, {
    x: -14, z: 12,
    bodyGlb: ROBOT_ONE_GLB,
    materialPrefix: 'robot_one',
  });
  registry.register(robot.entity);
};

export const useTestSceneAlt = (deps: TestSceneAltDeps) => createPlayableScene(deps, async (addProp) => {
  await addProp(CUBE_SMALL, 'proto', { x: -10.0, z:  0.0 });
  await addProp(CUBE_SMALL, 'proto', { x:  -7.5, z:  0.0 });
  await addProp(CUBE_SMALL, 'proto', { x:  -5.0, z:  0.0 });
  await addProp(CUBE_SMALL, 'proto', { x:  -2.5, z:  0.0 });
  await addProp(CUBE_SMALL, 'proto', { x:   0.0, z:  0.0, yaw: Math.PI / 4 });
  await addProp(CUBE_SMALL, 'proto', { x:   2.5, z:  0.0 });
  await addProp(CUBE_SMALL, 'proto', { x:   5.0, z:  0.0 });
  await addProp(CUBE_SMALL, 'proto', { x:   7.5, z:  0.0 });
  await addProp(CUBE_SMALL, 'proto', { x:  10.0, z:  0.0 });
  await addProp(CUBE_SMALL, 'proto', { x:   0.0, z: -5.0 });
  await addProp(CUBE_SMALL, 'proto', { x:   0.0, z:  5.0 });
  await addProp(CUBE_LARGE, 'proto_large', { x:  0.0, z: -10.0, yaw: Math.PI / 2 });
  await addProp(CUBE_LARGE, 'proto_large', { x:  0.0, z:  10.0, yaw: -Math.PI / 2 });
  await addProp(CUBE_LARGE, 'proto_large', { x: -12.0, z:  8.0, yaw: Math.PI / 3 });
}, spawnRobots);
