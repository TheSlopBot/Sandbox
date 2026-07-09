import { type Registry } from '../engine/registry.ts';
import { type Transform } from '../components/transform.ts';
import { type Collider, type Aabb } from '../components/collider.ts';
import { type CharacterController } from '../components/characterController.ts';
import { aabbIntersects, aabbOverlapsYStrict, makeAabb } from '../collision/aabb.ts';
import {
  obbIntersectsAabb,
  hasHorizontalSupport,
  resolveAabbVsObbHorizontal,
} from '../collision/obb.ts';

const _obstacles: Collider[] = [];

export const getObstacles = (registry: Registry, keys: readonly string[]): Collider[] => {
  _obstacles.length = 0;
  for (const key of keys) {
    for (const c of registry.getComponentsByName(key)) {
      _obstacles.push(c as Collider);
    }
  }
  return _obstacles;
};

export const resolveHorizontalCollisions = (
  t: Transform,
  charBox: Aabb,
  hx: number,
  hy: number,
  hz: number,
  obstacles: Collider[],
): Aabb => {
  let box = charBox;
  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(box, s.aabb)) continue;
    if (!aabbOverlapsYStrict(box, s.aabb)) continue;

    if (s.obbY) {
      if (!obbIntersectsAabb(s.obbY, box)) continue;
      const resolved = resolveAabbVsObbHorizontal(t.position[0], t.position[2], hx, hz, s.obbY);
      t.position[0] = resolved.x;
      t.position[2] = resolved.z;
    } else {
      const penX = Math.min(s.aabb.max[0] - box.min[0], box.max[0] - s.aabb.min[0]);
      const penZ = Math.min(s.aabb.max[2] - box.min[2], box.max[2] - s.aabb.min[2]);
      if (penX < penZ) {
        t.position[0] += (t.position[0] >= (s.aabb.min[0] + s.aabb.max[0]) * 0.5 ? penX : -penX) + 1e-3;
      } else {
        t.position[2] += (t.position[2] >= (s.aabb.min[2] + s.aabb.max[2]) * 0.5 ? penZ : -penZ) + 1e-3;
      }
    }

    box = makeAabb(t.position[0], t.position[1], t.position[2], hx, hy, hz);
  }
  return box;
};

export const resolveVerticalCollisions = (
  t: Transform,
  cc: CharacterController,
  charBox: Aabb,
  hx: number,
  hy: number,
  hz: number,
  prevY: number,
  obstacles: Collider[],
): Aabb => {
  let box = charBox;
  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(box, s.aabb)) continue;

    const top = s.obbY ? s.obbY.center[1] + s.obbY.halfExtents[1] : s.aabb.max[1];
    const bottom = s.obbY ? s.obbY.center[1] - s.obbY.halfExtents[1] : s.aabb.min[1];
    const prevBottom = prevY - hy;
    const currBottom = t.position[1] - hy;
    const prevTop = prevY + hy;
    const currTop = t.position[1] + hy;
    const supported = hasHorizontalSupport(s, t.position[0], t.position[2], hx, hz);

    if (cc.velocity[1] <= 0 && supported && prevBottom >= top - 1e-4 && currBottom < top) {
      t.position[1] = top + hy;
      cc.velocity[1] = 0;
      cc.onGround = true;
    } else if (cc.velocity[1] > 0 && supported && prevTop <= bottom + 1e-4 && currTop > bottom) {
      t.position[1] = bottom - hy;
      cc.velocity[1] = 0;
    }

    box = makeAabb(t.position[0], t.position[1], t.position[2], hx, hy, hz);
  }
  return box;
};

export const installCollisionSystem = (_registry: Registry): void => {};
