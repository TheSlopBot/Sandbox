export type LocalStoreEntry<TDoc> = {
  id: string;
  displayName: string;
  updatedAt: number;
  document: TDoc;
};

type LocalStoreData<TDoc> = {
  version: 1;
  entries: Record<string, LocalStoreEntry<TDoc>>;
};

export type LocalStore<TDoc> = {
  list: () => LocalStoreEntry<TDoc>[];
  get: (id: string) => LocalStoreEntry<TDoc> | null;
  save: (document: TDoc & { id: string; displayName: string }, cloneForStorage: (doc: TDoc) => TDoc) => LocalStoreEntry<TDoc>;
  remove: (id: string) => void;
};

const emptyStore = <TDoc>(): LocalStoreData<TDoc> => ({
  version: 1,
  entries: {},
});

export const createLocalStore = <TDoc>(storageKey: string): LocalStore<TDoc> => {
  const readStore = (): LocalStoreData<TDoc> => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return emptyStore();

      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== 'object') return emptyStore();

      const store = data as Partial<LocalStoreData<TDoc>>;
      if (store.version !== 1 || !store.entries || typeof store.entries !== 'object') {
        return emptyStore();
      }

      return { version: 1, entries: store.entries };
    } catch {
      return emptyStore();
    }
  };

  const writeStore = (store: LocalStoreData<TDoc>) => {
    localStorage.setItem(storageKey, JSON.stringify(store));
  };

  const list = (): LocalStoreEntry<TDoc>[] => {
    const store = readStore();
    return Object.values(store.entries).sort((a, b) => b.updatedAt - a.updatedAt);
  };

  const get = (id: string): LocalStoreEntry<TDoc> | null => {
    const store = readStore();
    return store.entries[id] ?? null;
  };

  const save = (
    document: TDoc & { id: string; displayName: string },
    cloneForStorage: (doc: TDoc) => TDoc,
  ): LocalStoreEntry<TDoc> => {
    const store = readStore();
    const entry: LocalStoreEntry<TDoc> = {
      id: document.id,
      displayName: document.displayName,
      updatedAt: Date.now(),
      document: cloneForStorage(document),
    };
    store.entries[document.id] = entry;
    writeStore(store);
    return entry;
  };

  const remove = (id: string) => {
    const store = readStore();
    if (!(id in store.entries)) return;
    delete store.entries[id];
    writeStore(store);
  };

  return { list, get, save, remove };
};
