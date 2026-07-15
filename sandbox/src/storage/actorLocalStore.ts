import { type GameActorDefinition } from '../catalog/actors/actorDefinition.ts';
import { type ActorSeedDocument } from '../catalog/actors/actorSeed.ts';

export const ACTOR_LOCAL_STORE_KEY = 'construct.actorLocalStore';

export type ActorLocalStoreEntry = {
  id: string;
  displayName: string;
  updatedAt: number;
  document: ActorSeedDocument;
};

type ActorLocalStoreData = {
  version: 1;
  entries: Record<string, ActorLocalStoreEntry>;
};

const emptyStore = (): ActorLocalStoreData => ({ version: 1, entries: {} });

const readStore = (): ActorLocalStoreData => {
  try {
    const raw = localStorage.getItem(ACTOR_LOCAL_STORE_KEY);
    if (!raw) return emptyStore();

    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyStore();

    const store = data as Partial<ActorLocalStoreData>;
    if (store.version !== 1 || !store.entries || typeof store.entries !== 'object') return emptyStore();

    return { version: 1, entries: store.entries as Record<string, ActorLocalStoreEntry> };
  } catch {
    return emptyStore();
  }
};

const writeStore = (store: ActorLocalStoreData) => {
  localStorage.setItem(ACTOR_LOCAL_STORE_KEY, JSON.stringify(store));
};

export const listLocalActorEntries = (): ActorLocalStoreEntry[] =>
  Object.values(readStore().entries).sort((a, b) =>
    a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id),
  );

export const getLocalActorEntry = (id: string): ActorLocalStoreEntry | null => readStore().entries[id] ?? null;

export const saveLocalActor = (document: ActorSeedDocument): ActorLocalStoreEntry => {
  const store = readStore();
  const entry: ActorLocalStoreEntry = {
    id: document.id,
    displayName: document.displayName,
    updatedAt: Date.now(),
    document,
  };
  store.entries[document.id] = entry;
  writeStore(store);
  return entry;
};

export const removeLocalActor = (id: string) => {
  const store = readStore();
  if (!(id in store.entries)) return;
  delete store.entries[id];
  writeStore(store);
};

const migrateSeedBodyColliderToSpine = (
  existing: ActorSeedDocument,
  seed: ActorSeedDocument,
): ActorSeedDocument | null => {
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
  existing: ActorSeedDocument,
  seed: ActorSeedDocument,
): ActorSeedDocument | null => {
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

const migrateSeedDocument = (
  existing: ActorSeedDocument,
  seed: ActorSeedDocument,
): ActorSeedDocument | null => {
  let next: ActorSeedDocument | null = null;
  const body = migrateSeedBodyColliderToSpine(existing, seed);
  if (body) next = body;
  const walk = migrateSeedWalkBackAnim(next ?? existing, seed);
  if (walk) next = walk;
  return next;
};

export const seedLocalActorsIfEmpty = (documents: readonly ActorSeedDocument[]) => {
  const store = readStore();
  let wrote = false;
  for (const document of documents) {
    const existing = store.entries[document.id];
    if (!existing) {
      store.entries[document.id] = {
        id: document.id,
        displayName: document.displayName,
        updatedAt: Date.now(),
        document,
      };
      wrote = true;
      continue;
    }

    const migrated = migrateSeedDocument(existing.document, document);
    if (!migrated) continue;

    store.entries[document.id] = {
      id: migrated.id,
      displayName: migrated.displayName,
      updatedAt: Date.now(),
      document: migrated,
    };
    wrote = true;
  }
  if (wrote) writeStore(store);
};

export const toGameActorDefinition = (document: ActorSeedDocument): GameActorDefinition | null => {
  if (!document.character || !document.animPack || !document.clips) return null;

  return {
    id: document.id,
    displayName: document.displayName,
    tags: [...document.tags],
    aiPackage: document.aiPackage === 'testAi' ? 'testAi' : 'none',
    character: { ...document.character },
    attachments: document.attachments.map((a) => ({ ...a, tags: [...a.tags] })),
    colliders: document.colliders.map((c) => ({
      ...c,
      parent: { ...c.parent },
      halfExtents: c.halfExtents ? ([...c.halfExtents] as [number, number, number]) : undefined,
    })),
    animPack: { ...document.animPack },
    clips: { ...document.clips },
    ...(document.baseColorTextureUrl ? { baseColorTextureUrl: document.baseColorTextureUrl } : {}),
    ...(document.visualYOffset !== undefined ? { visualYOffset: document.visualYOffset } : {}),
  };
};

export const resolveLocalActor = (id: string): GameActorDefinition | null => {
  const entry = getLocalActorEntry(id);
  if (!entry) return null;
  return toGameActorDefinition(entry.document);
};
