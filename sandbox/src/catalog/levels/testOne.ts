import { type LevelDefinition } from './levelDefinition.ts';
import { type LevelBuild } from './levelSeed.ts';
import { DEFAULT_NAV_GRID, actorInstance, buildDummySpawnInstances, indexById, propInstance, withTestAi } from './helpers.ts';
import { getPropDefinition } from '../props/registry.ts';
import { DUMMY_ACTORS, ROBOT_ACTORS } from '../actors/kaykitActors.ts';

const CUBE_SMALL_PLACEMENTS: Array<{ x: number; z: number; yaw?: number }> = [
  { x: -7.5, z: -2.0 },
  { x: -4.2, z: -8.0, yaw: Math.PI / 6 },
  { x: -1.0, z: -4.5, yaw: Math.PI / 3 },
  { x: 2.8, z: -9.5, yaw: Math.PI / 2 },
  { x: 6.7, z: -5.8, yaw: (2 * Math.PI) / 3 },
  { x: 8.5, z: 1.2, yaw: (5 * Math.PI) / 6 },
  { x: 3.3, z: 4.8, yaw: Math.PI },
  { x: -2.6, z: 6.4, yaw: (7 * Math.PI) / 6 },
  { x: -6.8, z: 3.0, yaw: (4 * Math.PI) / 3 },
  { x: 5.8, z: -1.0, yaw: (3 * Math.PI) / 2 },
];

const CUBE_LARGE_PLACEMENTS: Array<{ x: number; z: number; yaw?: number }> = [
  { x: 5.5, z: -13.5, yaw: Math.PI / 7 },
  { x: 14.0, z: 4.5, yaw: -Math.PI / 5 },
  { x: -11.5, z: 7.0, yaw: -Math.PI / 3 },
];

const props = [
  ...CUBE_SMALL_PLACEMENTS.map((p, i) => propInstance(`cubeSmall${i}`, 'cube_small', p.x, p.z, { yaw: p.yaw })),
  ...CUBE_LARGE_PLACEMENTS.map((p, i) => propInstance(`cubeLarge${i}`, 'cube_large', p.x, p.z, { yaw: p.yaw })),
];

const robots = [
  actorInstance('robot0', ROBOT_ACTORS.one.id, -11, -11),
  actorInstance('robot1', ROBOT_ACTORS.ome.id, 11, -11),
];

const dummies = buildDummySpawnInstances(
  props,
  robots,
  [],
  [DUMMY_ACTORS.primary.id, DUMMY_ACTORS.altA.id, DUMMY_ACTORS.altB.id, DUMMY_ACTORS.altC.id],
  2,
  20260709,
  DEFAULT_NAV_GRID,
);

const definition: LevelDefinition = {
  id: 'testOne',
  displayName: 'Test Arena',
  navGrid: DEFAULT_NAV_GRID,
  index: {
    simpleProps: {},
    standardProps: indexById([getPropDefinition('cube_small'), getPropDefinition('cube_large')]),
    simpleActors: {},
    standardActors: indexById([ROBOT_ACTORS.one, ROBOT_ACTORS.ome, ...Object.values(DUMMY_ACTORS)]),
  },
  composition: {
    props,
    actors: [...robots, ...dummies],
    colliders: [],
  },
  playerSpawn: { position: [0, 1.6, 0], rotation: [0, 0, 0, 1] },
  groundPlane: { position: [0, 0, 0], size: 60, variant: 'blue' },
};

export const TEST_ONE: LevelBuild = {
  definition,
  aiPackages: withTestAi([...robots, ...dummies]),
};
