import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type Health } from '../../components/health.ts';
import { type AnimationFullBody } from '../../components/animationFullBody.ts';
import { type Destructible } from '../../components/destructible.ts';
import { drainCombatEvents } from '../../combat/combatEvents.ts';
import { pushCombatEvent } from '../../combat/combatEvents.ts';
import { markNavGridDirty } from '../../navigation/markNavGridDirty.ts';

export type HealthSystemHooks = {
  onDestructible?: (hookId: string, entityId: number, registry: Registry) => void;
};

export const installHealthSystem = (registry: Registry, hooks: HealthSystemHooks = {}) => {
  registry.addAction('update', () => {
    const events = drainCombatEvents();

    for (const event of events) {
      if (event.kind === 'damageApplied') {
        const target = registry.get(event.targetId);
        if (!target) continue;
        const health = target.components[COMPONENT_KEYS.health] as Health | undefined;
        if (!health || health.dead) continue;

        health.current = Math.max(0, health.current - event.amount);
        if (health.current <= 0) {
          health.dead = true;
          pushCombatEvent({ kind: 'died', entityId: event.targetId });
        }
        continue;
      }

      if (event.kind === 'died') {
        const entity = registry.get(event.entityId);
        if (!entity) continue;

        const fullBody = entity.components[COMPONENT_KEYS.animationFullBody] as
          | AnimationFullBody
          | undefined;
        if (fullBody) {
          fullBody.active = 'death';
          fullBody.stateTime = 0;
          fullBody.animTime = 0;
        }

        const destructible = entity.components[COMPONENT_KEYS.destructible] as
          | Destructible
          | undefined;
        if (destructible) {
          hooks.onDestructible?.(destructible.hookId, event.entityId, registry);
          registry.deregister(event.entityId);
          markNavGridDirty(registry);
          continue;
        }

        if (!fullBody) {
          registry.deregister(event.entityId);
        }
      }
    }
  }, 11);
};
