import { type ActorDocument } from '../catalog/actors/actorDocument.ts';
import { createLocalStore, type LocalStoreEntry } from './localStore.ts';

export type ActorLocalStoreEntry = LocalStoreEntry<ActorDocument>;

const store = createLocalStore<ActorDocument>('construct.actorLocalStore');

const cloneActorDocumentForStorage = (document: ActorDocument): ActorDocument => ({
  version: 1,
  id: document.id,
  displayName: document.displayName,
  tags: [...document.tags],
  aiPackage: document.aiPackage,
  character: document.character ? { ...document.character } : null,
  attachments: document.attachments.map((a) => ({
    ...a,
    tags: [...a.tags],
  })),
  colliders: document.colliders.map((c) => ({
    ...c,
    parent: { ...c.parent },
    halfExtents: c.halfExtents ? ([...c.halfExtents] as [number, number, number]) : undefined,
  })),
  animPack: document.animPack ? { ...document.animPack } : null,
  clips: document.clips ? { ...document.clips } : null,
  ...(document.baseColorTextureUrl ? { baseColorTextureUrl: document.baseColorTextureUrl } : {}),
  ...(document.visualYOffset !== undefined ? { visualYOffset: document.visualYOffset } : {}),
});

export const listLocalActorEntries = (): ActorLocalStoreEntry[] => store.list();

export const getLocalActorEntry = (id: string): ActorLocalStoreEntry | null => store.get(id);

export const saveLocalActor = (document: ActorDocument): ActorLocalStoreEntry =>
  store.save(document, cloneActorDocumentForStorage);

export const removeLocalActor = (id: string) => store.remove(id);

const migrateSeedBodyColliderToSpine = (
  existing: ActorDocument,
  seed: ActorDocument,
): ActorDocument | null => {
  const seedBody = seed.colliders.find((c) => c.id === 'body');
  if (!seedBody || seedBody.parent.kind !== 'bone') return null;

  let changed = false;
  const colliders = existing.colliders.map((c) => {
    if (c.id !== 'body' || c.shape !== 'cylinder' || c.parent.kind !== 'character') return c;
    changed = true;
    return { ...c, parent: { ...seedBody.parent } };
  });

  if (!changed) return null;
  return { ...existing, colliders };
};

const migrateSeedWalkBackAnim = (
  existing: ActorDocument,
  seed: ActorDocument,
): ActorDocument | null => {
  const seedAdvanced = seed.animPack?.movementAdvancedGlb;
  const seedWalkBack = seed.clips?.walkBack;
  if (!seedAdvanced || !seedWalkBack || !existing.animPack || !existing.clips) return null;

  const needsAdvanced = existing.animPack.movementAdvancedGlb !== seedAdvanced;
  const needsWalkBack = existing.clips.walkBack !== seedWalkBack;
  if (!needsAdvanced && !needsWalkBack) return null;

  return {
    ...existing,
    animPack: {
      ...existing.animPack,
      movementAdvancedGlb: seedAdvanced,
    },
    clips: {
      ...existing.clips,
      walkBack: seedWalkBack,
    },
  };
};

const migrateSeedCombatClips = (
  existing: ActorDocument,
  seed: ActorDocument,
): ActorDocument | null => {
  const seedHit = seed.clips?.hit;
  const seedDeath = seed.clips?.death;
  const seedDeathPose = seed.clips?.deathPose;
  if (!seedHit || !seedDeath || !seedDeathPose || !existing.clips) return null;

  const needsHit = existing.clips.hit !== seedHit;
  const needsDeath = existing.clips.death !== seedDeath;
  const needsDeathPose = existing.clips.deathPose !== seedDeathPose;
  if (!needsHit && !needsDeath && !needsDeathPose) return null;

  return {
    ...existing,
    clips: {
      ...existing.clips,
      ...(needsHit ? { hit: seedHit } : {}),
      ...(needsDeath ? { death: seedDeath } : {}),
      ...(needsDeathPose ? { deathPose: seedDeathPose } : {}),
    },
  };
};

const migrateSeedDocument = (
  existing: ActorDocument,
  seed: ActorDocument,
): ActorDocument | null => {
  let next: ActorDocument | null = null;
  const body = migrateSeedBodyColliderToSpine(existing, seed);
  if (body) next = body;
  const walk = migrateSeedWalkBackAnim(next ?? existing, seed);
  if (walk) next = walk;
  const combat = migrateSeedCombatClips(next ?? existing, seed);
  if (combat) next = combat;
  return next;
};

export const seedLocalActorsIfEmpty = (documents: readonly ActorDocument[]) => {
  for (const document of documents) {
    const existing = store.get(document.id);
    if (!existing) {
      saveLocalActor(document);
      continue;
    }

    const migrated = migrateSeedDocument(existing.document, document);
    if (migrated) saveLocalActor(migrated);
  }
};
