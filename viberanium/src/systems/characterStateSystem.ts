import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type CharacterController } from '../components/characterController.ts';

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

      const speed2 = cc.velocity[0] * cc.velocity[0] + cc.velocity[2] * cc.velocity[2];
      if (speed2 > 1e-5) {
        const targetYaw = Math.atan2(cc.velocity[0], cc.velocity[2]);
        const delta = wrapPi(targetYaw - t.yaw);
        t.yaw += delta * (1 - Math.exp(-12.0 * ctx.dt));
        t.dirty = true;
      }
    }
  }, 13);
};
