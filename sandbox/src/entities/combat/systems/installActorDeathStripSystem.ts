import {
  type Registry,
  COMPONENT_KEYS,
  type AnimationFullBody,
  type CharacterController,
  type Health,
  type MovementIntent,
} from 'viberanium';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';

const zeroDeathMotion = (entity: { components: Record<string, unknown> }): void => {
  const cc = entity.components[COMPONENT_KEYS.character] as CharacterController | undefined;
  if (cc) {
    cc.velocity[0] = 0;
    cc.velocity[1] = 0;
    cc.velocity[2] = 0;
  }

  const intent = entity.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
  if (intent) {
    intent.desiredVelocity[0] = 0;
    intent.desiredVelocity[1] = 0;
    intent.desiredVelocity[2] = 0;
    intent.jumpRequested = false;
  }
};

export const installActorDeathStripSystem = (registry: Registry): void => {
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.animationFullBody)) {
      const fullBody = e.components[COMPONENT_KEYS.animationFullBody] as AnimationFullBody;
      if (fullBody.active !== 'death' && fullBody.active !== 'deathPose') continue;

      const health = e.components[COMPONENT_KEYS.health] as Health | undefined;
      if (health && health.current <= 0) zeroDeathMotion(e);

      if (e.components[GAME_COMPONENT_KEYS.testAi]) {
        registry.removeComponent(e, GAME_COMPONENT_KEYS.testAi);
      }

      if (e.components[GAME_COMPONENT_KEYS.playerController]) {
        registry.removeComponent(e, GAME_COMPONENT_KEYS.playerController);
      }
    }
  }, 12);
};
