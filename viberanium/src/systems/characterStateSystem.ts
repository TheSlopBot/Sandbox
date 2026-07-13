import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type MovementIntent } from '../components/movementIntent.ts';

const wrapPi = (a: number): number => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

export const installCharacterStateSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.character)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      if (!t || !cc) continue;
      if (cc.sliding || cc.slideIgnoreInputRemaining > 0) continue;

      const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
      const dx = intent?.desiredVelocity[0] ?? 0;
      const dz = intent?.desiredVelocity[2] ?? 0;
      if (dx * dx + dz * dz <= 1e-5) continue;

      const targetYaw = Math.atan2(dx, dz);
      const delta = wrapPi(targetYaw - t.yaw);
      t.yaw += delta * (1 - Math.exp(-12.0 * ctx.dt));
      t.dirty = true;
    }
  }, 13);
};
