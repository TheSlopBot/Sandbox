import { type GameActorDefinition } from './actorDefinition.ts';
import { KAYKIT_ACTORS } from './kaykitActors.ts';

export const ACTOR_CATALOG: Record<string, GameActorDefinition> = Object.fromEntries(
  KAYKIT_ACTORS.map((def) => [def.id, def]),
);

export const getActorDefinition = (id: string): GameActorDefinition => {
  const def = ACTOR_CATALOG[id];

  if (!def) throw new Error(`Unknown actor: ${id}`);

  return def;
};
