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

export type ActorColliderShape = 'box' | 'cylinder' | 'sphere' | 'capsule';

export type ActorDocumentColliderParent =
  | { kind: 'bone'; boneName: string }
  | { kind: 'attachment'; attachmentId: string };

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

export type ActorDocument = {
  version: 1;
  id: string;
  displayName: string;
  tags: string[];
  aiPackage: ActorAiPackage;
  character: ActorDocumentCharacter | null;
  attachments: ActorDocumentAttachment[];
  colliders: ActorDocumentCollider[];
};

export type ActorEditorSelection =
  | { kind: 'actor' }
  | { kind: 'bone'; boneName: string }
  | { kind: 'attachment'; attachmentId: string }
  | { kind: 'collider'; colliderId: string }
  | null;

export const createEmptyActorDocument = (): ActorDocument => ({
  version: 1,
  id: 'untitled',
  displayName: 'Untitled Actor',
  tags: [],
  aiPackage: 'none',
  character: null,
  attachments: [],
  colliders: [],
});

export const actorNeedsName = (doc: ActorDocument): boolean =>
  !doc.displayName.trim() ||
  doc.id === 'untitled' ||
  doc.displayName.trim() === 'Untitled Actor';

export const slugifyActorId = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'untitled';
};

export const applyActorName = (doc: ActorDocument, name: string): ActorDocument => {
  const trimmed = name.trim();
  if (!trimmed) return doc;

  return {
    ...doc,
    id: slugifyActorId(trimmed),
    displayName: trimmed,
  };
};

export const identityAttachmentLocal = (): ActorDocumentPartLocal => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

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
    part.shape !== 'sphere' &&
    part.shape !== 'capsule'
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
    return { ...base, shape: 'cylinder', radius: 0.35, halfHeight: 0.5 };
  }

  if (shape === 'capsule') {
    return { ...base, shape: 'capsule', radius: 0.3, halfHeight: 0.5 };
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
