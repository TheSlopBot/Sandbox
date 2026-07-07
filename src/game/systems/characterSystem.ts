import { type Registry } from '../../engine/registry.ts';
import { type Input } from '../input.ts';
import { type Transform } from '../components/transform.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type Collider, type Aabb, type ObbY } from '../components/collider.ts';
import { type CameraFollow } from '../components/cameraFollow.ts';

const PHYSICS_STEP_SEC = 1 / 144;

function aabbIntersects(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] <= b.max[0] &&
    a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] &&
    a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] &&
    a.max[2] >= b.min[2]
  );
}

function aabbOverlapsYStrict(a: Aabb, b: Aabb, eps = 1e-4): boolean {
  // Strict overlap (not just touching). Prevents "standing on top" from being treated
  // as a horizontal collision that pushes the character sideways.
  return a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps;
}

function rotateY(x: number, z: number, yaw: number): { x: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // Must match `m4FromTRS` yaw convention:
  // x' = c*x + s*z
  // z' = -s*x + c*z
  return { x: x * c + z * s, z: -x * s + z * c };
}

function obbIntersectsAabb(obb: ObbY, aabb: Aabb): boolean {
  // Test by transforming AABB into OBB local space (yaw-only).
  const cx = (aabb.min[0] + aabb.max[0]) * 0.5;
  const cy = (aabb.min[1] + aabb.max[1]) * 0.5;
  const cz = (aabb.min[2] + aabb.max[2]) * 0.5;
  const hx = (aabb.max[0] - aabb.min[0]) * 0.5;
  const hy = (aabb.max[1] - aabb.min[1]) * 0.5;
  const hz = (aabb.max[2] - aabb.min[2]) * 0.5;

  const relX = cx - obb.center[0];
  const relZ = cz - obb.center[2];
  const p = rotateY(relX, relZ, -obb.yaw);

  // AABB extents projected into OBB local axes (yaw-only).
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const projHx = Math.abs(c) * hx + Math.abs(s) * hz;
  const projHz = Math.abs(s) * hx + Math.abs(c) * hz;

  const dx = Math.abs(p.x);
  const dz = Math.abs(p.z);
  const dy = Math.abs(cy - obb.center[1]);

  return dx <= obb.halfExtents[0] + projHx && dz <= obb.halfExtents[2] + projHz && dy <= obb.halfExtents[1] + hy;
}

function aabbOverlapsObbXZ(obb: ObbY, posX: number, posZ: number, hx: number, hz: number): boolean {
  const relX = posX - obb.center[0];
  const relZ = posZ - obb.center[2];
  const p = rotateY(relX, relZ, -obb.yaw);

  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const projHx = Math.abs(c) * hx + Math.abs(s) * hz;
  const projHz = Math.abs(s) * hx + Math.abs(c) * hz;

  return Math.abs(p.x) <= obb.halfExtents[0] + projHx && Math.abs(p.z) <= obb.halfExtents[2] + projHz;
}

function aabbOverlapsAabbXZ(a: Aabb, posX: number, posZ: number, hx: number, hz: number): boolean {
  return posX - hx <= a.max[0] && posX + hx >= a.min[0] && posZ - hz <= a.max[2] && posZ + hz >= a.min[2];
}

function hasHorizontalSupport(s: Collider, posX: number, posZ: number, hx: number, hz: number): boolean {
  if (s.obbY) return aabbOverlapsObbXZ(s.obbY, posX, posZ, hx, hz);
  return aabbOverlapsAabbXZ(s.aabb, posX, posZ, hx, hz);
}

function resolveAabbVsObbHorizontal(posX: number, posZ: number, hx: number, hz: number, obb: ObbY): { x: number; z: number } {
  // Compute minimal push-out in XZ against a yaw-only OBB by working in OBB local space.
  const relX = posX - obb.center[0];
  const relZ = posZ - obb.center[2];
  const p = rotateY(relX, relZ, -obb.yaw); // character center in OBB local

  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const projHx = Math.abs(c) * hx + Math.abs(s) * hz;
  const projHz = Math.abs(s) * hx + Math.abs(c) * hz;

  const dx = p.x;
  const dz = p.z;
  const px = (obb.halfExtents[0] + projHx) - Math.abs(dx);
  const pz = (obb.halfExtents[2] + projHz) - Math.abs(dz);

  if (px <= 0 || pz <= 0) return { x: posX, z: posZ };

  // Push out along the smallest penetration axis in OBB local space.
  let pushLocalX = 0;
  let pushLocalZ = 0;
  if (px < pz) pushLocalX = dx >= 0 ? px : -px;
  else pushLocalZ = dz >= 0 ? pz : -pz;

  const pushWorld = rotateY(pushLocalX, pushLocalZ, obb.yaw);
  return { x: posX + pushWorld.x, z: posZ + pushWorld.z };
}

