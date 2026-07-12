import { type LevelDocument, cloneLevelDocument } from '../catalog/levels/levelDocument.ts';
import { createLocalStore, type LocalStoreEntry } from './localStore.ts';

export type LevelLocalStoreEntry = LocalStoreEntry<LevelDocument>;

export const LEVEL_LOCAL_STORE_KEY = 'construct.levelLocalStore';

const store = createLocalStore<LevelDocument>(LEVEL_LOCAL_STORE_KEY);

export const listLocalLevelEntries = (): LevelLocalStoreEntry[] => store.list();

export const getLocalLevelEntry = (id: string): LevelLocalStoreEntry | null => store.get(id);

export const saveLocalLevel = (document: LevelDocument): LevelLocalStoreEntry =>
  store.save(document, cloneLevelDocument);

export const removeLocalLevel = (id: string) => store.remove(id);
