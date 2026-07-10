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
};

export type PropDocumentColliderPart = PropDocumentPartLocal & {
  id: string;
  name: string;
  kind: 'collider';
  shape: 'box' | 'cylinder' | 'sphere';
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

export const identityPartLocal = (): PropDocumentPartLocal => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

const normalizePart = (raw: unknown): PropDocumentPart => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid .prop part');

  const part = raw as Partial<PropDocumentPart> & { id?: string; name?: string };
  if (typeof part.id !== 'string') throw new Error('Invalid .prop part id');

  const name = typeof part.name === 'string' && part.name.length > 0 ? part.name : part.id;

  if (part.kind === 'asset') {
    if (typeof part.url !== 'string') throw new Error('Invalid asset part url');
    return {
      ...(part as PropDocumentAssetPart),
      id: part.id,
      name,
      kind: 'asset',
      url: part.url,
      materialPrefix: typeof part.materialPrefix === 'string' ? part.materialPrefix : 'prop',
      position: (part.position as [number, number, number]) ?? [0, 0, 0],
      rotation: (part.rotation as [number, number, number, number]) ?? [0, 0, 0, 1],
      scale: (part.scale as [number, number, number]) ?? [1, 1, 1],
    };
  }

  if (part.kind === 'collider') {
    if (part.shape !== 'box' && part.shape !== 'cylinder' && part.shape !== 'sphere') {
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
