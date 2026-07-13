import {
  identityAttachmentLocal as engineIdentityAttachmentLocal,
  DEFAULT_CHARACTER_BODY_CYLINDER,
  type ActorAttachmentDef,
  type ActorCharacterDef,
  type ActorColliderDef,
  type ActorColliderParent,
  type ActorColliderShape,
  type ActorDefinition,
} from 'viberanium';
import { slugifyDocumentId } from '../slugify.ts';

export type ActorAiPackage = 'none' | 'testAi';

export type ActorDocumentPartLocal = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type ActorDocumentCharacter = {
  url: string;
  materialPrefix: string;
  textureVariantUrl?: string | null;
};

export type ActorDocumentAttachment = ActorDocumentPartLocal & {
  id: string;
  name: string;
  boneName: string;
  url: string;
  materialPrefix: string;
  textureVariantUrl?: string | null;
  tags: string[];
  placeholder: boolean;
};

export type ActorDocumentColliderParent = ActorColliderParent;

export type ActorDocumentCollider = ActorDocumentPartLocal & {
  id: string;
  name: string;
  shape: ActorColliderShape;
  halfExtents?: [number, number, number];
  radius?: number;
  halfHeight?: number;
  collision: boolean;
  hitbox: boolean;
  parent: ActorDocumentColliderParent;
};

export type ActorDocumentAnimPack = {
  generalGlb: string;
  movementGlb: string;
};

export type ActorDocumentClips = {
  idle: string;
  run: string;
  jumpStart: string;
  jumpIdle: string;
  jumpLand: string;
};

export type ActorDocument = {
  version: 1;
  id: string;
  displayName: string;
  tags: string[];
  aiPackage: ActorAiPackage;
  character: ActorDocumentCharacter | null;
  attachments: ActorDocumentAttachment[];
  colliders: ActorDocumentCollider[];
  animPack?: ActorDocumentAnimPack | null;
  clips?: ActorDocumentClips | null;
  baseColorTextureUrl?: string;
  visualYOffset?: number;
};

export type ActorEditorSelection =
  | { kind: 'actor' }
  | { kind: 'bone'; boneName: string }
  | { kind: 'attachment'; attachmentId: string }
  | { kind: 'collider'; colliderId: string }
  | null;

export type { ActorColliderShape };

export const createEmptyActorDocument = (): ActorDocument => ({
  version: 1,
  id: 'untitled',
  displayName: 'Untitled Actor',
  tags: [],
  aiPackage: 'none',
  character: null,
  attachments: [],
  colliders: [],
  animPack: null,
  clips: null,
});

export const actorNeedsName = (doc: ActorDocument): boolean =>
  !doc.displayName.trim() ||
  doc.id === 'untitled' ||
  doc.displayName.trim() === 'Untitled Actor';

export const slugifyActorId = slugifyDocumentId;

export const applyActorName = (doc: ActorDocument, name: string): ActorDocument => {
  const trimmed = name.trim();
  if (!trimmed) return doc;

  return {
    ...doc,
    id: slugifyDocumentId(trimmed),
    displayName: trimmed,
  };
};

export const identityAttachmentLocal = (): ActorDocumentPartLocal => engineIdentityAttachmentLocal();

const normalizeTags = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
};

const normalizeAttachment = (raw: unknown): ActorDocumentAttachment => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid .actor attachment');

  const part = raw as Partial<ActorDocumentAttachment>;
  if (typeof part.id !== 'string') throw new Error('Invalid .actor attachment id');
  if (typeof part.url !== 'string') throw new Error('Invalid .actor attachment url');
  if (typeof part.boneName !== 'string') throw new Error('Invalid .actor attachment boneName');

  const name = typeof part.name === 'string' && part.name.length > 0 ? part.name : part.id;

  return {
    id: part.id,
    name,
    boneName: part.boneName,
    url: part.url,
    materialPrefix: typeof part.materialPrefix === 'string' ? part.materialPrefix : 'attachment',
    textureVariantUrl:
      typeof part.textureVariantUrl === 'string' || part.textureVariantUrl === null
        ? part.textureVariantUrl
        : null,
    tags: normalizeTags(part.tags),
    placeholder: part.placeholder === true,
    position: (part.position as [number, number, number]) ?? [0, 0, 0],
    rotation: (part.rotation as [number, number, number, number]) ?? [0, 0, 0, 1],
    scale: (part.scale as [number, number, number]) ?? [1, 1, 1],
  };
};

