import { type Registry } from '../../engine/registry.ts';
import { type Input } from '../../input/input.ts';
import { type Transform } from '../../components/transform.ts';
import { type Collider, type Aabb } from '../../components/collider.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type CameraFollow } from '../components/cameraFollow.ts';
import { aabbIntersects, aabbOverlapsYStrict, makeAabb } from '../../collision/aabb.ts';
import {
  obbIntersectsAabb,
  hasHorizontalSupport,
  resolveAabbVsObbHorizontal,
  getSupportSurfaceY,
} from '../../collision/obb.ts';

const PHYSICS_STEP_SEC = 1 / 144;

const wrapPi = (a: number): number => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

export const installCharacterSystem = (
  registry: Registry,
  input: Input,
  staticColliders: Collider[],
) => {
  registry.addAction('update', (ctx) => {
    let camYaw = 0;
    for (const e of registry.view('cameraFollow')) {
      camYaw = (e.components['cameraFollow'] as CameraFollow).yawRad;
      break;
    }
    const sinY = Math.sin(camYaw);
    const cosY = Math.cos(camYaw);

    for (const e of registry.view('character')) {
      const t = e.components['transform'] as Transform | undefined;
      const cc = e.components['character'] as CharacterController | undefined;
      if (!t || !cc) continue;

      if (input.pressed('KeyR')) {
        t.position[0] = 0;
        t.position[1] = 1.6;
        t.position[2] = 0;
        cc.velocity[0] = cc.velocity[1] = cc.velocity[2] = 0;
        cc.onGround = false;
        cc.jumpPhase = 'none';
        cc.jumpClipTime = 0;
        cc.locomotionAnimTime = 0;
        cc.locomotionBlend = 1;
        t.dirty = true;
      }

      let mx = 0;
      let mz = 0;
      if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
      if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
      if (input.down('KeyW') || input.down('ArrowUp')) mz -= 1;
      if (input.down('KeyS') || input.down('ArrowDown')) mz += 1;

      const len = Math.hypot(mx, mz);
      if (len > 1e-6) { mx /= len; mz /= len; }

      const forwardAmt = -mz;
      cc.velocity[0] = (cosY * mx + -sinY * forwardAmt) * cc.moveSpeed;
      cc.velocity[2] = (-sinY * mx + -cosY * forwardAmt) * cc.moveSpeed;

      const wasOnGround = cc.onGround;

      if (cc.onGround && input.pressed('Space')) {
        cc.velocity[1] = cc.jumpSpeed;
        cc.onGround = false;
        cc.jumpPhase = 'start';
        cc.jumpClipTime = 0;
        cc.locomotionBlend = 0;
      }

      const hx = cc.halfExtents[0];
      const hy = cc.halfExtents[1];
      const hz = cc.halfExtents[2];

      let physicsRemaining = ctx.dt;
      while (physicsRemaining > 1e-12) {
        const step = Math.min(physicsRemaining, PHYSICS_STEP_SEC);
        physicsRemaining -= step;

        const prevY = t.position[1];

        t.position[0] += cc.velocity[0] * step;
        t.position[2] += cc.velocity[2] * step;
        let charBox: Aabb = makeAabb(t.position[0], t.position[1], t.position[2], hx, hy, hz);

        for (const s of staticColliders) {
          if (!aabbIntersects(charBox, s.aabb)) continue;
          if (!aabbOverlapsYStrict(charBox, s.aabb)) continue;

          if (s.obbY) {
            if (!obbIntersectsAabb(s.obbY, charBox)) continue;
            const resolved = resolveAabbVsObbHorizontal(t.position[0], t.position[2], hx, hz, s.obbY);
            t.position[0] = resolved.x;
            t.position[2] = resolved.z;
          } else {
            const penX = Math.min(s.aabb.max[0] - charBox.min[0], charBox.max[0] - s.aabb.min[0]);
            const penZ = Math.min(s.aabb.max[2] - charBox.min[2], charBox.max[2] - s.aabb.min[2]);
            if (penX < penZ) {
              t.position[0] += (t.position[0] >= (s.aabb.min[0] + s.aabb.max[0]) * 0.5 ? penX : -penX) + 1e-3;
            } else {
              t.position[2] += (t.position[2] >= (s.aabb.min[2] + s.aabb.max[2]) * 0.5 ? penZ : -penZ) + 1e-3;
            }
          }

          charBox = makeAabb(t.position[0], t.position[1], t.position[2], hx, hy, hz);
        }

        const surfaceY = getSupportSurfaceY(t, staticColliders, hx, hy, hz);
        if (surfaceY !== null && cc.velocity[1] <= 0) {
          cc.velocity[1] = 0;
          t.position[1] = surfaceY + hy;
          cc.onGround = true;
          continue;
        }

        cc.velocity[1] -= cc.gravity * step;
        t.position[1] += cc.velocity[1] * step;
        cc.onGround = false;
        charBox = makeAabb(t.position[0], t.position[1], t.position[2], hx, hy, hz);

        for (const s of staticColliders) {
          if (!aabbIntersects(charBox, s.aabb)) continue;

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

          charBox = makeAabb(t.position[0], t.position[1], t.position[2], hx, hy, hz);
        }

        if (t.position[1] - hy < 0) {
          t.position[1] = hy;
          cc.velocity[1] = 0;
          cc.onGround = true;
        }
      }

      if (cc.onGround && (cc.jumpPhase === 'start' || cc.jumpPhase === 'air')) {
        const moving = cc.velocity[0] * cc.velocity[0] + cc.velocity[2] * cc.velocity[2] > 0.05 * 0.05;
        if (moving) { cc.jumpPhase = 'none'; cc.locomotionBlend = 1; }
        else { cc.jumpPhase = 'land'; cc.jumpClipTime = 0; }
      } else if (!cc.onGround && wasOnGround && cc.jumpPhase === 'none') {
        cc.jumpPhase = 'air'; cc.jumpClipTime = 0; cc.locomotionBlend = 0;
      } else if (cc.jumpPhase === 'start' && cc.jumpClipTime >= cc.jumpStartDuration) {
        cc.jumpPhase = 'air'; cc.jumpClipTime = 0;
      } else if (cc.jumpPhase === 'land') {
        const moving = cc.velocity[0] * cc.velocity[0] + cc.velocity[2] * cc.velocity[2] > 0.05 * 0.05;
        if (moving) { cc.jumpPhase = 'none'; cc.locomotionBlend = 1; }
        else if (cc.jumpClipTime >= cc.jumpLandDuration) { cc.jumpPhase = 'none'; }
      }

      if (cc.jumpPhase === 'start') cc.jumpClipTime += ctx.dt * cc.jumpStartSpeed;
      else if (cc.jumpPhase === 'air') cc.jumpClipTime += ctx.dt;
      else if (cc.jumpPhase === 'land') cc.jumpClipTime += ctx.dt * cc.jumpLandSpeed;

      const speed2 = cc.velocity[0] * cc.velocity[0] + cc.velocity[2] * cc.velocity[2];
      if (speed2 > 1e-5) {
        const targetYaw = Math.atan2(cc.velocity[0], cc.velocity[2]);
        const delta = wrapPi(targetYaw - t.yaw);
        t.yaw += delta * (1 - Math.exp(-12.0 * ctx.dt));
      }

      t.dirty = true;
    }
  }, 10);
};
