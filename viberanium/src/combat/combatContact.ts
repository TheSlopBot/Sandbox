import { type Collider, type ColliderShape } from '../components/collider.ts';
import { aabbIntersects } from '../collision/aabb.ts';
import { type Vec3 } from '../math/vec3.ts';

export type CombatOverlap = {
  a: Collider;
  b: Collider;
  distanceSq: number;
};

const shapeCenter = (shape: ColliderShape, out: Vec3): Vec3 => {
  out[0] = shape.center[0];
  out[1] = shape.center[1];
  out[2] = shape.center[2];
  return out;
};

const _ca: Vec3 = new Float32Array(3) as Vec3;
const _cb: Vec3 = new Float32Array(3) as Vec3;

const shapeRadiusApprox = (shape: ColliderShape): number => {
  if (shape.kind === 'sphere') return shape.radius;
  if (shape.kind === 'cylinder') return Math.hypot(shape.radius, shape.halfHeight);
  if (shape.kind === 'ellipsoid') {
    return Math.max(shape.radii[0], shape.radii[1], shape.radii[2]);
  }
  return Math.hypot(shape.halfExtents[0], shape.halfExtents[1], shape.halfExtents[2]);
};

export const shapesOverlapApprox = (a: ColliderShape, b: ColliderShape): boolean => {
  shapeCenter(a, _ca);
  shapeCenter(b, _cb);
  const dx = _ca[0] - _cb[0];
  const dy = _ca[1] - _cb[1];
  const dz = _ca[2] - _cb[2];
  const distSq = dx * dx + dy * dy + dz * dz;
  const r = shapeRadiusApprox(a) + shapeRadiusApprox(b);
  return distSq <= r * r;
};

export const collidersOverlap = (a: Collider, b: Collider): boolean => {
  if (!aabbIntersects(a.aabb, b.aabb)) return false;
  return shapesOverlapApprox(a.shape, b.shape);
};

export const colliderCenter = (collider: Collider, out: Vec3): Vec3 =>
  shapeCenter(collider.shape, out);

export const distanceSqBetweenColliders = (a: Collider, b: Collider): number => {
  shapeCenter(a.shape, _ca);
  shapeCenter(b.shape, _cb);
  const dx = _ca[0] - _cb[0];
  const dy = _ca[1] - _cb[1];
  const dz = _ca[2] - _cb[2];
  return dx * dx + dy * dy + dz * dz;
};

export const sweptSphereHitsAabb = (
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  radius: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  maxT: number,
): number => {
  const expandedMinX = minX - radius;
  const expandedMinY = minY - radius;
  const expandedMinZ = minZ - radius;
  const expandedMaxX = maxX + radius;
  const expandedMaxY = maxY + radius;
  const expandedMaxZ = maxZ + radius;

  let tMin = 0;
  let tMax = maxT;

  const axes: [number, number, number, number][] = [
    [ox, dx, expandedMinX, expandedMaxX],
    [oy, dy, expandedMinY, expandedMaxY],
    [oz, dz, expandedMinZ, expandedMaxZ],
  ];

  for (const [origin, dir, min, max] of axes) {
    if (Math.abs(dir) < 1e-8) {
      if (origin < min || origin > max) return -1;
      continue;
    }

    const inv = 1 / dir;
    let t0 = (min - origin) * inv;
    let t1 = (max - origin) * inv;
    if (t0 > t1) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    if (tMin > tMax) return -1;
  }

  return tMin >= 0 ? tMin : tMax >= 0 ? 0 : -1;
};