const normalizeColliderParent = (raw: unknown): ActorDocumentColliderParent => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid .actor collider parent');

  const parent = raw as Partial<ActorDocumentColliderParent> & {
    boneName?: string;
    attachmentId?: string;
  };

  if (parent.kind === 'character') {
    return { kind: 'character' };
  }

  if (parent.kind === 'bone' && typeof parent.boneName === 'string') {
    return { kind: 'bone', boneName: parent.boneName };
  }

  if (parent.kind === 'attachment' && typeof parent.attachmentId === 'string') {
    return { kind: 'attachment', attachmentId: parent.attachmentId };
  }

  throw new Error('Invalid .actor collider parent');
};

const normalizeCollider = (raw: unknown): ActorDocumentCollider => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid .actor collider');

  const part = raw as Partial<ActorDocumentCollider>;
  if (typeof part.id !== 'string') throw new Error('Invalid .actor collider id');
  if (
    part.shape !== 'box' &&
    part.shape !== 'cylinder' &&
    part.shape !== 'sphere'
  ) {
    throw new Error('Invalid .actor collider shape');
  }

  const name = typeof part.name === 'string' && part.name.length > 0 ? part.name : part.id;
  const collision = part.collision !== false;
  const hitbox = part.hitbox === true;
  const flags =
    collision || hitbox
      ? { collision, hitbox }
      : { collision: true, hitbox: false };

  return {
    id: part.id,
    name,
    shape: part.shape,
    halfExtents: part.halfExtents as [number, number, number] | undefined,
    radius: typeof part.radius === 'number' ? part.radius : undefined,
    halfHeight: typeof part.halfHeight === 'number' ? part.halfHeight : undefined,
    ...flags,
    parent: normalizeColliderParent(part.parent),
    position: (part.position as [number, number, number]) ?? [0, 0, 0],
    rotation: (part.rotation as [number, number, number, number]) ?? [0, 0, 0, 1],
    scale: (part.scale as [number, number, number]) ?? [1, 1, 1],
  };
};

const normalizeCharacter = (raw: unknown): ActorDocumentCharacter | null => {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid .actor character');

  const c = raw as Partial<ActorDocumentCharacter>;
  if (typeof c.url !== 'string') throw new Error('Invalid .actor character url');

  return {
    url: c.url,
    materialPrefix: typeof c.materialPrefix === 'string' ? c.materialPrefix : 'character',
    textureVariantUrl:
      typeof c.textureVariantUrl === 'string' || c.textureVariantUrl === null
        ? c.textureVariantUrl
        : null,
  };
};

const normalizeAnimPack = (raw: unknown): ActorDocumentAnimPack | null => {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid .actor animPack');

  const pack = raw as Partial<ActorDocumentAnimPack>;
  if (typeof pack.generalGlb !== 'string' || typeof pack.movementGlb !== 'string') {
    throw new Error('Invalid .actor animPack');
  }

  return { generalGlb: pack.generalGlb, movementGlb: pack.movementGlb };
};

const normalizeClips = (raw: unknown): ActorDocumentClips | null => {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid .actor clips');

  const clips = raw as Partial<ActorDocumentClips>;
  if (
    typeof clips.idle !== 'string' ||
    typeof clips.run !== 'string' ||
    typeof clips.jumpStart !== 'string' ||
    typeof clips.jumpIdle !== 'string' ||
    typeof clips.jumpLand !== 'string'
  ) {
    throw new Error('Invalid .actor clips');
  }

  return {
    idle: clips.idle,
    run: clips.run,
    jumpStart: clips.jumpStart,
    jumpIdle: clips.jumpIdle,
    jumpLand: clips.jumpLand,
  };
};

export const parseActorDocument = (raw: string): ActorDocument => {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid .actor file');

  const doc = data as Partial<ActorDocument>;
  if (doc.version !== 1) throw new Error('Unsupported .actor version');
  if (typeof doc.id !== 'string' || typeof doc.displayName !== 'string') {
    throw new Error('Invalid .actor header');
  }
  if (!Array.isArray(doc.attachments)) throw new Error('Invalid .actor attachments');

  const aiPackage: ActorAiPackage =
    doc.aiPackage === 'testAi' || doc.aiPackage === 'none' ? doc.aiPackage : 'none';

  const colliders = Array.isArray(doc.colliders) ? doc.colliders.map(normalizeCollider) : [];

  return {
    version: 1,
    id: doc.id,
    displayName: doc.displayName,
    tags: normalizeTags(doc.tags),
    aiPackage,
    character: normalizeCharacter(doc.character),
    attachments: doc.attachments.map(normalizeAttachment),
    colliders,
    animPack: normalizeAnimPack(doc.animPack),
    clips: normalizeClips(doc.clips),
    ...(typeof doc.baseColorTextureUrl === 'string'
      ? { baseColorTextureUrl: doc.baseColorTextureUrl }
      : {}),
    ...(typeof doc.visualYOffset === 'number' ? { visualYOffset: doc.visualYOffset } : {}),
  };
};

