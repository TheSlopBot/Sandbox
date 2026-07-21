import { type WeaponDefinition } from 'viberanium';
import { slugifyDocumentId } from '../slugify.ts';

export const EQUIPMENT_MESH_PART_ID = 'mesh';

export type EquipmentColliderRole = 'weapon' | 'shield';

export type EquipmentDocumentCollider = {
  id: string;
  name: string;
  role: EquipmentColliderRole;
  shape: 'box' | 'cylinder' | 'sphere';
  halfExtents?: [number, number, number];
  radius?: number;
  halfHeight?: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type EquipmentDocumentProjectile = {
  equipmentId?: string;
  shape?: 'sphere';
  radius?: number;
  localOffset: [number, number, number];
  speed?: number;
};

export type EquipmentClipBinding = {
  animPackUrl?: string;
  clipName?: string;
};

export type EquipmentDocument = {
  version: 1;
  id: string;
  displayName: string;
  kind: 'melee' | 'gun' | 'shield' | 'projectile';
  slotTags: string[];
  mesh: {
    url: string;
    materialPrefix: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
  };
  colliders: EquipmentDocumentCollider[];
  projectile?: EquipmentDocumentProjectile;
  stats: {
    damage: number;
    hitWindowStart?: number;
    hitWindowEnd?: number;
    attackSpeed?: number;
    fireRate?: number;
    blockAngleDeg?: number;
    moveSpeed?: number;
  };
  clips: {
    attack?: EquipmentClipBinding;
    aim?: EquipmentClipBinding;
    reload?: EquipmentClipBinding;
    block?: EquipmentClipBinding;
    idleHold?: EquipmentClipBinding;
  };
  animPack?: { generalGlb: string };
};

export type EquipmentClipSlot = keyof EquipmentDocument['clips'];

export type EquipmentEditorSelection =
  | { kind: 'root' }
  | { kind: 'mesh' }
  | { kind: 'collider'; colliderId: string }
  | { kind: 'projectile' }
  | null;

export type EquipmentLocalListItem = {
  id: string;
  displayName: string;
};

export const EQUIPMENT_SLOT_TAGS = ['slot:rightHand', 'slot:leftHand', 'slot:projectile'] as const;

export const defaultSlotTagsForKind = (kind: EquipmentDocument['kind']): string[] => {
  if (kind === 'shield') return ['slot:leftHand'];
  if (kind === 'projectile') return ['slot:projectile'];
  return ['slot:rightHand'];
};

export const createEmptyEquipmentDocument = (): EquipmentDocument => ({
  version: 1,
  id: 'untitled',
  displayName: 'Untitled Equipment',
  kind: 'melee',
  slotTags: defaultSlotTagsForKind('melee'),
  mesh: {
    url: '',
    materialPrefix: '',
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
  },
  colliders: [],
  stats: { damage: 10, attackSpeed: 1 },
  clips: {},
});

export const slugifyEquipmentId = slugifyDocumentId;

export const equipmentNeedsName = (doc: EquipmentDocument): boolean =>
  !doc.displayName.trim() ||
  doc.id === 'untitled' ||
  doc.displayName.trim() === 'Untitled Equipment';

export const applyEquipmentName = (doc: EquipmentDocument, name: string): EquipmentDocument => {
  const trimmed = name.trim();
  if (!trimmed) return doc;

  return {
    ...doc,
    id: slugifyDocumentId(trimmed),
    displayName: trimmed,
  };
};

const isVec3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number');

const isQuat = (v: unknown): v is [number, number, number, number] =>
  Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number');

const normalizeCollider = (raw: unknown): EquipmentDocumentCollider | null => {
  if (!raw || typeof raw !== 'object') return null;

  const c = raw as Partial<EquipmentDocumentCollider>;
  if (typeof c.id !== 'string') return null;
  if (c.shape !== 'box' && c.shape !== 'cylinder' && c.shape !== 'sphere') return null;
  if (c.role !== 'weapon' && c.role !== 'shield') return null;

  return {
    id: c.id,
    name: typeof c.name === 'string' && c.name.trim() ? c.name : c.id,
    role: c.role,
    shape: c.shape,
    halfExtents: isVec3(c.halfExtents) ? c.halfExtents : undefined,
    radius: typeof c.radius === 'number' ? c.radius : undefined,
    halfHeight: typeof c.halfHeight === 'number' ? c.halfHeight : undefined,
    position: isVec3(c.position) ? c.position : [0, 0, 0],
    rotation: isQuat(c.rotation) ? c.rotation : [0, 0, 0, 1],
    scale: isVec3(c.scale) ? c.scale : [1, 1, 1],
  };
};

const normalizeEquipmentObject = (data: unknown): EquipmentDocument | null => {
  if (!data || typeof data !== 'object') return null;

  const doc = data as Partial<EquipmentDocument>;
  if (doc.version !== 1 || typeof doc.id !== 'string' || typeof doc.displayName !== 'string') {
    return null;
  }
  const rawKind = (doc as { kind?: string }).kind;
  const kindRaw = rawKind === 'ranged' ? 'gun' : rawKind;
  if (
    kindRaw !== 'melee' &&
    kindRaw !== 'gun' &&
    kindRaw !== 'shield' &&
    kindRaw !== 'projectile'
  ) {
    return null;
  }
  if (!doc.mesh || typeof doc.mesh !== 'object' || !Array.isArray(doc.colliders) || !doc.stats || !doc.clips) {
    return null;
  }

  const mesh = doc.mesh as Partial<EquipmentDocument['mesh']>;
  if (typeof mesh.url !== 'string') return null;

  const colliders: EquipmentDocumentCollider[] = [];
  for (const raw of doc.colliders) {
    const collider = normalizeCollider(raw);
    if (!collider) return null;
    colliders.push(collider);
  }

  const slotTags = Array.isArray(doc.slotTags)
    ? doc.slotTags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
    : defaultSlotTagsForKind(kindRaw);

  const stats = doc.stats as Partial<EquipmentDocument['stats']>;
  const rawClips = doc.clips as Record<string, unknown>;

  let projectile: EquipmentDocumentProjectile | undefined;
  if (doc.projectile && typeof doc.projectile === 'object') {
    const p = doc.projectile as Partial<EquipmentDocumentProjectile>;
    if (isVec3(p.localOffset)) {
      projectile = {
        localOffset: p.localOffset,
      };
      if (typeof p.speed === 'number') {
        projectile.speed = p.speed;
      }
      if (typeof p.equipmentId === 'string' && p.equipmentId.trim()) {
        projectile.equipmentId = p.equipmentId.trim();
      }
      if (p.shape === 'sphere') {
        projectile.shape = 'sphere';
      }
      if (typeof p.radius === 'number') {
        projectile.radius = p.radius;
      }
    }
  }

  let animPack: EquipmentDocument['animPack'];
  if (doc.animPack && typeof doc.animPack === 'object') {
    const pack = doc.animPack as Partial<{ generalGlb: string }>;
    if (typeof pack.generalGlb === 'string') {
      animPack = { generalGlb: pack.generalGlb };
    }
  }

  const defaultPackUrl = animPack?.generalGlb;

  return {
    version: 1,
    id: doc.id,
    displayName: doc.displayName,
    kind: kindRaw,
    slotTags: slotTags.length > 0 ? slotTags : defaultSlotTagsForKind(kindRaw),
    mesh: {
      url: mesh.url,
      materialPrefix: typeof mesh.materialPrefix === 'string' ? mesh.materialPrefix : '',
      position: isVec3(mesh.position) ? mesh.position : [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: isVec3(mesh.scale) ? mesh.scale : [1, 1, 1],
    },
    colliders,
    projectile,
    stats: {
      damage: typeof stats.damage === 'number' ? stats.damage : kindRaw === 'projectile' ? 0 : 10,
      hitWindowStart: typeof stats.hitWindowStart === 'number' ? stats.hitWindowStart : undefined,
      hitWindowEnd: typeof stats.hitWindowEnd === 'number' ? stats.hitWindowEnd : undefined,
      attackSpeed: typeof stats.attackSpeed === 'number' ? stats.attackSpeed : undefined,
      fireRate: typeof stats.fireRate === 'number' ? stats.fireRate : undefined,
      blockAngleDeg: typeof stats.blockAngleDeg === 'number' ? stats.blockAngleDeg : undefined,
      moveSpeed: typeof stats.moveSpeed === 'number' ? stats.moveSpeed : undefined,
    },
    clips: {
      attack: normalizeClipBinding(rawClips.attack, defaultPackUrl),
      aim: normalizeClipBinding(rawClips.aim, defaultPackUrl),
      reload: normalizeClipBinding(rawClips.reload, defaultPackUrl),
      block: normalizeClipBinding(rawClips.block, defaultPackUrl),
      idleHold: normalizeClipBinding(rawClips.idleHold, defaultPackUrl),
    },
    animPack,
  };
};

const normalizeClipBinding = (
  raw: unknown,
  defaultPackUrl: string | undefined,
): EquipmentClipBinding | undefined => {
  if (typeof raw === 'string') {
    const clipName = raw.trim();
    if (!clipName) return undefined;
    return defaultPackUrl ? { animPackUrl: defaultPackUrl, clipName } : { clipName };
  }

  if (!raw || typeof raw !== 'object') return undefined;

  const binding = raw as Partial<EquipmentClipBinding>;
  const animPackUrl =
    typeof binding.animPackUrl === 'string' && binding.animPackUrl.trim()
      ? binding.animPackUrl.trim()
      : defaultPackUrl;
  const clipName =
    typeof binding.clipName === 'string' && binding.clipName.trim()
      ? binding.clipName.trim()
      : undefined;

  if (!animPackUrl && !clipName) return undefined;

  return {
    animPackUrl,
    clipName,
  };
};

export const parseEquipmentDocument = (raw: unknown): EquipmentDocument | null => {
  if (typeof raw === 'string') {
    try {
      return normalizeEquipmentObject(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  return normalizeEquipmentObject(raw);
};

export const parseEquipmentDocumentStrict = (raw: string): EquipmentDocument => {
  const doc = parseEquipmentDocument(raw);
  if (!doc) throw new Error('Invalid .equipment file');
  return doc;
};

export const serializeEquipmentDocument = (doc: EquipmentDocument): string =>
  `${JSON.stringify(
    {
      ...doc,
      mesh: {
        ...doc.mesh,
        rotation: [0, 0, 0, 1] as [number, number, number, number],
      },
    },
    null,
    2,
  )}\n`;

export const collectEquipmentDocumentTags = (doc: EquipmentDocument): string[] =>
  [...new Set(doc.slotTags)].sort((a, b) => a.localeCompare(b));

const toWeaponClip = (binding: EquipmentClipBinding | undefined) => {
  if (!binding?.clipName) return undefined;
  return {
    clipName: binding.clipName,
    animPackUrl: binding.animPackUrl,
  };
};

export const equipmentToWeaponDefinition = (doc: EquipmentDocument): WeaponDefinition => ({
  id: doc.id,
  displayName: doc.displayName,
  kind: doc.kind,
  slotTags: [...doc.slotTags],
  mesh: {
    ...doc.mesh,
    rotation: [0, 0, 0, 1],
  },
  colliders: doc.colliders.map((c) => ({
    role: c.role,
    shape: c.shape,
    halfExtents: c.halfExtents,
    radius: c.radius,
    halfHeight: c.halfHeight,
    position: c.position,
    rotation: c.rotation,
    scale: c.scale,
  })),
  projectile: doc.projectile ? { ...doc.projectile } : undefined,
  stats: { ...doc.stats },
  clips: {
    attack: toWeaponClip(doc.clips.attack),
    aim: toWeaponClip(doc.clips.aim),
    reload: toWeaponClip(doc.clips.reload),
    block: toWeaponClip(doc.clips.block),
    idleHold: toWeaponClip(doc.clips.idleHold),
  },
  animPack: doc.animPack ? { generalGlb: doc.animPack.generalGlb } : undefined,
});
