import { type LevelDefinition } from './levelDefinition.ts';
import { type LevelBuild } from './levelSeed.ts';
import { DEFAULT_NAV_GRID, buildCombatMechPerfInstances, indexById, propInstance, withTestAi } from './helpers.ts';
import { getPropDefinition } from '../props/registry.ts';
import { COMBAT_MECH_ACTORS } from '../actors/kaykitActors.ts';

const CORRIDOR_PLACEMENTS: Array<{ propId: string; x: number; z: number; yaw?: number }> = [
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
];

const props = CORRIDOR_PLACEMENTS.map((p, i) => propInstance(`prop${i}`, p.propId, p.x, p.z, { yaw: p.yaw }));

const combatMechs = buildCombatMechPerfInstances(100, {
  primary: COMBAT_MECH_ACTORS.primary.id,
  alt: COMBAT_MECH_ACTORS.alt.id,
});

const definition: LevelDefinition = {
  id: 'testTwo',
  displayName: 'Test Corridor',
  navGrid: DEFAULT_NAV_GRID,
  index: {
    simpleProps: {},
    standardProps: indexById([getPropDefinition('cube_small'), getPropDefinition('cube_large')]),
    simpleActors: {},
    standardActors: indexById(Object.values(COMBAT_MECH_ACTORS)),
  },
  composition: {
    props,
    actors: combatMechs,
    colliders: [],
  },
  playerSpawn: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
  groundPlane: { position: [0, 0, 0], size: 60, variant: 'blue' },
};

export const TEST_TWO: LevelBuild = {
  definition,
  aiPackages: withTestAi(combatMechs),
};
