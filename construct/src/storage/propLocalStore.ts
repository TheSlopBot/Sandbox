import {
  type PropDocument,
} from '../catalog/props/propDocument.ts';

export type PropLocalStoreEntry = {
  id: string;
  displayName: string;
  updatedAt: number;
  document: PropDocument;
};

type PropLocalStore = {
  version: 1;
  entries: Record<string, PropLocalStoreEntry>;
};

const STORAGE_KEY = 'construct.propLocalStore';

const emptyStore = (): PropLocalStore => ({
  version: 1,
  entries: {},
});

const readStore = (): PropLocalStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();

    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyStore();

    const store = data as Partial<PropLocalStore>;
    if (store.version !== 1 || !store.entries || typeof store.entries !== 'object') {
      return emptyStore();
    }

    return { version: 1, entries: store.entries };
  } catch {
    return emptyStore();
  }
};

const writeStore = (store: PropLocalStore) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

export const listLocalPropEntries = (): PropLocalStoreEntry[] => {
  const store = readStore();
  return Object.values(store.entries).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getLocalPropEntry = (id: string): PropLocalStoreEntry | null => {
  const store = readStore();
  return store.entries[id] ?? null;
};

export const saveLocalProp = (document: PropDocument): PropLocalStoreEntry => {
  const store = readStore();
  const entry: PropLocalStoreEntry = {
    id: document.id,
    displayName: document.displayName,
    updatedAt: Date.now(),
    document: {
      version: 1,
      id: document.id,
      displayName: document.displayName,
      parts: document.parts.map((part) =>
        part.kind === 'asset'
          ? { ...part, tags: [...part.tags] }
          : { ...part },
      ),
    },
  };
  store.entries[document.id] = entry;
  writeStore(store);
  return entry;
};

export const removeLocalProp = (id: string) => {
  const store = readStore();
  if (!(id in store.entries)) return;
  delete store.entries[id];
  writeStore(store);
};
