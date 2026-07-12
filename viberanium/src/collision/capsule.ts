import { type Collider, type ColliderShape, type Aabb } from '../components/collider.ts';
import { type Quat, q4Conjugate, q4TransformVec3 } from '../math/quat.ts';
import { type Vec3, v3 } from '../math/vec3.ts';
import { aabbIntersects } from './aabb.ts';

export type CapsuleY = {
  x: number;
  y: number;
  z: number;
  radius: number;
  halfHeight: number;
};

const SURFACE_EPS = 0.02;
const SURFACE_SNAP = 0.12;
const _local = v3();
const _tmpQ = new Float32Array(4) as Quat;
const _toPoint = v3();

export const capsuleToAabb = (capsule: CapsuleY, out: Aabb): Aabb => {
  const extY = capsule.halfHeight + capsule.radius;
  out.min[0] = capsule.x - capsule.radius;
  out.min[1] = capsule.y - extY;
  out.min[2] = capsule.z - capsule.radius;
  out.max[0] = capsule.x + capsule.radius;
  out.max[1] = capsule.y + extY;
  out.max[2] = capsule.z + capsule.radius;
  return out;
};

const yawFromQuat = (q: Quat): number => {
  const siny = 2 * (q[3]! * q[1]! + q[0]! * q[2]!);
  const cosy = 1 - 2 * (q[1]! * q[1]! + q[0]! * q[0]!);
  return Math.atan2(siny, cosy);
};

const rotateY = (x: number, z: number, yaw: number): { x: number; z: number } => {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
};

const resolveCircleVsAabbXZ = (
  x: number,
  z: number,
  radius: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): { x: number; z: number } | null => {
  const cx = Math.max(minX, Math.min(maxX, x));
  const cz = Math.max(minZ, Math.min(maxZ, z));
  let dx = x - cx;
  let dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius && d2 > 1e-12) return null;

  if (d2 < 1e-12) {
    const penLeft = x - minX + radius;
    const penRight = maxX - x + radius;
    const penNear = z - minZ + radius;
    const penFar = maxZ - z + radius;
    const minPen = Math.min(penLeft, penRight, penNear, penFar);
    if (minPen === penLeft) return { x: minX - radius - 1e-3, z };
    if (minPen === penRight) return { x: maxX + radius + 1e-3, z };
    if (minPen === penNear) return { x, z: minZ - radius - 1e-3 };
    return { x, z: maxZ + radius + 1e-3 };
  }

  const d = Math.sqrt(d2);
  const push = (radius - d) / d + 1e-3 / d;
  return { x: x + dx * push, z: z + dz * push };
};

const resolveCircleVsOrientedBoxXZ = (
  x: number,
  z: number,
  radius: number,
  center: Vec3,
  halfExtents: Vec3,
  rotation: Quat,
): { x: number; z: number } | null => {
  const yaw = yawFromQuat(rotation);
  const rel = rotateY(x - center[0], z - center[2], -yaw);
  const resolved = resolveCircleVsAabbXZ(
    rel.x,
    rel.z,
    radius,
    -halfExtents[0],
    halfExtents[0],
    -halfExtents[2],
    halfExtents[2],
  );
  if (!resolved) return null;

  const world = rotateY(resolved.x, resolved.z, yaw);
  return { x: center[0] + world.x, z: center[2] + world.z };
};

const resolveCircleVsCircleXZ = (
  x: number,
  z: number,
  radius: number,
  cx: number,
  cz: number,
  otherR: number,
): { x: number; z: number } | null => {
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  const minDist = radius + otherR;
  if (d2 >= minDist * minDist) return null;

  if (d2 < 1e-12) return { x: cx + minDist + 1e-3, z: cz };

  const d = Math.sqrt(d2);
  const push = (minDist - d) / d + 1e-3 / d;
  return { x: x + dx * push, z: z + dz * push };
};

const footprintOverlaps = (
  shape: ColliderShape,
  x: number,
  z: number,
  radius: number,
): boolean => {
  if (shape.kind === 'box') {
    const yaw = yawFromQuat(shape.rotation);
    const rel = rotateY(x - shape.center[0], z - shape.center[2], -yaw);
    const hx = shape.halfExtents[0] + radius;
    const hz = shape.halfExtents[2] + radius;
    return Math.abs(rel.x) <= hx && Math.abs(rel.z) <= hz;
  }

  if (shape.kind === 'cylinder' || shape.kind === 'capsule') {
    q4Conjugate(_tmpQ, shape.rotation);
    _toPoint[0] = x - shape.center[0];
    _toPoint[1] = 0;
    _toPoint[2] = z - shape.center[2];
    q4TransformVec3(_local, _tmpQ, _toPoint);
    const dist = Math.hypot(_local[0], _local[2]);
    return dist <= shape.radius + radius;
  }

  if (shape.kind === 'sphere') {
    const dx = x - shape.center[0];
    const dz = z - shape.center[2];
    return dx * dx + dz * dz <= (shape.radius + radius) * (shape.radius + radius);
  }

  q4Conjugate(_tmpQ, shape.rotation);
  _toPoint[0] = x - shape.center[0];
  _toPoint[1] = 0;
  _toPoint[2] = z - shape.center[2];
  q4TransformVec3(_local, _tmpQ, _toPoint);
  const nx = _local[0] / (shape.radii[0] + radius);
  const nz = _local[2] / (shape.radii[2] + radius);
  return nx * nx + nz * nz <= 1;
};