export const serializeActorDocument = (doc: ActorDocument): string =>
  `${JSON.stringify(doc, null, 2)}\n`;

export const attachmentAssetLabel = (attachment: ActorDocumentAttachment): string =>
  attachment.url.split('/').slice(-1)[0] ?? attachment.url;

export const attachmentListLabel = (attachment: ActorDocumentAttachment): string => {
  const base = `${attachment.name} - ${attachmentAssetLabel(attachment)}`;
  return attachment.placeholder ? `${base} (placeholder)` : base;
};

export const colliderListLabel = (collider: ActorDocumentCollider): string =>
  `${collider.name} - ${collider.shape}`;

export const defaultActorCollider = (
  shape: ActorColliderShape,
  id: string,
  parent: ActorDocumentColliderParent,
): ActorDocumentCollider => {
  const local = identityAttachmentLocal();
  const base = {
    id,
    name: id,
    collision: true,
    hitbox: false,
    parent,
    ...local,
  };

  if (shape === 'box') {
    return { ...base, shape: 'box', halfExtents: [0.5, 0.5, 0.5] };
  }

  if (shape === 'cylinder') {
    if (parent.kind === 'character') {
      return {
        ...base,
        shape: 'cylinder',
        radius: DEFAULT_CHARACTER_BODY_CYLINDER.radius ?? 0.39323,
        halfHeight: DEFAULT_CHARACTER_BODY_CYLINDER.halfHeight ?? 1.09563,
      };
    }
    return { ...base, shape: 'cylinder', radius: 0.35, halfHeight: 0.5 };
  }

  return { ...base, shape: 'sphere', radius: 0.5 };
};

export const collectDocumentTags = (doc: ActorDocument): string[] => {
  const tags = new Set<string>();

  for (const t of doc.tags) tags.add(t);
  for (const a of doc.attachments) {
    for (const t of a.tags) tags.add(t);
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
};

const attachmentToDef = (attachment: ActorDocumentAttachment): ActorAttachmentDef => ({
  id: attachment.id,
  name: attachment.name,
  boneName: attachment.boneName,
  url: attachment.url,
  materialPrefix: attachment.materialPrefix,
  textureVariantUrl: attachment.textureVariantUrl,
  tags: attachment.tags,
  placeholder: attachment.placeholder,
  position: attachment.position,
  rotation: attachment.rotation,
  scale: attachment.scale,
});

const colliderToDef = (collider: ActorDocumentCollider): ActorColliderDef => ({
  id: collider.id,
  name: collider.name,
  shape: collider.shape,
  halfExtents: collider.halfExtents,
  radius: collider.radius,
  halfHeight: collider.halfHeight,
  collision: collider.collision,
  hitbox: collider.hitbox,
  parent: collider.parent,
  position: collider.position,
  rotation: collider.rotation,
  scale: collider.scale,
});

export const toActorDefinition = (doc: ActorDocument): ActorDefinition => {
  if (!doc.character) throw new Error('Actor document has no character');
  if (!doc.animPack) throw new Error('Actor document has no animPack');
  if (!doc.clips) throw new Error('Actor document has no clips');

  const character: ActorCharacterDef = {
    url: doc.character.url,
    materialPrefix: doc.character.materialPrefix,
    textureVariantUrl: doc.character.textureVariantUrl,
  };

  return {
    id: doc.id,
    displayName: doc.displayName,
    tags: doc.tags,
    character,
    attachments: doc.attachments.map(attachmentToDef),
    colliders: doc.colliders.map(colliderToDef),
    animPack: doc.animPack,
    clips: doc.clips,
    ...(doc.baseColorTextureUrl ? { baseColorTextureUrl: doc.baseColorTextureUrl } : {}),
    ...(doc.visualYOffset !== undefined ? { visualYOffset: doc.visualYOffset } : {}),
  };
};

export const fromActorDefinition = (
  def: ActorDefinition,
  aiPackage: ActorAiPackage = 'none',
): ActorDocument => ({
  version: 1,
  id: def.id,
  displayName: def.displayName,
  tags: def.tags,
  aiPackage,
  character: {
    url: def.character.url,
    materialPrefix: def.character.materialPrefix,
    textureVariantUrl: def.character.textureVariantUrl,
  },
  attachments: def.attachments.map((a) => ({ ...a })),
  colliders: def.colliders.map((c) => ({ ...c })),
  animPack: { ...def.animPack },
  clips: { ...def.clips },
  ...(def.baseColorTextureUrl ? { baseColorTextureUrl: def.baseColorTextureUrl } : {}),
  ...(def.visualYOffset !== undefined ? { visualYOffset: def.visualYOffset } : {}),
});
