import { type LevelDefinition } from './levelDefinition.ts';
import { DEFAULT_NAV_GRID, buildCombatMechPerfSpawns } from './helpers.ts';

export const TEST_TWO: LevelDefinition = {
  id: 'testTwo',
  displayName: 'Test Corridor',
  navGrid: DEFAULT_NAV_GRID,
  props: [
    { propId: 'cube_small', x: -10.0, z: 0.0 },
    { propId: 'cube_small', x: -7.5, z: 0.0 },
    { propId: 'cube_small', x: -5.0, z: 0.0 },
    { propId: 'cube_small', x: -2.5, z: 0.0 },
    { propId: 'cube_small', x: 0.0, z: 0.0, yaw: Math.PI / 4 },
    { propId: 'cube_small', x: 2.5, z: 0.0 },
    { propId: 'cube_small', x: 5.0, z: 0.0 },
    { propId: 'cube_small', x: 7.5, z: 0.0 },
    { propId: 'cube_small', x: 10.0, z: 0.0 },
    { propId: 'cube_small', x: 0.0, z: -5.0 },
    { propId: 'cube_small', x: 0.0, z: 5.0 },
    { propId: 'cube_large', x: 0.0, z: -10.0, yaw: Math.PI / 2 },
    { propId: 'cube_large', x: 0.0, z: 10.0, yaw: -Math.PI / 2 },
    { propId: 'cube_large', x: -12.0, z: 8.0, yaw: Math.PI / 3 },
  ],
  combatMechs: buildCombatMechPerfSpawns(100),
};