import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type Transform } from '../../components/transform.ts';
import { type CombatIntent } from '../../components/combatIntent.ts';
import {
  createAnimationAimOffset,
  type AnimationAimOffset,
} from '../../components/animationAimOffset.ts';

const wrapPi = (a: number): number => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

const smoothToward = (current: number, target: number, rate: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export const installAnimationAimOffsetSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.combatIntent)) {
      const intent = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!t) continue;

      let aim = e.components[COMPONENT_KEYS.animationAimOffset] as AnimationAimOffset | undefined;
      if (!aim) {
        aim = createAnimationAimOffset();
        e.components[COMPONENT_KEYS.animationAimOffset] = aim;
      }

      aim.enabled = true;

      const delta = wrapPi(intent.aimYawRad - t.yaw);
      const torsoTarget = Math.max(-aim.maxTorsoYawRad, Math.min(aim.maxTorsoYawRad, delta));
      const headTarget = Math.max(
        -aim.maxHeadYawRad,
        Math.min(aim.maxHeadYawRad, delta - torsoTarget),
      );

      aim.torsoYawRad = smoothToward(aim.torsoYawRad, torsoTarget, 10, ctx.dt);
      aim.headYawRad = smoothToward(aim.headYawRad, headTarget, 12, ctx.dt);
    }
  }, 11);
};
