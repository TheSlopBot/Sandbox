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

export const rayAabbDistance = (
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  maxDist: number,
): number => {
  const invX = dx !== 0 ? 1 / dx : Number.POSITIVE_INFINITY;
  const invY = dy !== 0 ? 1 / dy : Number.POSITIVE_INFINITY;
  const invZ = dz !== 0 ? 1 / dz : Number.POSITIVE_INFINITY;

  let tMin = ((invX >= 0 ? minX : maxX) - ox) * invX;
  let tMax = ((invX >= 0 ? maxX : minX) - ox) * invX;

  const tyMin = ((invY >= 0 ? minY : maxY) - oy) * invY;
  const tyMax = ((invY >= 0 ? maxY : minY) - oy) * invY;
  if (tMin > tyMax || tyMin > tMax) return Number.POSITIVE_INFINITY;
  if (tyMin > tMin) tMin = tyMin;
  if (tyMax < tMax) tMax = tyMax;

  const tzMin = ((invZ >= 0 ? minZ : maxZ) - oz) * invZ;
  const tzMax = ((invZ >= 0 ? maxZ : minZ) - oz) * invZ;
  if (tMin > tzMax || tzMin > tMax) return Number.POSITIVE_INFINITY;
  if (tzMin > tMin) tMin = tzMin;
  if (tzMax < tMax) tMax = tzMax;

  if (tMax < 0 || tMin > maxDist) return Number.POSITIVE_INFINITY;
  return tMin >= 0 ? tMin : 0;
};

export const rayAabbHitNormal = (
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  tHit: number,
): { nx: number; ny: number; nz: number } => {
  const px = ox + dx * tHit;
  const py = oy + dy * tHit;
  const pz = oz + dz * tHit;
  const eps = 1e-4;

  if (Math.abs(px - minX) <= eps) return { nx: -1, ny: 0, nz: 0 };
  if (Math.abs(px - maxX) <= eps) return { nx: 1, ny: 0, nz: 0 };
  if (Math.abs(py - minY) <= eps) return { nx: 0, ny: -1, nz: 0 };
  if (Math.abs(py - maxY) <= eps) return { nx: 0, ny: 1, nz: 0 };
  if (Math.abs(pz - minZ) <= eps) return { nx: 0, ny: 0, nz: -1 };
  if (Math.abs(pz - maxZ) <= eps) return { nx: 0, ny: 0, nz: 1 };

  const toMinX = Math.abs(px - minX);
  const toMaxX = Math.abs(px - maxX);
  const toMinY = Math.abs(py - minY);
  const toMaxY = Math.abs(py - maxY);
  const toMinZ = Math.abs(pz - minZ);
  const toMaxZ = Math.abs(pz - maxZ);
  const m = Math.min(toMinX, toMaxX, toMinY, toMaxY, toMinZ, toMaxZ);
  if (m === toMinX) return { nx: -1, ny: 0, nz: 0 };
  if (m === toMaxX) return { nx: 1, ny: 0, nz: 0 };
  if (m === toMinY) return { nx: 0, ny: -1, nz: 0 };
  if (m === toMaxY) return { nx: 0, ny: 1, nz: 0 };
  if (m === toMinZ) return { nx: 0, ny: 0, nz: -1 };
  return { nx: 0, ny: 0, nz: 1 };
};
