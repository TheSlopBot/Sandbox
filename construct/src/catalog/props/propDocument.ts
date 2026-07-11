import { identityPartLocal as engineIdentityPartLocal, type PropDefinition } from 'viberanium';
import { slugifyDocumentId } from '../slugify.ts';

export type PropDocumentPartLocal = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type PropDocumentAssetPart = PropDocumentPartLocal & {
  id: string;
  name: string;
  kind: 'asset';
  url: string;
  materialPrefix: string;
  textureVariantUrl?: string | null;
  tags: string[];
};

export type PropDocumentColliderPart = PropDocumentPartLocal & {
  id: string;
  name: string;
  kind: 'collider';
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule';
  halfExtents?: [number, number, number];
  radius?: number;
  halfHeight?: number;
};

export type PropDocumentPart = PropDocumentAssetPart | PropDocumentColliderPart;

export type PropDocument = {
  version: 1;
  id: string;
  displayName: string;
  parts: PropDocumentPart[];
};

export type PropEditorTransformMode = 'move' | 'scale' | 'rotate';

export const createEmptyPropDocument = (): PropDocument => ({
  version: 1,
  id: 'untitled',
  displayName: 'Untitled Prop',
  parts: [],
});

export const propNeedsName = (doc: PropDocument): boolean =>
  !doc.displayName.trim() ||
  doc.id === 'untitled' ||
  doc.displayName.trim() === 'Untitled Prop';

export const slugifyPropId = slugifyDocumentId;

export const applyPropName = (doc: PropDocument, name: string): PropDocument => {
  const trimmed = name.trim();
  if (!trimmed) return doc;

  return {
    ...doc,
    id: slugifyDocumentId(trimmed),
    displayName: trimmed,
  };
};

export const identityPartLocal = (): PropDocumentPartLocal => engineIdentityPartLocal();

const normalizePart = (raw: unknown): PropDocumentPart => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid .prop part');

  const part = raw as Partial<PropDocumentPart> & { id?: string; name?: string };
  if (typeof part.id !== 'string') throw new Error('Invalid .prop part id');

  const name = typeof part.name === 'string' && part.name.length > 0 ? part.name : part.id;

  if (part.kind === 'asset') {
    if (typeof part.url !== 'string') throw new Error('Invalid asset part url');
    const tags = Array.isArray(part.tags)
      ? part.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
      : [];
    return {
      ...(part as PropDocumentAssetPart),
      id: part.id,
      name,
      kind: 'asset',
      url: part.url,
      materialPrefix: typeof part.materialPrefix === 'string' ? part.materialPrefix : 'prop',
      textureVariantUrl:
        typeof part.textureVariantUrl === 'string' || part.textureVariantUrl === null
          ? part.textureVariantUrl
          : null,
      tags,
      position: (part.position as [number, number, number]) ?? [0, 0, 0],
      rotation: (part.rotation as [number, number, number, number]) ?? [0, 0, 0, 1],
      scale: (part.scale as [number, number, number]) ?? [1, 1, 1],
    };
  }

  if (part.kind === 'collider') {
    if (
      part.shape !== 'box' &&
      part.shape !== 'cylinder' &&
      part.shape !== 'sphere' &&
      part.shape !== 'capsule'
    ) {
      throw new Error('Invalid collider shape');
    }
    return {
      ...(part as PropDocumentColliderPart),
      id: part.id,
      name,
      kind: 'collider',
      shape: part.shape,
      position: (part.position as [number, number, number]) ?? [0, 0, 0],
      rotation: (part.rotation as [number, number, number, number]) ?? [0, 0, 0, 1],
      scale: (part.scale as [number, number, number]) ?? [1, 1, 1],
    };
  }

  throw new Error('Invalid .prop part kind');
};

export const parsePropDocument = (raw: string): PropDocument => {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid .prop file');

  const doc = data as Partial<PropDocument>;
  if (doc.version !== 1) throw new Error('Unsupported .prop version');
  if (typeof doc.id !== 'string' || typeof doc.displayName !== 'string') {
    throw new Error('Invalid .prop header');
  }
  if (!Array.isArray(doc.parts)) throw new Error('Invalid .prop parts');

  return {
    version: 1,
    id: doc.id,
    displayName: doc.displayName,
    parts: doc.parts.map(normalizePart),
  };
};

export const serializePropDocument = (doc: PropDocument): string =>
  `${JSON.stringify(doc, null, 2)}\n`;

export const partTypeLabel = (part: PropDocumentPart): string =>
  part.kind === 'asset' ? (part.url.split('/').slice(-1)[0] ?? part.url) : part.shape;

export const partListLabel = (part: PropDocumentPart): string =>
  `${part.name} - ${partTypeLabel(part)}`;

export const collectPropDocumentTags = (doc: PropDocument): string[] => {
  const tags = new Set<string>();

  for (const part of doc.parts) {
    if (part.kind !== 'asset') continue;
    for (const t of part.tags) tags.add(t);
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
};

export const toPropDefinition = (doc: PropDocument): PropDefinition => ({
  id: doc.id,
  displayName: doc.displayName,
  parts: doc.parts.map((part) => {
    if (part.kind === 'asset') {
      return {
        id: part.id,
        kind: 'asset' as const,
        url: part.url,
        materialPrefix: part.materialPrefix,
        textureVariantUrl: part.textureVariantUrl,
        tags: part.tags,
        position: part.position,
        rotation: part.rotation,
        scale: part.scale,
      };
    }

    return {
      id: part.id,
      kind: 'collider' as const,
      shape: part.shape,
      halfExtents: part.halfExtents,
      radius: part.radius,
      halfHeight: part.halfHeight,
      position: part.position,
      rotation: part.rotation,
      scale: part.scale,
    };
  }),
});

export const fromPropDefinition = (def: PropDefinition): PropDocument => ({
  version: 1,
  id: def.id,
  displayName: def.displayName,
  parts: def.parts.map((part) => {
    if (part.kind === 'asset') {
      return {
        ...part,
        name: part.id,
        textureVariantUrl: part.textureVariantUrl ?? null,
      };
    }

    return {
      ...part,
      name: part.id,
    };
  }),
});
