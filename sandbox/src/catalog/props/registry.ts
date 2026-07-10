import { KAYKIT_PROPS } from './kaykitProps.ts';
import { type PropDefinition } from './propDefinition.ts';

export const PROP_CATALOG: Record<string, PropDefinition> = Object.fromEntries(
  KAYKIT_PROPS.map((def) => [def.id, def]),
);

export const getPropDefinition = (id: string): PropDefinition => {
  const def = PROP_CATALOG[id];

  if (!def) throw new Error(`Unknown prop: ${id}`);

  return def;
};

export const PROP_STRESS_IDS: readonly string[] = [
  'barrel_a',
  'box_a',
  'box_c',
  'cube_small',
  'dummy_base',
  'locker',
  'pallet_small_a',
  'pallet_small_b',
  'table_medium',
  'target_stand_a',
  'wall_window_open',
  'weaponrack',
  'workbench',
];
