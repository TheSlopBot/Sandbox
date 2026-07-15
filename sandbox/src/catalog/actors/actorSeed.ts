import { type ActorAiPackage, type GameActorDefinition } from './actorDefinition.ts';
import { KAYKIT_ACTORS } from './kaykitActors.ts';

export type ActorSeedDocument = {
  version: 1;
  id: string;
  displayName: string;
  tags: string[];
  aiPackage: ActorAiPackage;
  character: GameActorDefinition['character'];
  attachments: GameActorDefinition['attachments'];
  colliders: GameActorDefinition['colliders'];
  animPack: GameActorDefinition['animPack'];
  clips: GameActorDefinition['clips'];
  baseColorTextureUrl?: string;
  visualYOffset?: number;
};

export const buildActorSeedDocument = (def: GameActorDefinition): ActorSeedDocument => ({
  version: 1,
  id: def.id,
  displayName: def.displayName,
  tags: [...def.tags],
  aiPackage: def.aiPackage,
  character: { ...def.character },
  attachments: def.attachments.map((a) => ({ ...a, tags: [...a.tags] })),
  colliders: def.colliders.map((c) => ({
    ...c,
    parent: { ...c.parent },
    halfExtents: c.halfExtents ? ([...c.halfExtents] as [number, number, number]) : undefined,
  })),
  animPack: { ...def.animPack },
  clips: { ...def.clips },
  ...(def.baseColorTextureUrl ? { baseColorTextureUrl: def.baseColorTextureUrl } : {}),
  ...(def.visualYOffset !== undefined ? { visualYOffset: def.visualYOffset } : {}),
});

export const ACTOR_SEED_DOCUMENTS: ActorSeedDocument[] = KAYKIT_ACTORS.map(buildActorSeedDocument);
