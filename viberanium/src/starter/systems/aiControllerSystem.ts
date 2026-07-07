import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type Transform } from '../../components/transform.ts';
import { type LocomotionIntent } from '../components/locomotionIntent.ts';
import { type AiController } from '../components/aiController.ts';
import { type CharacterController } from '../components/characterController.ts';
import { v3Set } from '../../math/vec3.ts';

export const installAiControllerSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.aiController)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const intent = e.components[COMPONENT_KEYS.locomotionIntent] as LocomotionIntent | undefined;
      const ai = e.components[COMPONENT_KEYS.aiController] as AiController;
      if (!t || !cc || !intent) continue;

      ai.repathTimer += ctx.dt;
      if (ai.repathTimer >= ai.repathInterval) {
        ai.repathTimer = 0;
      }

      const dx = ai.target[0] - t.position[0];
      const dz = ai.target[2] - t.position[2];
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-6) {
        v3Set(intent.desiredVelocity, (dx / dist) * cc.moveSpeed, 0, (dz / dist) * cc.moveSpeed);
      } else {
        v3Set(intent.desiredVelocity, 0, 0, 0);
      }
      intent.jumpRequested = false;
    }
  }, 5);
};
