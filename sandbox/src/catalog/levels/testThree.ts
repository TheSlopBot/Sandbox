import { type LevelDefinition } from './levelDefinition.ts';
import { GROUND_HALF_EXTENT, GROUND_NAV_GRID, buildScatteredPropSpawns } from './helpers.ts';
import { PROP_STRESS_IDS } from '../props/registry.ts';

export const TEST_THREE: LevelDefinition = {
  id: 'testThree',
  displayName: 'Prop Stress Test',
  navGrid: GROUND_NAV_GRID,
  props: buildScatteredPropSpawns(PROP_STRESS_IDS, 160, GROUND_HALF_EXTENT, 20260710),
};
