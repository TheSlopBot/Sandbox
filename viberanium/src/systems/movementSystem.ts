import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type MovementIntent } from '../components/movementIntent.ts';
import { type AnimationStateMachine } from '../components/animationStateMachine.ts';

export const installMovementSystem = (registry: Registry) => {
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.movementIntent)) {
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
      const fsm = e.components[COMPONENT_KEYS.animationStateMachine] as AnimationStateMachine | undefined;
      if (!cc || !intent) continue;

      cc.wasOnGroundPrevious = cc.onGround;

      cc.velocity[0] = intent.desiredVelocity[0];
      cc.velocity[2] = intent.desiredVelocity[2];

      if (cc.onGround && intent.jumpRequested && fsm) {
        cc.velocity[1] = cc.jumpSpeed;
        cc.onGround = false;
        fsm.current = 'jumpStart';
        fsm.stateTime = 0;
      }

      intent.jumpRequested = false;
    }
  }, 8);
};
