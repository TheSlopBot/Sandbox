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

const LEGACY_RANGER_BLADE_ID = 'space_ranger_blade';
const RANGER_BLADE_ID = 'ranger_blade';

const migrateLegacyRangerBladeId = () => {
  const legacy = store.get(LEGACY_RANGER_BLADE_ID);
  if (!legacy || store.get(RANGER_BLADE_ID)) return;

  const document = {
    ...legacy.document,
    id: RANGER_BLADE_ID,
  };
  saveLocalEquipment(document);
  store.remove(LEGACY_RANGER_BLADE_ID);
};

const migrateSpaceRangerBulletProjectile = () => {
  const entry = store.get('space_ranger_bullet');
  if (!entry) return;

  const doc = entry.document;
  const needsKind = doc.kind !== 'projectile';
  const needsSlot = !doc.slotTags.includes('slot:projectile');
  const needsSpeed = doc.stats.moveSpeed !== 25;
  if (!needsKind && !needsSlot && !needsSpeed) return;

  saveLocalEquipment({
    ...doc,
    kind: 'projectile',
    slotTags: needsSlot ? ['slot:projectile'] : [...doc.slotTags],
    stats: {
      ...doc.stats,
      damage: 0,
      moveSpeed: 25,
    },
  });
};

export const seedLocalEquipmentIfEmpty = (documents: readonly EquipmentDocument[]) => {
  migrateLegacyRangerBladeId();
  migrateSpaceRangerBulletProjectile();
  for (const document of documents) {
    if (!store.get(document.id)) saveLocalEquipment(document);
  }
};
