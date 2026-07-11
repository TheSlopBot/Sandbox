import { type ActorDocument } from '../catalog/actors/actorDocument.ts';

export type ActorLocalStoreEntry = {
  id: string;
  displayName: string;
  updatedAt: number;
  document: ActorDocument;
};

type ActorLocalStore = {
  version: 1;
  entries: Record<string, ActorLocalStoreEntry>;
};

const STORAGE_KEY = 'construct.actorLocalStore';

const emptyStore = (): ActorLocalStore => ({
  version: 1,
  entries: {},
});

const readStore = (): ActorLocalStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();

    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyStore();

    const store = data as Partial<ActorLocalStore>;
    if (store.version !== 1 || !store.entries || typeof store.entries !== 'object') {
      return emptyStore();
    }

    return { version: 1, entries: store.entries };
  } catch {
    return emptyStore();
  }
};

const writeStore = (store: ActorLocalStore) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

export const listLocalActorEntries = (): ActorLocalStoreEntry[] => {
  const store = readStore();
  return Object.values(store.entries).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getLocalActorEntry = (id: string): ActorLocalStoreEntry | null => {
  const store = readStore();
  return store.entries[id] ?? null;
};

export const saveLocalActor = (document: ActorDocument): ActorLocalStoreEntry => {
  const store = readStore();
  const entry: ActorLocalStoreEntry = {
    id: document.id,
    displayName: document.displayName,
    updatedAt: Date.now(),
    document: {
      version: 1,
      id: document.id,
      displayName: document.displayName,
      tags: [...document.tags],
      aiPackage: document.aiPackage,
      character: document.character
        ? {
            ...document.character,
          }
        : null,
      attachments: document.attachments.map((a) => ({
        ...a,
        tags: [...a.tags],
      })),
      colliders: document.colliders.map((c) => ({
        ...c,
        parent: { ...c.parent },
        halfExtents: c.halfExtents
          ? ([...c.halfExtents] as [number, number, number])
          : undefined,
      })),
    },
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
