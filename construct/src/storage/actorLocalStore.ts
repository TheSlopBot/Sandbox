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
});

export const listLocalActorEntries = (): ActorLocalStoreEntry[] => store.list();

export const getLocalActorEntry = (id: string): ActorLocalStoreEntry | null => store.get(id);

export const saveLocalActor = (document: ActorDocument): ActorLocalStoreEntry =>
  store.save(document, cloneActorDocumentForStorage);

export const removeLocalActor = (id: string) => store.remove(id);
