import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type MovementIntent } from '../components/movementIntent.ts';
import { type CombatIntent } from '../components/combatIntent.ts';
import { type AnimationFullBody } from '../components/animationFullBody.ts';
import { type AnimationStateMachine, stepAnimationFsm } from '../components/animationStateMachine.ts';

export const installAnimationFsmSystem = (registry: Registry) =>
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.animationStateMachine)) {
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const fsm = e.components[COMPONENT_KEYS.animationStateMachine] as AnimationStateMachine | undefined;
      if (!cc || !fsm) continue;

      const fullBody = e.components[COMPONENT_KEYS.animationFullBody] as AnimationFullBody | undefined;
      if (
        fullBody?.frozen ||
        fullBody?.active === 'death' ||
        fullBody?.active === 'deathPose'
      ) {
        continue;
      }

      const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
      const combat = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent | undefined;
      stepAnimationFsm(cc, fsm, ctx.dt, intent, combat?.walkingBackwards ?? false);
    }
  }, 12);
