import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type MovementIntent } from '../components/movementIntent.ts';
import { type MovementImpulse } from '../components/movementImpulse.ts';
import { type AnimationStateMachine } from '../components/animationStateMachine.ts';

const COYOTE_SEC = 0.16;
const JUMP_BUFFER_SEC = 0.12;
const IMPULSE_STOP_SPEED = 0.25;

const foldImpulseIntoIntent = (
  intent: MovementIntent,
  impulse: MovementImpulse | undefined,
): void => {
  if (!impulse) return;
  intent.desiredVelocity[0] += impulse.velocity[0];
  intent.desiredVelocity[2] += impulse.velocity[2];
};

const flushVerticalAndDecayImpulse = (
  cc: CharacterController,
  impulse: MovementImpulse | undefined,
  dt: number,
): void => {
  if (!impulse) return;

  const iy = impulse.velocity[1];
  if (Math.abs(iy) > 1e-8) {
    cc.velocity[1] += iy;
    if (iy > 0) {
      cc.onGround = false;
      cc.sliding = false;
      cc.slideSpeed = 0;
      cc.groundNormal[0] = 0;
      cc.groundNormal[1] = 1;
      cc.groundNormal[2] = 0;
    }
    impulse.velocity[1] = 0;
  }

  const drag = cc.onGround ? impulse.groundDrag : impulse.airDrag;
  const damp = Math.exp(-drag * dt);
  impulse.velocity[0] *= damp;
  impulse.velocity[2] *= damp;

  if (Math.hypot(impulse.velocity[0], impulse.velocity[2]) < IMPULSE_STOP_SPEED) {
    impulse.velocity[0] = 0;
    impulse.velocity[2] = 0;
  }
};

export const installMovementSystem = (registry: Registry) => {
  registry.addAction(
    'update',
    (ctx) => {
      for (const e of registry.view(COMPONENT_KEYS.movementIntent)) {
        const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
        const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
        const impulse = e.components[COMPONENT_KEYS.movementImpulse] as
          | MovementImpulse
          | undefined;
        const fsm = e.components[COMPONENT_KEYS.animationStateMachine] as
          | AnimationStateMachine
          | undefined;
        if (!cc || !intent) continue;

        if (cc.sliding) {
          intent.desiredVelocity[0] = 0;
          intent.desiredVelocity[1] = 0;
          intent.desiredVelocity[2] = 0;

          if (cc.onGround) cc.coyoteRemaining = COYOTE_SEC;
          else cc.coyoteRemaining = Math.max(0, cc.coyoteRemaining - ctx.dt);

          if (intent.jumpRequested) {
            cc.jumpBufferRemaining = JUMP_BUFFER_SEC;
            intent.jumpRequested = false;
          } else {
            cc.jumpBufferRemaining = Math.max(0, cc.jumpBufferRemaining - ctx.dt);
          }

          if (cc.jumpBufferRemaining > 0 && cc.coyoteRemaining > 0 && fsm) {
            cc.velocity[1] = cc.jumpSpeed;
            cc.onGround = false;
            cc.sliding = false;
            cc.slideSpeed = 0;
            cc.groundNormal[0] = 0;
            cc.groundNormal[1] = 1;
            cc.groundNormal[2] = 0;
            cc.coyoteRemaining = 0;
            cc.jumpBufferRemaining = 0;
            fsm.current = 'jumpStart';
            fsm.stateTime = 0;
          }

          foldImpulseIntoIntent(intent, impulse);
          if (impulse) {
            cc.velocity[0] += impulse.velocity[0];
            cc.velocity[2] += impulse.velocity[2];
          }
          flushVerticalAndDecayImpulse(cc, impulse, ctx.dt);
          continue;
        }

        foldImpulseIntoIntent(intent, impulse);

        const dx = intent.desiredVelocity[0];
        const dz = intent.desiredVelocity[2];
        const speed = Math.hypot(dx, dz);

        if (cc.onGround && speed > 1e-8) {
          const inv = 1 / speed;
          const fx = dx * inv;
          const fz = dz * inv;
          const nx = cc.groundNormal[0];
          const ny = cc.groundNormal[1];
          const nz = cc.groundNormal[2];
          const into = nx * fx + nz * fz;
          let tx = fx - nx * into;
          let ty = -ny * into;
          let tz = fz - nz * into;
          const tlen = Math.hypot(tx, ty, tz);

          if (tlen > 1e-8) {
            const s = speed / tlen;
            cc.velocity[0] = tx * s;
            cc.velocity[1] = ty * s;
            cc.velocity[2] = tz * s;
          } else {
            cc.velocity[0] = dx;
            cc.velocity[1] = 0;
            cc.velocity[2] = dz;
          }
        } else {
          cc.velocity[0] = dx;
          cc.velocity[2] = dz;
          if (cc.onGround) cc.velocity[1] = 0;
        }

        if (cc.onGround) cc.coyoteRemaining = COYOTE_SEC;
        else cc.coyoteRemaining = Math.max(0, cc.coyoteRemaining - ctx.dt);

        if (intent.jumpRequested) {
          cc.jumpBufferRemaining = JUMP_BUFFER_SEC;
          intent.jumpRequested = false;
        } else {
          cc.jumpBufferRemaining = Math.max(0, cc.jumpBufferRemaining - ctx.dt);
        }

        if (cc.jumpBufferRemaining > 0 && cc.coyoteRemaining > 0 && fsm) {
          cc.velocity[1] = cc.jumpSpeed;
          cc.onGround = false;
          cc.groundNormal[0] = 0;
          cc.groundNormal[1] = 1;
          cc.groundNormal[2] = 0;
          cc.coyoteRemaining = 0;
          cc.jumpBufferRemaining = 0;
          fsm.current = 'jumpStart';
          fsm.stateTime = 0;
        }

        flushVerticalAndDecayImpulse(cc, impulse, ctx.dt);
      }
    },
    8,
  );
};