export function installCharacterSystem(registry: Registry, input: Input) {
  registry.addAction(
    'update',
    (ctx) => {
      function wrapPi(a: number): number {
        // Wrap to [-pi, pi)
        a = (a + Math.PI) % (Math.PI * 2);
        if (a < 0) a += Math.PI * 2;
        return a - Math.PI;
      }

      const statics: Collider[] = [];
      for (const e of registry.all()) {
        const c = e.components['collider'] as Collider | undefined;
        if (c?.isStatic) statics.push(c);
      }

      let camYaw = 0;
      for (const e of registry.all()) {
        const cf = e.components['cameraFollow'] as CameraFollow | undefined;
        if (cf) {
          camYaw = cf.yawRad;
          break;
        }
      }
      const sinY = Math.sin(camYaw);
      const cosY = Math.cos(camYaw);

      for (const e of registry.all()) {
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

        const left = input.down('KeyA') || input.down('ArrowLeft');
        const right = input.down('KeyD') || input.down('ArrowRight');
        const up = input.down('KeyW') || input.down('ArrowUp');
        const down = input.down('KeyS') || input.down('ArrowDown');

        let mx = 0;
        let mz = 0;
        if (left) mx -= 1;
        if (right) mx += 1;
        if (up) mz -= 1;
        if (down) mz += 1;

        const len = Math.hypot(mx, mz);
        if (len > 1e-6) {
          mx /= len;
          mz /= len;
        }

        // Camera-relative movement on XZ:
        // W moves away from the camera (towards the target direction).
        const rightX = cosY;
        const rightZ = -sinY;
        const fwdX = -sinY;
        const fwdZ = -cosY;
        const forwardAmt = -mz; // input uses -Z for "forward" (W), so flip it.
        cc.velocity[0] = (rightX * mx + fwdX * forwardAmt) * cc.moveSpeed;
        cc.velocity[2] = (rightZ * mx + fwdZ * forwardAmt) * cc.moveSpeed;

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
          let charBox: Aabb = {
            min: new Float32Array([t.position[0] - hx, t.position[1] - hy, t.position[2] - hz]),
            max: new Float32Array([t.position[0] + hx, t.position[1] + hy, t.position[2] + hz]),
          };
          for (const s of statics) {
            if (!aabbIntersects(charBox, s.aabb)) continue;
            if (!aabbOverlapsYStrict(charBox, s.aabb)) continue;

            const obb = s.obbY;
            if (obb) {
              if (!obbIntersectsAabb(obb, charBox)) continue;
              const resolved = resolveAabbVsObbHorizontal(t.position[0], t.position[2], hx, hz, obb);
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

            charBox = {
              min: new Float32Array([t.position[0] - hx, t.position[1] - hy, t.position[2] - hz]),
              max: new Float32Array([t.position[0] + hx, t.position[1] + hy, t.position[2] + hz]),
            };
          }

          cc.velocity[1] -= cc.gravity * step;

          t.position[1] += cc.velocity[1] * step;
          cc.onGround = false;
          charBox = {
            min: new Float32Array([t.position[0] - hx, t.position[1] - hy, t.position[2] - hz]),
            max: new Float32Array([t.position[0] + hx, t.position[1] + hy, t.position[2] + hz]),
          };
          for (const s of statics) {
            if (!aabbIntersects(charBox, s.aabb)) continue;

            const obb = s.obbY;
            const top = obb ? obb.center[1] + obb.halfExtents[1] : s.aabb.max[1];
            const bottom = obb ? obb.center[1] - obb.halfExtents[1] : s.aabb.min[1];
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

            charBox = {
              min: new Float32Array([t.position[0] - hx, t.position[1] - hy, t.position[2] - hz]),
              max: new Float32Array([t.position[0] + hx, t.position[1] + hy, t.position[2] + hz]),
            };
          }

          if (t.position[1] - hy < 0) {
            t.position[1] = hy;
            cc.velocity[1] = 0;
            cc.onGround = true;
          }
        }

        if (cc.onGround && (cc.jumpPhase === 'start' || cc.jumpPhase === 'air')) {
          const moving = cc.velocity[0] * cc.velocity[0] + cc.velocity[2] * cc.velocity[2] > 0.05 * 0.05;
          if (moving) {
            cc.jumpPhase = 'none';
            cc.locomotionBlend = 1;
          } else {
            cc.jumpPhase = 'land';
            cc.jumpClipTime = 0;
          }
        } else if (!cc.onGround && wasOnGround && cc.jumpPhase === 'none') {
          cc.jumpPhase = 'air';
          cc.jumpClipTime = 0;
          cc.locomotionBlend = 0;
        } else if (cc.jumpPhase === 'start' && cc.jumpClipTime >= cc.jumpStartDuration) {
          cc.jumpPhase = 'air';
          cc.jumpClipTime = 0;
        } else if (cc.jumpPhase === 'land') {
          const moving = cc.velocity[0] * cc.velocity[0] + cc.velocity[2] * cc.velocity[2] > 0.05 * 0.05;
          if (moving) {
            cc.jumpPhase = 'none';
            cc.locomotionBlend = 1;
          } else if (cc.jumpClipTime >= cc.jumpLandDuration) {
            cc.jumpPhase = 'none';
          }
        }

        if (cc.jumpPhase === 'start') {
          cc.jumpClipTime += ctx.dt * cc.jumpStartSpeed;
        } else if (cc.jumpPhase === 'air') {
          cc.jumpClipTime += ctx.dt;
        } else if (cc.jumpPhase === 'land') {
          cc.jumpClipTime += ctx.dt * cc.jumpLandSpeed;
        }

        // Face movement direction (ignore vertical velocity)
        const speed2 = cc.velocity[0] * cc.velocity[0] + cc.velocity[2] * cc.velocity[2];
        if (speed2 > 1e-5) {
          // Face the velocity direction in XZ, smoothly.
          const targetYaw = Math.atan2(cc.velocity[0], cc.velocity[2]);
          const delta = wrapPi(targetYaw - t.yaw);
          const turnSpeed = 12.0; // higher = snappier
          const k = 1 - Math.exp(-turnSpeed * ctx.dt);
          t.yaw = t.yaw + delta * k;
        }

        t.dirty = true;
      }
    },
    10,
  );
}

