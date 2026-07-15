import { resolveLocalActor } from '../../storage/actorLocalStore.ts';
import { type GameActorDefinition } from './actorDefinition.ts';
import { KAYKIT_ACTORS } from './kaykitActors.ts';

export const ACTOR_CATALOG: Record<string, GameActorDefinition> = Object.fromEntries(
  KAYKIT_ACTORS.map((def) => [def.id, def]),
);

const mergeMissingWalkBackAnim = (
  local: GameActorDefinition,
  catalog: GameActorDefinition,
): GameActorDefinition => {
  const needsAdvanced =
    !local.animPack.movementAdvancedGlb && !!catalog.animPack.movementAdvancedGlb;
  const needsWalkBack = !local.clips.walkBack && !!catalog.clips.walkBack;
  if (!needsAdvanced && !needsWalkBack) return local;

  return {
    ...local,
    animPack: {
      ...local.animPack,
      ...(needsAdvanced ? { movementAdvancedGlb: catalog.animPack.movementAdvancedGlb } : {}),
    },
    clips: {
      ...local.clips,
      ...(needsWalkBack ? { walkBack: catalog.clips.walkBack } : {}),
    },
  };
};

export const resolveActorDefinition = (id: string): GameActorDefinition | null => {
  const local = resolveLocalActor(id);
  const catalog = ACTOR_CATALOG[id];
  if (!local && !catalog) return null;
  if (!local) return catalog ?? null;
  if (!catalog) return local;
  return mergeMissingWalkBackAnim(local, catalog);
};

export const getActorDefinition = (id: string): GameActorDefinition => {
  const def = resolveActorDefinition(id);

  if (!def) throw new Error(`Unknown actor: ${id}`);

  return def;
};
