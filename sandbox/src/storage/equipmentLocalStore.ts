import { type WeaponDefinition } from 'viberanium';
import { type EquipmentSeedDocument } from '../catalog/equipment/equipmentSeed.ts';

export const EQUIPMENT_LOCAL_STORE_KEY = 'construct.equipmentLocalStore';

export type EquipmentLocalStoreEntry = {
  id: string;
  displayName: string;
  updatedAt: number;
  document: EquipmentSeedDocument;
};

type EquipmentLocalStoreData = {
  version: 1;
  entries: Record<string, EquipmentLocalStoreEntry>;
};

const LEGACY_RANGER_BLADE_ID = 'space_ranger_blade';
const RANGER_BLADE_ID = 'ranger_blade';

const emptyStore = (): EquipmentLocalStoreData => ({ version: 1, entries: {} });

const readStore = (): EquipmentLocalStoreData => {
  try {
    const raw = localStorage.getItem(EQUIPMENT_LOCAL_STORE_KEY);
    if (!raw) return emptyStore();

    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyStore();

    const store = data as Partial<EquipmentLocalStoreData>;
    if (store.version !== 1 || !store.entries || typeof store.entries !== 'object') return emptyStore();

    return { version: 1, entries: store.entries as Record<string, EquipmentLocalStoreEntry> };
  } catch {
    return emptyStore();
  }
};

const writeStore = (store: EquipmentLocalStoreData) => {
  localStorage.setItem(EQUIPMENT_LOCAL_STORE_KEY, JSON.stringify(store));
};

export const listLocalEquipmentEntries = (): EquipmentLocalStoreEntry[] =>
  Object.values(readStore().entries).sort((a, b) =>
    a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id),
  );

export const getLocalEquipmentEntry = (id: string): EquipmentLocalStoreEntry | null =>
  readStore().entries[id] ?? null;

export const saveLocalEquipment = (document: EquipmentSeedDocument): EquipmentLocalStoreEntry => {
  const store = readStore();
  const entry: EquipmentLocalStoreEntry = {
    id: document.id,
    displayName: document.displayName,
    updatedAt: Date.now(),
    document,
  };
  store.entries[document.id] = entry;
  writeStore(store);
  return entry;
};

export const removeLocalEquipment = (id: string) => {
  const store = readStore();
  if (!(id in store.entries)) return;
  delete store.entries[id];
  writeStore(store);
};

const migrateLegacyRangerBladeId = (store: EquipmentLocalStoreData): boolean => {
  const legacy = store.entries[LEGACY_RANGER_BLADE_ID];
  if (!legacy || store.entries[RANGER_BLADE_ID]) return false;

  const document: EquipmentSeedDocument = {
    ...legacy.document,
    id: RANGER_BLADE_ID,
  };
  store.entries[RANGER_BLADE_ID] = {
    id: RANGER_BLADE_ID,
    displayName: document.displayName,
    updatedAt: Date.now(),
    document,
  };
  delete store.entries[LEGACY_RANGER_BLADE_ID];
  return true;
};

const migrateSpaceRangerBulletProjectile = (store: EquipmentLocalStoreData): boolean => {
  const entry = store.entries['space_ranger_bullet'];
  if (!entry) return false;

  const doc = entry.document;
  const needsKind = doc.kind !== 'projectile';
  const needsSlot = !doc.slotTags.includes('slot:projectile');
  const needsSpeed = doc.stats.moveSpeed !== 25;
  if (!needsKind && !needsSlot && !needsSpeed) return false;

  const document: EquipmentSeedDocument = {
    ...doc,
    kind: 'projectile',
    slotTags: needsSlot ? ['slot:projectile'] : [...doc.slotTags],
    stats: {
      ...doc.stats,
      damage: 0,
      moveSpeed: 25,
    },
  };
  store.entries['space_ranger_bullet'] = {
    ...entry,
    updatedAt: Date.now(),
    document,
  };
  return true;
};

export const seedLocalEquipmentIfEmpty = (documents: readonly EquipmentSeedDocument[]) => {
  const store = readStore();
  let wrote = migrateLegacyRangerBladeId(store);
  wrote = migrateSpaceRangerBulletProjectile(store) || wrote;

  for (const document of documents) {
    if (store.entries[document.id]) continue;

    store.entries[document.id] = {
      id: document.id,
      displayName: document.displayName,
      updatedAt: Date.now(),
      document,
    };
    wrote = true;
  }

  if (wrote) writeStore(store);
};

const toWeaponClip = (
  binding: EquipmentSeedDocument['clips'][keyof EquipmentSeedDocument['clips']],
): WeaponDefinition['clips'][keyof WeaponDefinition['clips']] => {
  if (!binding?.clipName) return undefined;
  return {
    clipName: binding.clipName,
    animPackUrl: binding.animPackUrl,
  };
};

export const toWeaponDefinition = (document: EquipmentSeedDocument): WeaponDefinition => ({
  id: document.id,
  displayName: document.displayName,
  kind: document.kind,
  slotTags: [...document.slotTags],
  mesh: {
    ...document.mesh,
    rotation: [0, 0, 0, 1],
  },
  colliders: document.colliders.map((c) => ({
    role: c.role,
    shape: c.shape,
    halfExtents: c.halfExtents,
    radius: c.radius,
    halfHeight: c.halfHeight,
    position: c.position,
    rotation: c.rotation,
    scale: c.scale,
  })),
  projectile: document.projectile ? { ...document.projectile } : undefined,
  stats: { ...document.stats },
  clips: {
    attack: toWeaponClip(document.clips.attack),
    aim: toWeaponClip(document.clips.aim),
    reload: toWeaponClip(document.clips.reload),
    block: toWeaponClip(document.clips.block),
    idleHold: toWeaponClip(document.clips.idleHold),
  },
  animPack: document.animPack ? { generalGlb: document.animPack.generalGlb } : undefined,
});

export const resolveLocalEquipment = (id: string): WeaponDefinition | null => {
  const entry = getLocalEquipmentEntry(id);
  if (!entry) return null;
  return toWeaponDefinition(entry.document);
};
