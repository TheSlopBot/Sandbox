import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type MovementIntent } from '../components/movementIntent.ts';

export const installMovementSystem = (registry: Registry) => {
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.movementIntent)) {
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
      if (!cc || !intent) continue;

      cc.wasOnGroundPrevious = cc.onGround;

      cc.velocity[0] = intent.desiredVelocity[0];
      cc.velocity[2] = intent.desiredVelocity[2];

      if (cc.onGround && intent.jumpRequested) {
        cc.velocity[1] = cc.jumpSpeed;
        cc.onGround = false;
        cc.jumpPhase = 'start';
        cc.jumpClipTime = 0;
        cc.movementBlend = 0;
      }

      intent.jumpRequested = false;
    }
  }, 8);
};
