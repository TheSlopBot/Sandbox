import { type LevelDefinition } from './levelDefinition.ts';
import {
  MIXED_HALF_EXTENT,
  MIXED_NAV_GRID,
  buildCombatMechPerfSpawns,
  buildDummyPerfSpawns,
  buildRobotPerfSpawns,
  buildScatteredPropSpawnsTotal,
} from './helpers.ts';
import { PROP_STRESS_IDS } from '../props/registry.ts';

export const TEST_FOUR: LevelDefinition = {
  id: 'testFour',
  displayName: 'Mixed Stress Test',
  navGrid: MIXED_NAV_GRID,
  props: buildScatteredPropSpawnsTotal(PROP_STRESS_IDS, 500, MIXED_HALF_EXTENT, 20260711),
  robots: buildRobotPerfSpawns(64, MIXED_NAV_GRID, 20260711),
  combatMechs: buildCombatMechPerfSpawns(68, MIXED_NAV_GRID, 20260712),
  dummies: buildDummyPerfSpawns(68, MIXED_NAV_GRID, 20260713),
};
