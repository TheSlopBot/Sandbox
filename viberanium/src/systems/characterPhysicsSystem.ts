import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type Aabb } from '../components/collider.ts';
import { type CharacterController } from '../components/characterController.ts';
import { getSupportSurfaceY } from '../collision/obb.ts';
import {
  getObstacles,
  resolveHorizontalCollisions,
  resolveVerticalCollisions,
} from './collisionSystem.ts';

const PHYSICS_STEP_SEC = 1 / 144;

const _box: Aabb = {
  min: new Float32Array(3),
  max: new Float32Array(3),
};

const setBox = (posX: number, posY: number, posZ: number, hx: number, hy: number, hz: number): Aabb => {
  _box.min[0] = posX - hx;
  _box.min[1] = posY - hy;
  _box.min[2] = posZ - hz;
  _box.max[0] = posX + hx;
  _box.max[1] = posY + hy;
  _box.max[2] = posZ + hz;
  return _box;
};

export const installCharacterPhysicsSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.character)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      if (!t || !cc) continue;

      const speed2 =
        cc.velocity[0] * cc.velocity[0] +
        cc.velocity[1] * cc.velocity[1] +
        cc.velocity[2] * cc.velocity[2];
      if (speed2 < 1e-10 && cc.onGround) continue;

      const hx = cc.halfExtents[0];
      const hy = cc.halfExtents[1];
      const hz = cc.halfExtents[2];
      const obstacles = getObstacles(registry, cc.obstructiveColliderKeys);

      const prevX = t.position[0];
      const prevY = t.position[1];
      const prevZ = t.position[2];

      let physicsRemaining = ctx.dt;
      while (physicsRemaining > 1e-12) {
        const step = Math.min(physicsRemaining, PHYSICS_STEP_SEC);
        physicsRemaining -= step;

        const stepPrevY = t.position[1];

        t.position[0] += cc.velocity[0] * step;
        t.position[2] += cc.velocity[2] * step;
        let charBox = setBox(t.position[0], t.position[1], t.position[2], hx, hy, hz);

        charBox = resolveHorizontalCollisions(t, charBox, hx, hy, hz, obstacles);

        const surfaceY = getSupportSurfaceY(t, obstacles, hx, hy, hz);
        if (surfaceY !== null && cc.velocity[1] <= 0) {
          cc.velocity[1] = 0;
          t.position[1] = surfaceY + hy;
          cc.onGround = true;
          continue;
        }

        cc.velocity[1] -= cc.gravity * step;
        t.position[1] += cc.velocity[1] * step;
        cc.onGround = false;
        charBox = setBox(t.position[0], t.position[1], t.position[2], hx, hy, hz);

        charBox = resolveVerticalCollisions(t, cc, charBox, hx, hy, hz, stepPrevY, obstacles);

        if (t.position[1] - hy < 0) {
          t.position[1] = hy;
          cc.velocity[1] = 0;
          cc.onGround = true;
        }
      }

      if (
        t.position[0] !== prevX ||
        t.position[1] !== prevY ||
        t.position[2] !== prevZ
      ) {
        t.dirty = true;
      }
    }
  }, 10);
};
