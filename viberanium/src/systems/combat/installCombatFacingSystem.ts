import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type Transform } from '../../components/transform.ts';
import { type CharacterController } from '../../components/characterController.ts';
import { type MovementIntent } from '../../components/movementIntent.ts';
import { type CombatIntent } from '../../components/combatIntent.ts';

const MOVE_EPS = 1e-5;
const MAX_LOOK_FROM_LEGS = (2 * Math.PI) / 3;

const wrapPi = (a: number): number => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

const easeYaw = (t: Transform, targetYaw: number, dt: number, rate = 12): void => {
  const delta = wrapPi(targetYaw - t.yaw);
  t.yaw += delta * (1 - Math.exp(-rate * dt));
  t.dirty = true;
};

export const installCombatFacingSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.combatIntent)) {
      const intent = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      if (!t || !cc || cc.sliding) continue;

      const move = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
      const dx = move?.desiredVelocity[0] ?? 0;
      const dz = move?.desiredVelocity[2] ?? 0;
      const moving = dx * dx + dz * dz > MOVE_EPS;

      if (moving) {
        const moveYaw = Math.atan2(dx, dz);
        const moveVsAim = Math.abs(wrapPi(moveYaw - intent.aimYawRad));

        if (moveVsAim > MAX_LOOK_FROM_LEGS) {
          intent.walkingBackwards = true;
          easeYaw(t, moveYaw + Math.PI, ctx.dt);
        } else {
          intent.walkingBackwards = false;
          easeYaw(t, moveYaw, ctx.dt);
        }
        continue;
      }

      intent.walkingBackwards = false;
      const lookDelta = Math.abs(wrapPi(intent.aimYawRad - t.yaw));
      if (lookDelta > MAX_LOOK_FROM_LEGS) {
        easeYaw(t, intent.aimYawRad, ctx.dt, 10);
      }
    }
  }, 11);
};