export const pointBlocksNav = (
  collider: Collider,
  x: number,
  z: number,
  margin: number,
): boolean => {
  if (!collider.isStatic) return false;

  const { min, max } = collider.aabb;
  if (x < min[0] - margin || x > max[0] + margin || z < min[2] - margin || z > max[2] + margin) {
    return false;
  }

  return footprintOverlaps(collider.shape, x, z, margin);
};

export const hasCapsuleSupport = (
  collider: Collider,
  x: number,
  z: number,
  radius: number,
): boolean => footprintOverlaps(collider.shape, x, z, radius);

export const colliderTopY = (collider: Collider): number => collider.aabb.max[1];

export const colliderBottomY = (collider: Collider): number => collider.aabb.min[1];

export const resolveCapsuleVsColliderHorizontal = (
  capsule: CapsuleY,
  collider: Collider,
): { x: number; z: number } | null => {
  const shape = collider.shape;

  if (shape.kind === 'box') {
    return resolveCircleVsOrientedBoxXZ(
      capsule.x,
      capsule.z,
      capsule.radius,
      shape.center,
      shape.halfExtents,
      shape.rotation,
    );
  }

  if (shape.kind === 'cylinder' || shape.kind === 'capsule') {
    return resolveCircleVsCircleXZ(
      capsule.x,
      capsule.z,
      capsule.radius,
      shape.center[0],
      shape.center[2],
      shape.radius,
    );
  }

  if (shape.kind === 'sphere') {
    return resolveCircleVsCircleXZ(
      capsule.x,
      capsule.z,
      capsule.radius,
      shape.center[0],
      shape.center[2],
      shape.radius,
    );
  }

  const yaw = yawFromQuat(shape.rotation);
  const rel = rotateY(capsule.x - shape.center[0], capsule.z - shape.center[2], -yaw);
  const rx = shape.radii[0] + capsule.radius;
  const rz = shape.radii[2] + capsule.radius;
  const nx = rel.x / rx;
  const nz = rel.z / rz;
  const d2 = nx * nx + nz * nz;
  if (d2 >= 1) return null;

  if (d2 < 1e-12) {
    const world = rotateY(rx + 1e-3, 0, yaw);
    return { x: shape.center[0] + world.x, z: shape.center[2] + world.z };
  }

  const d = Math.sqrt(d2);
  const scale = (1 - d) / d + 1e-3 / d;
  const world = rotateY(rel.x + rel.x * scale, rel.z + rel.z * scale, yaw);
  return { x: shape.center[0] + world.x, z: shape.center[2] + world.z };
};

export const resolveCapsuleHorizontal = (
  capsule: CapsuleY,
  obstacles: Collider[],
  outBox: Aabb,
): CapsuleY => {
  let next = capsule;
  capsuleToAabb(next, outBox);

  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(outBox, s.aabb)) continue;

    const yOverlap =
      outBox.max[1] > s.aabb.min[1] + 1e-4 && outBox.min[1] < s.aabb.max[1] - 1e-4;
    if (!yOverlap) continue;

    const resolved = resolveCapsuleVsColliderHorizontal(next, s);
    if (!resolved) continue;

    next = { ...next, x: resolved.x, z: resolved.z };
    capsuleToAabb(next, outBox);
  }

  return next;
};

export const getCapsuleSupportSurfaceY = (
  capsule: CapsuleY,
  obstacles: Collider[],
  groundY = 0,
): number | null => {
  const footY = capsule.y - capsule.halfHeight - capsule.radius;
  if (footY <= groundY + SURFACE_EPS) return groundY;

  let bestTop = -Infinity;
  for (const s of obstacles) {
    if (!hasCapsuleSupport(s, capsule.x, capsule.z, capsule.radius)) continue;
    const top = colliderTopY(s);
    if (top > bestTop) bestTop = top;
  }

  if (bestTop === -Infinity) return null;
  if (footY >= bestTop - SURFACE_SNAP && footY <= bestTop + SURFACE_EPS) return bestTop;
  return null;
};

export const resolveCapsuleVertical = (
  capsule: CapsuleY,
  velocityY: number,
  prevY: number,
  obstacles: Collider[],
  outBox: Aabb,
): { capsule: CapsuleY; velocityY: number; onGround: boolean } => {
  let next = capsule;
  let vy = velocityY;
  let onGround = false;
  capsuleToAabb(next, outBox);

  const ext = next.halfHeight + next.radius;

  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(outBox, s.aabb)) continue;

    const top = colliderTopY(s);
    const bottom = colliderBottomY(s);
    const prevBottom = prevY - ext;
    const currBottom = next.y - ext;
    const prevTop = prevY + ext;
    const currTop = next.y + ext;
    const supported = hasCapsuleSupport(s, next.x, next.z, next.radius);

    if (vy <= 0 && supported && prevBottom >= top - 1e-4 && currBottom < top) {
      next = { ...next, y: top + ext };
      vy = 0;
      onGround = true;
    } else if (vy > 0 && supported && prevTop <= bottom + 1e-4 && currTop > bottom) {
      next = { ...next, y: bottom - ext };
      vy = 0;
    }

    capsuleToAabb(next, outBox);
  }

  return { capsule: next, velocityY: vy, onGround };
};
