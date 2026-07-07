import { type Aabb } from '../components/collider.ts';

export const aabbIntersects = (a: Aabb, b: Aabb): boolean =>
  a.min[0] <= b.max[0] &&
  a.max[0] >= b.min[0] &&
  a.min[1] <= b.max[1] &&
  a.max[1] >= b.min[1] &&
  a.min[2] <= b.max[2] &&
  a.max[2] >= b.min[2];

export const aabbOverlapsYStrict = (a: Aabb, b: Aabb, eps = 1e-4): boolean =>
  a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps;

export const aabbOverlapsAabbXZ = (a: Aabb, posX: number, posZ: number, hx: number, hz: number): boolean =>
  posX - hx <= a.max[0] && posX + hx >= a.min[0] && posZ - hz <= a.max[2] && posZ + hz >= a.min[2];

export const makeAabb = (
  posX: number, posY: number, posZ: number,
  hx: number, hy: number, hz: number,
): Aabb => ({
  min: new Float32Array([posX - hx, posY - hy, posZ - hz]),
  max: new Float32Array([posX + hx, posY + hy, posZ + hz]),
});
