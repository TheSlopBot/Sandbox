import { type Aabb, type ObbY, type Collider } from '../components/collider.ts';
import { type Transform } from '../components/transform.ts';
import { aabbOverlapsAabbXZ } from './aabb.ts';

const SURFACE_EPS = 0.02;

export const rotateY = (x: number, z: number, yaw: number): { x: number; z: number } => {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
};

export const obbIntersectsAabb = (obb: ObbY, aabb: Aabb): boolean => {
  const cx = (aabb.min[0] + aabb.max[0]) * 0.5;
  const cy = (aabb.min[1] + aabb.max[1]) * 0.5;
  const cz = (aabb.min[2] + aabb.max[2]) * 0.5;
  const hx = (aabb.max[0] - aabb.min[0]) * 0.5;
  const hy = (aabb.max[1] - aabb.min[1]) * 0.5;
  const hz = (aabb.max[2] - aabb.min[2]) * 0.5;

  const relX = cx - obb.center[0];
  const relZ = cz - obb.center[2];
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const px = relX * c - relZ * s;
  const pz = relX * s + relZ * c;

  const projHx = Math.abs(c) * hx + Math.abs(s) * hz;
  const projHz = Math.abs(s) * hx + Math.abs(c) * hz;

  return (
    Math.abs(px) <= obb.halfExtents[0] + projHx &&
    Math.abs(pz) <= obb.halfExtents[2] + projHz &&
    Math.abs(cy - obb.center[1]) <= obb.halfExtents[1] + hy
  );
};

export const aabbOverlapsObbXZ = (obb: ObbY, posX: number, posZ: number, hx: number, hz: number): boolean => {
  const relX = posX - obb.center[0];
  const relZ = posZ - obb.center[2];
  const p = rotateY(relX, relZ, -obb.yaw);

  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const projHx = Math.abs(c) * hx + Math.abs(s) * hz;
  const projHz = Math.abs(s) * hx + Math.abs(c) * hz;

  return Math.abs(p.x) <= obb.halfExtents[0] + projHx && Math.abs(p.z) <= obb.halfExtents[2] + projHz;
};

export const hasHorizontalSupport = (
  collider: Collider,
  posX: number,
  posZ: number,
  hx: number,
  hz: number,
): boolean =>
  collider.obbY
    ? aabbOverlapsObbXZ(collider.obbY, posX, posZ, hx, hz)
    : aabbOverlapsAabbXZ(collider.aabb, posX, posZ, hx, hz);

export const resolveAabbVsObbHorizontal = (
  posX: number,
  posZ: number,
  hx: number,
  hz: number,
  obb: ObbY,
): { x: number; z: number } => {
  const relX = posX - obb.center[0];
  const relZ = posZ - obb.center[2];
  const p = rotateY(relX, relZ, -obb.yaw);

  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const projHx = Math.abs(c) * hx + Math.abs(s) * hz;
  const projHz = Math.abs(s) * hx + Math.abs(c) * hz;

  const px = obb.halfExtents[0] + projHx - Math.abs(p.x);
  const pz = obb.halfExtents[2] + projHz - Math.abs(p.z);

  if (px <= 0 || pz <= 0) return { x: posX, z: posZ };

  let pushLocalX = 0;
  let pushLocalZ = 0;
  if (px < pz) pushLocalX = p.x >= 0 ? px : -px;
  else pushLocalZ = p.z >= 0 ? pz : -pz;

  const pushWorld = rotateY(pushLocalX, pushLocalZ, obb.yaw);
  return { x: posX + pushWorld.x, z: posZ + pushWorld.z };
};

export const getSupportSurfaceY = (
  t: Transform,
  statics: Collider[],
  hx: number,
  hy: number,
  hz: number,
): number | null => {
  const footY = t.position[1] - hy;
  if (footY <= SURFACE_EPS) return 0;

  let bestTop = -Infinity;
  for (const s of statics) {
    if (!hasHorizontalSupport(s, t.position[0], t.position[2], hx, hz)) continue;
    const top = s.obbY ? s.obbY.center[1] + s.obbY.halfExtents[1] : s.aabb.max[1];
    if (top > bestTop) bestTop = top;
  }

  if (bestTop === -Infinity) return null;
  if (footY >= bestTop - SURFACE_EPS && footY <= bestTop + SURFACE_EPS) return bestTop;
  return null;
};
