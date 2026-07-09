import {
  BARREL_A,
  BOX_A,
  BOX_C,
  CUBE_SMALL,
  DUMMY_BASE,
  LOCKER,
  PALLET_SMALL_DECORATED_A,
  PALLET_SMALL_DECORATED_B,
  TABLE_MEDIUM_DECORATED,
  TARGET_STAND_A_DECORATED,
  WALL_WINDOW_OPEN,
  WEAPONRACK_DECORATED,
  WORKBENCH_DECORATED,
} from '../assets/kaykit.ts';
import { type LevelDefinition } from './levelDefinition.ts';
import { GROUND_HALF_EXTENT, buildScatteredPropSpawns } from './helpers.ts';

const PROP_STRESS_ASSETS = [
  { url: BARREL_A, prefix: 'barrel_a' },
  { url: BOX_A, prefix: 'box_a' },
  { url: BOX_C, prefix: 'box_c' },
  { url: CUBE_SMALL, prefix: 'cube_small' },
  { url: DUMMY_BASE, prefix: 'dummy_base' },
  { url: LOCKER, prefix: 'locker' },
  { url: PALLET_SMALL_DECORATED_A, prefix: 'pallet_small_a' },
  { url: PALLET_SMALL_DECORATED_B, prefix: 'pallet_small_b' },
  { url: TABLE_MEDIUM_DECORATED, prefix: 'table_medium' },
  { url: TARGET_STAND_A_DECORATED, prefix: 'target_stand_a' },
  { url: WALL_WINDOW_OPEN, prefix: 'wall_window_open' },
  { url: WEAPONRACK_DECORATED, prefix: 'weaponrack' },
  { url: WORKBENCH_DECORATED, prefix: 'workbench' },
] as const;

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
  props: buildScatteredPropSpawns(PROP_STRESS_ASSETS, 160, GROUND_HALF_EXTENT, 20260710),
};
