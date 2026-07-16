import { type LevelDefinition } from './levelDefinition.ts';
import { type LevelBuild } from './levelSeed.ts';
import {
  MIXED_HALF_EXTENT,
  MIXED_NAV_GRID,
  buildCombatMechPerfInstances,
  buildDummyPerfInstances,
  buildRobotPerfInstances,
  buildScatteredPropInstancesTotal,
  indexById,
  withTestAi,
} from './helpers.ts';
import { getPropDefinition, PROP_STRESS_IDS } from '../props/registry.ts';
import { COMBAT_MECH_ACTORS, DUMMY_ACTORS, ROBOT_ONE_ACTOR } from '../actors/kaykitActors.ts';

const props = buildScatteredPropInstancesTotal(PROP_STRESS_IDS, 500, MIXED_HALF_EXTENT, 20260711);

const robots = buildRobotPerfInstances(64, ROBOT_ONE_ACTOR.id, MIXED_NAV_GRID, 20260711);

const combatMechs = buildCombatMechPerfInstances(
  68,
  { primary: COMBAT_MECH_ACTORS.primary.id, alt: COMBAT_MECH_ACTORS.alt.id },
  MIXED_NAV_GRID,
  20260712,
);

const dummies = buildDummyPerfInstances(
  68,
  [DUMMY_ACTORS.primary.id, DUMMY_ACTORS.altA.id, DUMMY_ACTORS.altB.id, DUMMY_ACTORS.altC.id],
  MIXED_NAV_GRID,
  20260713,
);

const actors = [...robots, ...combatMechs, ...dummies];

const definition: LevelDefinition = {
  id: 'testFour',
  displayName: 'Mixed Stress Test',
  navGrid: MIXED_NAV_GRID,
  index: {
    simpleProps: {},
    standardProps: indexById(PROP_STRESS_IDS.map((id) => getPropDefinition(id))),
    simpleActors: {},
    standardActors: indexById([
      ROBOT_ONE_ACTOR,
      ...Object.values(COMBAT_MECH_ACTORS),
      ...Object.values(DUMMY_ACTORS),
    ]),
  },
  composition: {
    props,
    actors,
    colliders: [],
  },
  playerSpawn: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
  groundPlane: { position: [0, 0, 0], size: 60, variant: 'blue' },
};

export const TEST_FOUR: LevelBuild = {
  definition,
  aiPackages: withTestAi(actors),
};
