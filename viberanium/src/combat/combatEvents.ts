import { type EntityId } from '../engine/entity.ts';

export type CombatEvent =
  | { kind: 'damageApplied'; targetId: EntityId; amount: number; sourceId: EntityId }
  | { kind: 'blocked'; attackerId: EntityId; defenderId: EntityId }
  | { kind: 'died'; entityId: EntityId };

const queue: CombatEvent[] = [];

export const pushCombatEvent = (event: CombatEvent): void => {
  queue.push(event);
};

export const drainCombatEvents = (): CombatEvent[] => {
  if (queue.length === 0) return [];

  const events = queue.slice();
  queue.length = 0;
  return events;
};

export const peekCombatEvents = (): readonly CombatEvent[] => queue;
