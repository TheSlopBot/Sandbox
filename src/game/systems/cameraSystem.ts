import { type Registry } from '../../engine/registry.ts';
import { type RenderState } from './renderSystem.ts';
import { type Transform } from '../components/transform.ts';
import { type CameraFollow } from '../components/cameraFollow.ts';
import { type Collider, type Aabb } from '../components/collider.ts';
import { type Input } from '../input.ts';

const CAM_RADIUS = 0.3;
const MIN_CAM_DIST = 1.5;
const GROUND_Y = 0;

function spherePenetratesAabb(px: number, py: number, pz: number, radius: number, aabb: Aabb): boolean {
  const cx = Math.max(aabb.min[0], Math.min(px, aabb.max[0]));
  const cy = Math.max(aabb.min[1], Math.min(py, aabb.max[1]));
  const cz = Math.max(aabb.min[2], Math.min(pz, aabb.max[2]));
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return dx * dx + dy * dy + dz * dz < radius * radius;
}

function spherePenetratesAny(px: number, py: number, pz: number, radius: number, statics: Collider[]): boolean {
  for (const s of statics) {
    if (spherePenetratesAabb(px, py, pz, radius, s.aabb)) return true;
  }
  return false;
}

function findClearCameraDist(
  pivotX: number,
  pivotY: number,
  pivotZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxDist: number,
  statics: Collider[],
): number {
  const endX = pivotX + dirX * maxDist;
  const endY = pivotY + dirY * maxDist;
  const endZ = pivotZ + dirZ * maxDist;
  if (!spherePenetratesAny(endX, endY, endZ, CAM_RADIUS, statics)) return maxDist;

  let lo = MIN_CAM_DIST;
  let hi = maxDist;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5;
    const mx = pivotX + dirX * mid;
    const my = pivotY + dirY * mid;
    const mz = pivotZ + dirZ * mid;
    if (!spherePenetratesAny(mx, my, mz, CAM_RADIUS, statics)) lo = mid;
    else hi = mid;
  }
  return lo;
}

function pushSphereOutOfAabb(px: number, py: number, pz: number, radius: number, aabb: Aabb): { x: number; y: number; z: number } {
  const cx = Math.max(aabb.min[0], Math.min(px, aabb.max[0]));
  const cy = Math.max(aabb.min[1], Math.min(py, aabb.max[1]));
  const cz = Math.max(aabb.min[2], Math.min(pz, aabb.max[2]));

  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq >= radius * radius) return { x: px, y: py, z: pz };

  if (distSq < 1e-10) {
    // Center is inside the box; push out along the smallest penetration axis.
    const penX = Math.min(px - aabb.min[0], aabb.max[0] - px);
    const penY = Math.min(py - aabb.min[1], aabb.max[1] - py);
    const penZ = Math.min(pz - aabb.min[2], aabb.max[2] - pz);
    if (penY <= penX && penY <= penZ) {
      const dir = py < (aabb.min[1] + aabb.max[1]) * 0.5 ? -1 : 1;
      return { x: px, y: py + dir * (radius + penY), z: pz };
    }
    if (penX <= penZ) {
      const dir = px < (aabb.min[0] + aabb.max[0]) * 0.5 ? -1 : 1;
      return { x: px + dir * (radius + penX), y: py, z: pz };
    }
    const dir = pz < (aabb.min[2] + aabb.max[2]) * 0.5 ? -1 : 1;
    return { x: px, y: py, z: pz + dir * (radius + penZ) };
  }

  const dist = Math.sqrt(distSq);
  const push = radius - dist;
  return {
    x: px + (dx / dist) * push,
    y: py + (dy / dist) * push,
    z: pz + (dz / dist) * push,
  };
}

