import { type LevelDefinition } from './levelDefinition.ts';
import { type LevelBuild } from './levelSeed.ts';
import { GROUND_NAV_GRID, GROUND_HALF_EXTENT, buildScatteredPropInstances, indexById } from './helpers.ts';
import { getPropDefinition, PROP_STRESS_IDS } from '../props/registry.ts';

const props = buildScatteredPropInstances(PROP_STRESS_IDS, 160, GROUND_HALF_EXTENT, 20260710);

const definition: LevelDefinition = {
  id: 'testThree',
  displayName: 'Prop Stress Test',
  navGrid: GROUND_NAV_GRID,
  index: {
    simpleProps: {},
    standardProps: indexById(PROP_STRESS_IDS.map((id) => getPropDefinition(id))),
    simpleActors: {},
    standardActors: {},
  },
  composition: {
    props,
    actors: [],
    colliders: [],
  },
  playerSpawn: { position: [0, 1.6, 0], rotation: [0, 0, 0, 1] },
  groundPlane: { position: [0, 0, 0], size: 60, variant: 'blue' },
};

export const TEST_THREE: LevelBuild = {
  definition,
  aiPackages: {},
};
