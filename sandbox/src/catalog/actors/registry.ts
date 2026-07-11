import { type ActorDefinition } from './actorDefinition.ts';
import { KAYKIT_ACTORS } from './kaykitActors.ts';

export const ACTOR_CATALOG: Record<string, ActorDefinition> = Object.fromEntries(
  KAYKIT_ACTORS.map((def) => [def.id, def]),
);

export const getActorDefinition = (id: string): ActorDefinition => {
  const def = ACTOR_CATALOG[id];

  if (!def) throw new Error(`Unknown actor: ${id}`);

  return def;
};
