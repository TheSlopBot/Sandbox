import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type MovementIntent } from '../components/movementIntent.ts';
import { type AnimationStateMachine } from '../components/animationStateMachine.ts';

const COYOTE_SEC = 0.1;
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

        cc.velocity[0] = intent.desiredVelocity[0];
        cc.velocity[2] = intent.desiredVelocity[2];

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
