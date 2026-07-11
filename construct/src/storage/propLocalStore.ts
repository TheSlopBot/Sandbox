import { type PropDocument } from '../catalog/props/propDocument.ts';
import { createLocalStore, type LocalStoreEntry } from './localStore.ts';

export type PropLocalStoreEntry = LocalStoreEntry<PropDocument>;

const store = createLocalStore<PropDocument>('construct.propLocalStore');

const clonePropDocumentForStorage = (document: PropDocument): PropDocument => ({
  version: 1,
  id: document.id,
  displayName: document.displayName,
  parts: document.parts.map((part) =>
    part.kind === 'asset' ? { ...part, tags: [...part.tags] } : { ...part },
  ),
});

export const listLocalPropEntries = (): PropLocalStoreEntry[] => store.list();

export const getLocalPropEntry = (id: string): PropLocalStoreEntry | null => store.get(id);

export const saveLocalProp = (document: PropDocument): PropLocalStoreEntry =>
  store.save(document, clonePropDocumentForStorage);

export const removeLocalProp = (id: string) => store.remove(id);
