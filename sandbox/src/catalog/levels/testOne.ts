import { type LevelDefinition } from './levelDefinition.ts';
import { DEFAULT_NAV_GRID, buildDummySpawns } from './helpers.ts';

const LEVEL_TEST_PROPS = [
  { propId: 'cube_small', x: -7.5, z: -2.0 },
  { propId: 'cube_small', x: -4.2, z: -8.0, yaw: Math.PI / 6 },
  { propId: 'cube_small', x: -1.0, z: -4.5, yaw: Math.PI / 3 },
  { propId: 'cube_small', x: 2.8, z: -9.5, yaw: Math.PI / 2 },
  { propId: 'cube_small', x: 6.7, z: -5.8, yaw: (2 * Math.PI) / 3 },
  { propId: 'cube_small', x: 8.5, z: 1.2, yaw: (5 * Math.PI) / 6 },
  { propId: 'cube_small', x: 3.3, z: 4.8, yaw: Math.PI },
  { propId: 'cube_small', x: -2.6, z: 6.4, yaw: (7 * Math.PI) / 6 },
  { propId: 'cube_small', x: -6.8, z: 3.0, yaw: (4 * Math.PI) / 3 },
  { propId: 'cube_small', x: 5.8, z: -1.0, yaw: (3 * Math.PI) / 2 },
  { propId: 'cube_large', x: 5.5, z: -13.5, yaw: Math.PI / 7 },
  { propId: 'cube_large', x: 14.0, z: 4.5, yaw: -Math.PI / 5 },
  { propId: 'cube_large', x: -11.5, z: 7.0, yaw: -Math.PI / 3 },
];

const LEVEL_TEST_ROBOTS = [
  { x: -11, z: -11, variant: 'one' as const },
  { x: 11, z: -11, variant: 'ome' as const },
];

export const TEST_ONE: LevelDefinition = {
  id: 'testOne',
  displayName: 'Test Arena',
  navGrid: DEFAULT_NAV_GRID,
  props: LEVEL_TEST_PROPS,
  robots: LEVEL_TEST_ROBOTS,
  dummies: buildDummySpawns(LEVEL_TEST_PROPS, LEVEL_TEST_ROBOTS, undefined, undefined, 2, 20260709),
};
