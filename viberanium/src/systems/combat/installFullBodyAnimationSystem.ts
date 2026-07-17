import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type AnimationFullBody } from '../../components/animationFullBody.ts';

export const installFullBodyAnimationSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.animationFullBody)) {
      const fullBody = e.components[COMPONENT_KEYS.animationFullBody] as AnimationFullBody;
      if (fullBody.active == null || fullBody.frozen) continue;

      if (fullBody.active === 'deathPose') {
        if (fullBody.stateTime > 0) {
          fullBody.animTime = 0;
          fullBody.frozen = true;
          continue;
        }

        fullBody.stateTime += ctx.dt;
        fullBody.animTime = 0;
        continue;
      }

      fullBody.stateTime += ctx.dt;
      fullBody.animTime += ctx.dt;

      if (fullBody.active === 'hit') {
        if (fullBody.animTime >= fullBody.durations.hit) {
          fullBody.active = null;
          fullBody.stateTime = 0;
          fullBody.animTime = 0;
        }
        continue;
      }

      if (fullBody.active === 'death') {
        if (fullBody.animTime >= fullBody.durations.death) {
          fullBody.active = 'deathPose';
          fullBody.animTime = 0;
          fullBody.stateTime = 0;
        }
      }
    }
  }, 12);
};
