import { type LevelDefinition } from './levelDefinition.ts';
import { GROUND_HALF_EXTENT, buildScatteredPropSpawns } from './helpers.ts';
import { PROP_STRESS_IDS } from '../props/registry.ts';

export const TEST_THREE: LevelDefinition = {
  id: 'testThree',
  displayName: 'Prop Stress Test',
  navGrid: {
    minX: -GROUND_HALF_EXTENT,
    maxX: GROUND_HALF_EXTENT,
    minZ: -GROUND_HALF_EXTENT,
    maxZ: GROUND_HALF_EXTENT,
    cellSize: 2,
  },
  props: buildScatteredPropSpawns(PROP_STRESS_IDS, 160, GROUND_HALF_EXTENT, 20260710),
};