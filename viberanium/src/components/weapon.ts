export type WeaponKind = 'melee' | 'gun' | 'shield' | 'projectile';

export type WeaponRuntimeState = 'idle' | 'attacking' | 'aiming' | 'reloading' | 'blocking';

export type Weapon = {
  defId: string;
  kind: WeaponKind;
  slot: 'right' | 'left';
  state: WeaponRuntimeState;
  stateTime: number;
  damage: number;
  hitWindowStart: number;
  hitWindowEnd: number;
  attackSpeed: number;
  fireRate: number;
  projectileSpeed: number;
  blockAngleDeg: number;
  hitConsumed: Set<number>;
  swingOrigin: [number, number, number];
  hitboxEntityId: number | null;
  cooldownRemaining: number;
};

export const createWeapon = (opts: {
  defId: string;
  kind: WeaponKind;
  slot: 'right' | 'left';
  damage?: number;
  hitWindowStart?: number;
  hitWindowEnd?: number;
  attackSpeed?: number;
  fireRate?: number;
  projectileSpeed?: number;
  blockAngleDeg?: number;
}): Weapon => ({
  defId: opts.defId,
  kind: opts.kind,
  slot: opts.slot,
  state: 'idle',
  stateTime: 0,
  damage: opts.damage ?? 10,
  hitWindowStart: opts.hitWindowStart ?? 0.2,
  hitWindowEnd: opts.hitWindowEnd ?? 0.55,
  attackSpeed: opts.attackSpeed ?? 1,
  fireRate: opts.fireRate ?? 0.35,
  projectileSpeed: opts.projectileSpeed ?? 25,
  blockAngleDeg: opts.blockAngleDeg ?? 90,
  hitConsumed: new Set(),
  swingOrigin: [0, 0, 0],
  hitboxEntityId: null,
  cooldownRemaining: 0,
});