function resolveCameraPosition(
  pivotX: number,
  pivotY: number,
  pivotZ: number,
  desiredX: number,
  desiredY: number,
  desiredZ: number,
  statics: Collider[],
): { x: number; y: number; z: number } {
  const dx = desiredX - pivotX;
  const dy = desiredY - pivotY;
  const dz = desiredZ - pivotZ;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return { x: desiredX, y: desiredY, z: desiredZ };

  const invDist = 1 / dist;
  const dirX = dx * invDist;
  const dirY = dy * invDist;
  const dirZ = dz * invDist;

  // Only pull the camera in when the desired sphere overlaps geometry, not when
  // the pivot-to-camera ray merely passes through a nearby collider's AABB.
  let allowedDist = findClearCameraDist(pivotX, pivotY, pivotZ, dirX, dirY, dirZ, dist, statics);

  // When pitching toward the floor, place the camera on the ground along the orbit ray.
  if (dirY < -1e-6) {
    const groundT = (GROUND_Y + CAM_RADIUS - pivotY) / dirY;
    if (groundT >= MIN_CAM_DIST && groundT <= dist) {
      const gx = pivotX + dirX * groundT;
      const gy = GROUND_Y + CAM_RADIUS;
      const gz = pivotZ + dirZ * groundT;
      if (!spherePenetratesAny(gx, gy, gz, CAM_RADIUS, statics)) {
        allowedDist = Math.max(allowedDist, groundT);
      }
    }
  }

  let x = pivotX + dirX * allowedDist;
  let y = pivotY + dirY * allowedDist;
  let z = pivotZ + dirZ * allowedDist;

  if (y < GROUND_Y + CAM_RADIUS) y = GROUND_Y + CAM_RADIUS;

  // Slide along surfaces when the clipped position still penetrates geometry.
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const s of statics) {
      const pushed = pushSphereOutOfAabb(x, y, z, CAM_RADIUS, s.aabb);
      if (pushed.x !== x || pushed.y !== y || pushed.z !== z) {
        x = pushed.x;
        y = pushed.y;
        z = pushed.z;
        moved = true;
      }
    }

    if (y < GROUND_Y + CAM_RADIUS) {
      y = GROUND_Y + CAM_RADIUS;
      moved = true;
    }

    if (!moved) break;
  }

  return { x, y, z };
}

export function installCameraSystem(registry: Registry, render: RenderState, input: Input) {
  registry.addAction(
    'update',
    (ctx) => {
      let followT: Transform | null = null;
      let follow: CameraFollow | null = null;
      for (const e of registry.all()) {
        const t = e.components['transform'] as Transform | undefined;
        const c = e.components['cameraFollow'] as CameraFollow | undefined;
        if (t && c) {
          followT = t;
          follow = c;
          break;
        }
      }
      if (!followT || !follow) return;

      const statics: Collider[] = [];
      for (const e of registry.all()) {
        const c = e.components['collider'] as Collider | undefined;
        if (c?.isStatic) statics.push(c);
      }

      // Orbit camera around the followed entity with mouse.
      // Right click toggles pointer-lock; orbit while locked.
      if (input.pointerLocked()) {
        const { dx, dy } = input.mouseDelta();
        const sens = 0.004;
        follow.yawRad -= dx * sens;
        follow.pitchRad -= dy * sens;

        // Wide pitch range; collision handles floor and geometry instead of a hard angle stop.
        const minPitch = -1.55;
        const maxPitch = 0.35;
        follow.pitchRad = Math.max(minPitch, Math.min(maxPitch, follow.pitchRad));
      }

      const pivotX = followT.position[0];
      const pivotY = followT.position[1] + follow.height;
      const pivotZ = followT.position[2];

      const cosP = Math.cos(follow.pitchRad);
      const sinP = Math.sin(follow.pitchRad);
      const sinY = Math.sin(follow.yawRad);
      const cosY = Math.cos(follow.yawRad);

      const xz = cosP * follow.distance;
      const offX = sinY * xz;
      const offY = -sinP * follow.distance;
      const offZ = cosY * xz;

      const desiredX = pivotX + offX;
      const desiredY = pivotY + offY;
      const desiredZ = pivotZ + offZ;

      const resolved = resolveCameraPosition(pivotX, pivotY, pivotZ, desiredX, desiredY, desiredZ, statics);

      const cam = render.camera.position;
      const k = 1 - Math.exp(-follow.smooth * ctx.dt);
      cam[0] += (resolved.x - cam[0]) * k;
      cam[1] += (resolved.y - cam[1]) * k;
      cam[2] += (resolved.z - cam[2]) * k;

      // Look at the character center
      render.target[0] = followT.position[0];
      render.target[1] = followT.position[1] + 0.9;
      render.target[2] = followT.position[2];
    },
    5,
  );
}
