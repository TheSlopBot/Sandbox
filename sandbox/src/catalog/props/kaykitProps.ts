import {
  BARREL_A,
  BOX_A,
  BOX_C,
  CUBE_LARGE,
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
import { buildSimpleProp } from './buildSimpleProp.ts';
import { type PropDefinition } from './propDefinition.ts';

export const CUBE_SMALL_PROP: PropDefinition = buildSimpleProp('cube_small', 'Small Cube', CUBE_SMALL, 'proto', {
  shape: 'box',
  halfExtents: [0.5, 0.5, 0.5],
});

export const CUBE_LARGE_PROP: PropDefinition = buildSimpleProp('cube_large', 'Large Cube', CUBE_LARGE, 'proto_large', {
  shape: 'box',
  halfExtents: [1.25, 1.25, 1.25],
});

export const BARREL_A_PROP: PropDefinition = buildSimpleProp('barrel_a', 'Barrel', BARREL_A, 'barrel_a', {
  shape: 'cylinder',
  radius: 0.35,
  halfHeight: 0.55,
});

export const BOX_A_PROP: PropDefinition = buildSimpleProp('box_a', 'Box A', BOX_A, 'box_a', {
  shape: 'box',
  halfExtents: [0.6, 0.6, 0.6],
});

export const BOX_C_PROP: PropDefinition = buildSimpleProp('box_c', 'Box C', BOX_C, 'box_c', {
  shape: 'box',
  halfExtents: [0.6, 0.6, 0.6],
});

export const DUMMY_BASE_PROP: PropDefinition = buildSimpleProp('dummy_base', 'Dummy Base', DUMMY_BASE, 'dummy_base', {
  shape: 'box',
  halfExtents: [0.6, 0.6, 0.6],
});

export const LOCKER_PROP: PropDefinition = buildSimpleProp('locker', 'Locker', LOCKER, 'locker', {
  shape: 'box',
  halfExtents: [0.8, 0.5, 0.8],
});

export const PALLET_SMALL_A_PROP: PropDefinition = buildSimpleProp(
  'pallet_small_a',
  'Small Pallet A',
  PALLET_SMALL_DECORATED_A,
  'pallet_small_a',
  { shape: 'box', halfExtents: [0.8, 0.5, 0.8] },
);

export const PALLET_SMALL_B_PROP: PropDefinition = buildSimpleProp(
  'pallet_small_b',
  'Small Pallet B',
  PALLET_SMALL_DECORATED_B,
  'pallet_small_b',
  { shape: 'box', halfExtents: [0.8, 0.5, 0.8] },
);

export const TABLE_MEDIUM_PROP: PropDefinition = buildSimpleProp(
  'table_medium',
  'Medium Table',
  TABLE_MEDIUM_DECORATED,
  'table_medium',
  { shape: 'box', halfExtents: [0.8, 0.5, 0.8] },
);

export const TARGET_STAND_A_PROP: PropDefinition = buildSimpleProp(
  'target_stand_a',
  'Target Stand A',
  TARGET_STAND_A_DECORATED,
  'target_stand_a',
  { shape: 'box', halfExtents: [0.6, 0.6, 0.6] },
);

export const WALL_WINDOW_OPEN_PROP: PropDefinition = buildSimpleProp(
  'wall_window_open',
  'Wall Window Open',
  WALL_WINDOW_OPEN,
  'wall_window_open',
  { shape: 'box', halfExtents: [0.6, 0.6, 0.6] },
);

export const WEAPONRACK_PROP: PropDefinition = buildSimpleProp(
  'weaponrack',
  'Weapon Rack',
  WEAPONRACK_DECORATED,
  'weaponrack',
  { shape: 'box', halfExtents: [0.8, 0.5, 0.8] },
);

export const WORKBENCH_PROP: PropDefinition = buildSimpleProp(
  'workbench',
  'Workbench',
  WORKBENCH_DECORATED,
  'workbench',
  { shape: 'box', halfExtents: [0.8, 0.5, 0.8] },
);

export const KAYKIT_PROPS: readonly PropDefinition[] = [
  CUBE_SMALL_PROP,
  CUBE_LARGE_PROP,
  BARREL_A_PROP,
  BOX_A_PROP,
  BOX_C_PROP,
  DUMMY_BASE_PROP,
  LOCKER_PROP,
  PALLET_SMALL_A_PROP,
  PALLET_SMALL_B_PROP,
  TABLE_MEDIUM_PROP,
  TARGET_STAND_A_PROP,
  WALL_WINDOW_OPEN_PROP,
  WEAPONRACK_PROP,
  WORKBENCH_PROP,
];
