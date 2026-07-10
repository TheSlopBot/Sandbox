import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type Aabb } from '../components/collider.ts';
import { type CharacterController, characterFootOffset } from '../components/characterController.ts';
import {
  type CapsuleY,
  getCapsuleSupportSurfaceY,
  resolveCapsuleHorizontal,
  resolveCapsuleVertical,
} from '../collision/capsule.ts';
import { getObstacles } from './collisionSystem.ts';

const PHYSICS_STEP_SEC = 1 / 144;

const _box: Aabb = {
  min: new Float32Array(3),
  max: new Float32Array(3),
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

      const obstacles = getObstacles(registry, cc.obstructiveColliderKeys);
      const foot = characterFootOffset(cc);

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

        let capsule: CapsuleY = {
          x: t.position[0],
          y: t.position[1],
          z: t.position[2],
          radius: cc.radius,
          halfHeight: cc.halfHeight,
        };

        capsule = resolveCapsuleHorizontal(capsule, obstacles, _box);
        t.position[0] = capsule.x;
        t.position[2] = capsule.z;

        const surfaceY = getCapsuleSupportSurfaceY(capsule, obstacles);
        if (surfaceY !== null && cc.velocity[1] <= 0) {
          cc.velocity[1] = 0;
          t.position[1] = surfaceY + foot;
          cc.onGround = true;
          continue;
        }

        cc.velocity[1] -= cc.gravity * step;
        t.position[1] += cc.velocity[1] * step;
        cc.onGround = false;

        capsule = {
          x: t.position[0],
          y: t.position[1],
          z: t.position[2],
          radius: cc.radius,
          halfHeight: cc.halfHeight,
        };

        const vertical = resolveCapsuleVertical(
          capsule,
          cc.velocity[1],
          stepPrevY,
          obstacles,
          _box,
        );
        t.position[0] = vertical.capsule.x;
        t.position[1] = vertical.capsule.y;
        t.position[2] = vertical.capsule.z;
        cc.velocity[1] = vertical.velocityY;
        if (vertical.onGround) cc.onGround = true;

        if (t.position[1] - foot < 0) {
          t.position[1] = foot;
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
