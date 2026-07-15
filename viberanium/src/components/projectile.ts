import { type EntityId } from '../engine/entity.ts';

export type Projectile = {
  ownerId: EntityId;
  damage: number;
  velocity: [number, number, number];
  lifetime: number;
  radius: number;
};

export const createProjectile = (opts: {
  ownerId: EntityId;
  damage: number;
  velocity: [number, number, number];
  lifetime?: number;
  radius?: number;
}): Projectile => ({
  ownerId: opts.ownerId,
  damage: opts.damage,
  velocity: [...opts.velocity] as [number, number, number],
  lifetime: opts.lifetime ?? 2.5,
  radius: opts.radius ?? 0.12,
});
