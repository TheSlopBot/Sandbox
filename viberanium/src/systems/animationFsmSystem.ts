import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type AnimationStateMachine, stepAnimationFsm } from '../components/animationStateMachine.ts';

export const installAnimationFsmSystem = (registry: Registry) =>
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.animationStateMachine)) {
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const fsm = e.components[COMPONENT_KEYS.animationStateMachine] as AnimationStateMachine | undefined;
      if (!cc || !fsm) continue;

      stepAnimationFsm(cc, fsm, ctx.dt);
    }
  }, 12);
