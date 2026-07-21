import { type EntityId } from '../engine/entity.ts';

export type Projectile = {
  ownerId: EntityId;
  damage: number;
  velocity: [number, number, number];
  origin: [number, number, number];
  maxDistance: number;
  radius: number;
};

export const createProjectile = (opts: {
  ownerId: EntityId;
  damage: number;
  velocity: [number, number, number];
  origin: [number, number, number];
  maxDistance?: number;
  radius?: number;
}): Projectile => ({
  ownerId: opts.ownerId,
  damage: opts.damage,
  velocity: [...opts.velocity] as [number, number, number],
  origin: [...opts.origin] as [number, number, number],
  maxDistance: opts.maxDistance ?? 100,
  radius: opts.radius ?? 0.12,
});
