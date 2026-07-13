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
  WOOD_PLANK_B,
  WORKBENCH_DECORATED,
} from '../assets/kaykit.ts';
import { buildSimpleProp } from './buildSimpleProp.ts';
import { type PropDefinition } from './propDefinition.ts';

export const CUBE_SMALL_PROP: PropDefinition = buildSimpleProp('cube_small', 'Small Cube', CUBE_SMALL, 'proto', {
  shape: 'box',
  halfExtents: [1, 1, 1],
  position: [0, 1, 0],
});

export const CUBE_LARGE_PROP: PropDefinition = buildSimpleProp('cube_large', 'Large Cube', CUBE_LARGE, 'proto_large', {
  shape: 'box',
  halfExtents: [2, 2, 2],
  position: [0, 2, 0],
});

export const BARREL_A_PROP: PropDefinition = buildSimpleProp('barrel_a', 'Barrel', BARREL_A, 'barrel_a', {
  shape: 'box',
  halfExtents: [0.5, 0.5, 0.5],
});

export const BOX_A_PROP: PropDefinition = buildSimpleProp('box_a', 'Box A', BOX_A, 'box_a', {
  shape: 'box',
  halfExtents: [0.228, 0.254, 0.232],
  position: [0, 0.254, 0.004],
});

export const BOX_C_PROP: PropDefinition = buildSimpleProp('box_c', 'Box C', BOX_C, 'box_c', {
  shape: 'box',
  halfExtents: [0.4, 0.201, 0.303],
  position: [0, 0.201, 0.003],
});

export const DUMMY_BASE_PROP: PropDefinition = buildSimpleProp('dummy_base', 'Dummy Base', DUMMY_BASE, 'dummy_base', {
  shape: 'box',
  halfExtents: [0.971, 1.099, 0.497],
  position: [0, 1.099, 0.047],
});

export const LOCKER_PROP: PropDefinition = buildSimpleProp('locker', 'Locker', LOCKER, 'locker', {
  shape: 'box',
  halfExtents: [0.5, 1.5, 0.54],
  position: [0, 1.5, 0.04],
});

export const PALLET_SMALL_A_PROP: PropDefinition = buildSimpleProp(
  'pallet_small_a',
  'Small Pallet A',
  PALLET_SMALL_DECORATED_A,
  'pallet_small_a',
  { shape: 'box', halfExtents: [1, 0.75, 1], position: [0, 0.75, 0] },
);

export const PALLET_SMALL_B_PROP: PropDefinition = buildSimpleProp(
  'pallet_small_b',
  'Small Pallet B',
  PALLET_SMALL_DECORATED_B,
  'pallet_small_b',
  { shape: 'box', halfExtents: [1, 1.5, 1], position: [0, 1.5, 0] },
);

export const TABLE_MEDIUM_PROP: PropDefinition = buildSimpleProp(
  'table_medium',
  'Medium Table',
  TABLE_MEDIUM_DECORATED,
  'table_medium',
  { shape: 'box', halfExtents: [1, 0.854, 0.75], position: [0, 0.854, 0] },
);

export const TARGET_STAND_A_PROP: PropDefinition = buildSimpleProp(
  'target_stand_a',
  'Target Stand A',
  TARGET_STAND_A_DECORATED,
  'target_stand_a',
  { shape: 'box', halfExtents: [0.97, 1.221, 0.75], position: [-0.001, 1.221, -0.35] },
);

export const WALL_WINDOW_OPEN_PROP: PropDefinition = buildSimpleProp(
  'wall_window_open',
  'Wall Window Open',
  WALL_WINDOW_OPEN,
  'wall_window_open',
  { shape: 'box', halfExtents: [2, 2, 0.265], position: [0, 2, 0.015] },
);

export const WEAPONRACK_PROP: PropDefinition = buildSimpleProp(
  'weaponrack',
  'Weapon Rack',
  WEAPONRACK_DECORATED,
  'weaponrack',
  { shape: 'box', halfExtents: [0.7, 0.907, 0.473], position: [0, 0.907, 0.16] },
);

export const WORKBENCH_PROP: PropDefinition = buildSimpleProp(
  'workbench',
  'Workbench',
  WORKBENCH_DECORATED,
  'workbench',
  { shape: 'box', halfExtents: [1.5, 1.3, 0.75], position: [0, 1.3, 0] },
);

export const PLANK_PROP: PropDefinition = {
  id: 'plank',
  displayName: 'Plank',
  parts: [
    {
      id: 'plank_mesh',
      kind: 'asset',
      url: WOOD_PLANK_B,
      materialPrefix: 'prop',
      tags: [],
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [3, 1, 4],
    },
    {
      id: 'plank_collider',
      kind: 'collider',
      shape: 'box',
      halfExtents: [0.5, 0.5, 0.5],
      position: [0, 0.07782703638076782, 0],
      rotation: [0, 0, 0, 1],
      scale: [1.2000000476837158, 0.13639314472675323, 6],
    },
  ],
};

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
  PLANK_PROP,
];
