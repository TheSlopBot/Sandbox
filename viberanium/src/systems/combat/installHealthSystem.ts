import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { deregisterEntityTree } from '../../engine/deregisterEntityTree.ts';
import { type Health } from '../../components/health.ts';
import { type Destructible } from '../../components/destructible.ts';
import { type AnimationFullBody } from '../../components/animationFullBody.ts';
import { drainCombatEvents } from '../../combat/combatEvents.ts';
import { pushCombatEvent } from '../../combat/combatEvents.ts';
import { markNavGridDirty } from '../../navigation/markNavGridDirty.ts';

const FLASH_DURATION = 0.2;

const triggerFullBody = (
  fullBody: AnimationFullBody,
  active: AnimationFullBody['active'],
): void => {
  fullBody.active = active;
  fullBody.stateTime = 0;
  fullBody.animTime = 0;
  fullBody.frozen = false;
};

export type HealthSystemHooks = {
  onDestructible?: (hookId: string, entityId: number, registry: Registry) => void;
};

export const installHealthSystem = (registry: Registry, hooks: HealthSystemHooks = {}) => {
  registry.addAction('update', (ctx) => {
    const events = drainCombatEvents();

    for (const event of events) {
      if (event.kind === 'damageApplied') {
        const target = registry.get(event.targetId);
        if (!target) continue;

        const health = target.components[COMPONENT_KEYS.health] as Health | undefined;
        if (!health || health.current <= 0) continue;

        health.current = Math.max(0, health.current - event.amount);

        const fullBody = target.components[COMPONENT_KEYS.animationFullBody] as
          | AnimationFullBody
          | undefined;
        const destructible = target.components[COMPONENT_KEYS.destructible] as
          | Destructible
          | undefined;

        health.flashRemaining = FLASH_DURATION;

        if (health.current > 0) {
          if (fullBody) triggerFullBody(fullBody, 'hit');
          continue;
        }

        health.dead = true;

        if (destructible) continue;

        if (fullBody) triggerFullBody(fullBody, 'death');
        continue;
      }

      if (event.kind === 'died') {
        const entity = registry.get(event.entityId);
        if (!entity) continue;

        const destructible = entity.components[COMPONENT_KEYS.destructible] as
          | Destructible
          | undefined;
        if (destructible) {
          hooks.onDestructible?.(destructible.hookId, event.entityId, registry);
          deregisterEntityTree(registry, event.entityId);
          markNavGridDirty(registry);
          continue;
        }

        const fullBody = entity.components[COMPONENT_KEYS.animationFullBody] as
          | AnimationFullBody
          | undefined;
        if (fullBody) continue;

        deregisterEntityTree(registry, event.entityId);
      }
    }

    for (const e of registry.view(COMPONENT_KEYS.health)) {
      const health = e.components[COMPONENT_KEYS.health] as Health;
      const wasFlashing = health.flashRemaining > 0;

      if (wasFlashing) {
        health.flashRemaining = Math.max(0, health.flashRemaining - ctx.dt);
      }

      if (health.dead && wasFlashing && health.flashRemaining <= 0) {
        const fullBody = e.components[COMPONENT_KEYS.animationFullBody] as
          | AnimationFullBody
          | undefined;
        if (fullBody) continue;

        pushCombatEvent({ kind: 'died', entityId: e.id });
      }
    }
  }, 11);
};
