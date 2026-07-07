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

export type TestSceneDeps = SceneDeps;

const spawnRobots: SpawnNpcs = async (registry, deps) => {
  const anim = { animGeneralGlb: ANIM_GENERAL_GLB, animMovementGlb: ANIM_MOVEMENT_GLB };

  const robotOne = await createRobot(registry, deps.gl, deps.textures, anim, {
    x: -11, z: -11,
    bodyGlb: ROBOT_ONE_GLB,
    materialPrefix: 'robot_one',
  });
  registry.register(robotOne.entity);

  const robotTwo = await createRobot(registry, deps.gl, deps.textures, anim, {
    x: 11, z: -11,
    bodyGlb: ROBOT_ONE_GLB,
    materialPrefix: 'robot_ome',
  });
  registry.register(robotTwo.entity);
};

export const useTestScene = (deps: TestSceneDeps) => createPlayableScene(deps, async (addProp) => {
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
}, spawnRobots);
