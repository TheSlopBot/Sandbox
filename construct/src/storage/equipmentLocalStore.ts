import {
  type EquipmentDocument,
  parseEquipmentDocument,
} from '../catalog/equipment/equipmentDocument.ts';
import { createLocalStore, type LocalStoreEntry } from './localStore.ts';

export type EquipmentLocalStoreEntry = LocalStoreEntry<EquipmentDocument>;

const store = createLocalStore<EquipmentDocument>('construct.equipmentLocalStore');

export const cloneEquipmentDocument = (doc: EquipmentDocument): EquipmentDocument =>
  structuredClone(doc);

export const listLocalEquipmentEntries = (): EquipmentLocalStoreEntry[] => store.list();

export const getLocalEquipmentEntry = (id: string): EquipmentLocalStoreEntry | null => store.get(id);

export const saveLocalEquipment = (document: EquipmentDocument): EquipmentLocalStoreEntry =>
  store.save(document, cloneEquipmentDocument);

export const removeLocalEquipment = (id: string) => store.remove(id);

export const importEquipmentDocument = (raw: string): EquipmentDocument | null =>
  parseEquipmentDocument(raw);

export const seedLocalEquipmentIfEmpty = (documents: readonly EquipmentDocument[]) => {
  for (const document of documents) {
    if (!store.get(document.id)) saveLocalEquipment(document);
  }
};
