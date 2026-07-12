import { LEVEL_LOCAL_STORE_KEY, parseLevelFile } from '../catalog/levels/levelFile.ts';
import { type LevelBuild, type LevelSeedDocument } from '../catalog/levels/levelSeed.ts';

export type LevelLocalStoreEntry = {
  id: string;
  displayName: string;
  updatedAt: number;
  document: LevelSeedDocument;
};

type LevelLocalStoreData = {
  version: 1;
  entries: Record<string, LevelLocalStoreEntry>;
};

const emptyStore = (): LevelLocalStoreData => ({ version: 1, entries: {} });

const readStore = (): LevelLocalStoreData => {
  try {
    const raw = localStorage.getItem(LEVEL_LOCAL_STORE_KEY);
    if (!raw) return emptyStore();

    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyStore();

    const store = data as Partial<LevelLocalStoreData>;
    if (store.version !== 1 || !store.entries || typeof store.entries !== 'object') return emptyStore();

    return { version: 1, entries: store.entries as Record<string, LevelLocalStoreEntry> };
  } catch {
    return emptyStore();
  }
};

const writeStore = (store: LevelLocalStoreData) => {
  localStorage.setItem(LEVEL_LOCAL_STORE_KEY, JSON.stringify(store));
};

export const listLocalLevelEntries = (): LevelLocalStoreEntry[] =>
  Object.values(readStore().entries).sort((a, b) => b.updatedAt - a.updatedAt);

export const getLocalLevelEntry = (id: string): LevelLocalStoreEntry | null => readStore().entries[id] ?? null;

export const saveLocalLevel = (document: LevelSeedDocument): LevelLocalStoreEntry => {
  const store = readStore();
  const entry: LevelLocalStoreEntry = {
    id: document.id,
    displayName: document.displayName,
    updatedAt: Date.now(),
    document,
  };
  store.entries[document.id] = entry;
  writeStore(store);
  return entry;
};

export const removeLocalLevel = (id: string) => {
  const store = readStore();
  if (!(id in store.entries)) return;
  delete store.entries[id];
  writeStore(store);
};

export const seedLocalLevelsIfEmpty = (documents: readonly LevelSeedDocument[]) => {
  const store = readStore();
  if (Object.keys(store.entries).length > 0) return;
  for (const document of documents) saveLocalLevel(document);
};

export const resolveLocalLevel = (id: string): LevelBuild | null => {
  const entry = getLocalLevelEntry(id);
  if (!entry) return null;

  const parsed = parseLevelFile(JSON.stringify(entry.document));
  return { definition: parsed.definition, aiPackages: parsed.aiPackages };
};
