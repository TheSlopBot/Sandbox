import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type MovementIntent } from '../components/movementIntent.ts';
import { type AnimationStateMachine } from '../components/animationStateMachine.ts';

const COYOTE_SEC = 0.16;
const JUMP_BUFFER_SEC = 0.12;

export const installMovementSystem = (registry: Registry) => {
  registry.addAction(
    'update',
    (ctx) => {
      for (const e of registry.view(COMPONENT_KEYS.movementIntent)) {
        const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
        const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
        const fsm = e.components[COMPONENT_KEYS.animationStateMachine] as
          | AnimationStateMachine
          | undefined;
        if (!cc || !intent) continue;

        cc.wasOnGroundPrevious = cc.onGround;

        if (cc.sliding || cc.slideIgnoreInputRemaining > 0) {
          intent.desiredVelocity[0] = 0;
          intent.desiredVelocity[1] = 0;
          intent.desiredVelocity[2] = 0;

          if (!cc.sliding) {
            cc.slideIgnoreInputRemaining = Math.max(0, cc.slideIgnoreInputRemaining - ctx.dt);
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
            cc.sliding = false;
            cc.slideSpeed = 0;
            cc.slideIgnoreInputRemaining = 0;
            cc.groundNormal[0] = 0;
            cc.groundNormal[1] = 1;
            cc.groundNormal[2] = 0;
            cc.coyoteRemaining = 0;
            cc.jumpBufferRemaining = 0;
            fsm.current = 'jumpStart';
            fsm.stateTime = 0;
          }

          continue;
        }

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
      }
    },
    8,
  );
};
