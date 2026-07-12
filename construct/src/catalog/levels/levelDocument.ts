import {
  type ActorDefinition,
  type LevelActorInstance,
  type LevelColliderInstance,
  type LevelColliderShape,
  type LevelDefinition,
  type LevelGroundPlane,
  type LevelNavGridConfig,
  type LevelPlayerSpawn,
  type LevelPropInstance,
  type PropDefinition,
  type SimplePropIndex,
  DEFAULT_LEVEL_GROUND_PLANE,
  DEFAULT_LEVEL_NAV_GRID,
  DEFAULT_LEVEL_PLAYER_SPAWN,
  identityLevelLocal,
  normalizeLevelGroundVariant,
  resolveLevelPropDefinition,
} from 'viberanium';
import {
  type ActorAiPackage,
  type ActorDocument,
  type ActorDocumentCharacter,
  fromActorDefinition,
  parseActorDocument,
  serializeActorDocument,
  toActorDefinition,
} from '../actors/actorDocument.ts';
import {
  type PropDocument,
  fromPropDefinition,
  parsePropDocument,
  serializePropDocument,
  toPropDefinition,
} from '../props/propDocument.ts';
import { slugifyDocumentId } from '../slugify.ts';
import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from '../manifest/kaykitMediumDefaults.ts';

export type LevelDocumentPropKind = 'simpleProp' | 'standardProp';
export type LevelDocumentActorKind = 'simpleActor' | 'standardActor';

export const LEVEL_PLAYER_SPAWN_ID = 'playerSpawn';

export const LEVEL_GROUND_PLANE_ID = 'groundPlane';

export const LEVEL_PLAYER_SPAWN_URL =
  'assets/kaykit/KayKit Character Animations 1.1/Mannequin Character/characters/Mannequin_Medium.glb';

export type LevelDocumentPropInstance = LevelPropInstance & {
  name: string;
  groupId?: string | null;
};

export type LevelDocumentActorInstance = LevelActorInstance & {
  name: string;
  aiPackage: ActorAiPackage;
  groupId?: string | null;
};

export type LevelDocumentColliderInstance = LevelColliderInstance & {
  name: string;
  groupId?: string | null;
};

export type LevelDocumentGroup = {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  memberInstanceIds: string[];
};

export type LevelDocumentIndex = {
  simpleProps: Record<string, SimplePropIndex>;
  standardProps: Record<string, PropDocument>;
  simpleActors: Record<string, ActorDocument>;
  standardActors: Record<string, ActorDocument>;
};

export type LevelDocument = {
  version: 1;
  id: string;
  displayName: string;
  navGrid: LevelNavGridConfig;
  index: LevelDocumentIndex;
  composition: {
    props: LevelDocumentPropInstance[];
    actors: LevelDocumentActorInstance[];
    colliders: LevelDocumentColliderInstance[];
  };
  playerSpawn: LevelPlayerSpawn;
  groundPlane: LevelGroundPlane;
  groups: LevelDocumentGroup[];
};

export const createEmptyLevelDocument = (): LevelDocument => ({
  version: 1,
  id: 'untitled',
  displayName: 'Untitled Level',
  navGrid: { ...DEFAULT_LEVEL_NAV_GRID },
  index: {
    simpleProps: {},
    standardProps: {},
    simpleActors: {},
    standardActors: {},
  },
  composition: {
    props: [],
    actors: [],
    colliders: [],
  },
  playerSpawn: {
    position: [...DEFAULT_LEVEL_PLAYER_SPAWN.position] as [number, number, number],
    rotation: [...DEFAULT_LEVEL_PLAYER_SPAWN.rotation] as [number, number, number, number],
  },
  groundPlane: {
    position: [...DEFAULT_LEVEL_GROUND_PLANE.position] as [number, number, number],
    size: DEFAULT_LEVEL_GROUND_PLANE.size,
    variant: DEFAULT_LEVEL_GROUND_PLANE.variant,
  },
  groups: [],
});

export const levelNeedsName = (doc: LevelDocument): boolean =>
  !doc.displayName.trim() ||
  doc.id === 'untitled' ||
  doc.displayName.trim() === 'Untitled Level';

export const slugifyLevelId = slugifyDocumentId;

export const applyLevelName = (doc: LevelDocument, name: string): LevelDocument => {
  const trimmed = name.trim();
  if (!trimmed) return doc;

  return {
    ...doc,
    id: slugifyDocumentId(trimmed),
    displayName: trimmed,
  };
};

const readNumericTriple = (v: unknown): [number, number, number] | null => {
  if (Array.isArray(v) && v.length >= 3) {
    const x = v[0];
    const y = v[1];
    const z = v[2];
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') return [x, y, z];
    return null;
  }

  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const x = o[0] ?? o['0'];
    const y = o[1] ?? o['1'];
    const z = o[2] ?? o['2'];
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') return [x, y, z];
  }

  return null;
};

const readNumericQuat = (v: unknown): [number, number, number, number] | null => {
  if (Array.isArray(v) && v.length >= 4) {
    const x = v[0];
    const y = v[1];
    const z = v[2];
    const w = v[3];
    if (
      typeof x === 'number' &&
      typeof y === 'number' &&
      typeof z === 'number' &&
      typeof w === 'number'
    ) {
      return [x, y, z, w];
    }
    return null;
  }

  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const x = o[0] ?? o['0'];
    const y = o[1] ?? o['1'];
    const z = o[2] ?? o['2'];
    const w = o[3] ?? o['3'];
    if (
      typeof x === 'number' &&
      typeof y === 'number' &&
      typeof z === 'number' &&
      typeof w === 'number'
    ) {
      return [x, y, z, w];
    }
  }

  return null;
};

const normalizeNavGrid = (raw: unknown): LevelNavGridConfig => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LEVEL_NAV_GRID };

  const g = raw as Partial<LevelNavGridConfig>;
  if (
    typeof g.minX !== 'number' ||
    typeof g.maxX !== 'number' ||
    typeof g.minZ !== 'number' ||
    typeof g.maxZ !== 'number' ||
    typeof g.cellSize !== 'number'
  ) {
    return { ...DEFAULT_LEVEL_NAV_GRID };
  }

  return {
    minX: g.minX,
    maxX: g.maxX,
    minZ: g.minZ,
    maxZ: g.maxZ,
    cellSize: g.cellSize,
  };
};

const normalizeSimpleProp = (raw: unknown, key: string): SimplePropIndex => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid simple prop index');

  const entry = raw as Partial<SimplePropIndex>;
  if (typeof entry.url !== 'string') throw new Error('Invalid simple prop url');

  const collider =
    entry.collider && typeof entry.collider === 'object'
      ? (entry.collider as SimplePropIndex['collider'])
      : null;

  return {
    id: typeof entry.id === 'string' ? entry.id : key,
    displayName: typeof entry.displayName === 'string' ? entry.displayName : key,
    url: entry.url,
    materialPrefix: typeof entry.materialPrefix === 'string' ? entry.materialPrefix : 'prop',
    textureVariantUrl:
      typeof entry.textureVariantUrl === 'string' || entry.textureVariantUrl === null
        ? entry.textureVariantUrl
        : null,
    collider,
  };
};

const normalizePropInstance = (raw: unknown): LevelDocumentPropInstance => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid level prop instance');

  const inst = raw as Partial<LevelDocumentPropInstance>;
  if (typeof inst.id !== 'string') throw new Error('Invalid level prop instance id');
  if (typeof inst.indexId !== 'string') throw new Error('Invalid level prop indexId');
  if (inst.kind !== 'simpleProp' && inst.kind !== 'standardProp') {
    throw new Error('Invalid level prop kind');
  }

  const local = identityLevelLocal();

  return {
    id: inst.id,
    name: typeof inst.name === 'string' && inst.name.length > 0 ? inst.name : inst.id,
    kind: inst.kind,
    indexId: inst.indexId,
    position: readNumericTriple(inst.position) ?? [...local.position] as [number, number, number],
    rotation: readNumericQuat(inst.rotation) ?? [...local.rotation] as [number, number, number, number],
    scale: readNumericTriple(inst.scale) ?? [...local.scale] as [number, number, number],
    groupId: typeof inst.groupId === 'string' ? inst.groupId : null,
  };
};

const normalizeActorInstance = (raw: unknown): LevelDocumentActorInstance => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid level actor instance');

  const inst = raw as Partial<LevelDocumentActorInstance>;
  if (typeof inst.id !== 'string') throw new Error('Invalid level actor instance id');
  if (typeof inst.indexId !== 'string') throw new Error('Invalid level actor indexId');
  if (inst.kind !== 'simpleActor' && inst.kind !== 'standardActor') {
    throw new Error('Invalid level actor kind');
  }

  const local = identityLevelLocal();
  const aiPackage: ActorAiPackage = inst.aiPackage === 'testAi' ? 'testAi' : 'none';

  return {
    id: inst.id,
    name: typeof inst.name === 'string' && inst.name.length > 0 ? inst.name : inst.id,
    kind: inst.kind,
    indexId: inst.indexId,
    position: readNumericTriple(inst.position) ?? ([...local.position] as [number, number, number]),
    rotation: readNumericQuat(inst.rotation) ?? ([...local.rotation] as [number, number, number, number]),
    scale: readNumericTriple(inst.scale) ?? ([...local.scale] as [number, number, number]),
    aiPackage,
    groupId: typeof inst.groupId === 'string' ? inst.groupId : null,
  };
};

const normalizeGroup = (raw: unknown): LevelDocumentGroup => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid level group');

  const group = raw as Partial<LevelDocumentGroup>;
  if (typeof group.id !== 'string') throw new Error('Invalid level group id');

  const local = identityLevelLocal();
  const members = Array.isArray(group.memberInstanceIds)
    ? group.memberInstanceIds.filter((id): id is string => typeof id === 'string')
    : [];

  return {
    id: group.id,
    name: typeof group.name === 'string' && group.name.length > 0 ? group.name : group.id,
    position: readNumericTriple(group.position) ?? ([...local.position] as [number, number, number]),
    rotation: readNumericQuat(group.rotation) ?? ([...local.rotation] as [number, number, number, number]),
    scale: readNumericTriple(group.scale) ?? ([...local.scale] as [number, number, number]),
    memberInstanceIds: members,
  };
};

const normalizeColliderInstance = (raw: unknown): LevelDocumentColliderInstance => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid level collider instance');

  const inst = raw as Partial<LevelDocumentColliderInstance>;
  if (typeof inst.id !== 'string') throw new Error('Invalid level collider instance id');

  const shape = inst.shape;
  if (shape !== 'box' && shape !== 'cylinder' && shape !== 'sphere' && shape !== 'capsule') {
    throw new Error('Invalid level collider shape');
  }

  const local = identityLevelLocal();

  return {
    id: inst.id,
    name: typeof inst.name === 'string' && inst.name.length > 0 ? inst.name : inst.id,
    shape: shape as LevelColliderShape,
    halfExtents: readNumericTriple(inst.halfExtents) ?? undefined,
    radius: typeof inst.radius === 'number' ? inst.radius : undefined,
    halfHeight: typeof inst.halfHeight === 'number' ? inst.halfHeight : undefined,
    position: readNumericTriple(inst.position) ?? ([...local.position] as [number, number, number]),
    rotation: readNumericQuat(inst.rotation) ?? ([...local.rotation] as [number, number, number, number]),
    scale: readNumericTriple(inst.scale) ?? ([...local.scale] as [number, number, number]),
    groupId: typeof inst.groupId === 'string' ? inst.groupId : null,
  };
};

const normalizePlayerSpawn = (raw: unknown): LevelPlayerSpawn => {
  if (!raw || typeof raw !== 'object') {
    return {
      position: [...DEFAULT_LEVEL_PLAYER_SPAWN.position] as [number, number, number],
      rotation: [...DEFAULT_LEVEL_PLAYER_SPAWN.rotation] as [number, number, number, number],
    };
  }

  const spawn = raw as Partial<LevelPlayerSpawn>;
  return {
    position: readNumericTriple(spawn.position) ?? ([...DEFAULT_LEVEL_PLAYER_SPAWN.position] as [number, number, number]),
    rotation: readNumericQuat(spawn.rotation) ?? ([...DEFAULT_LEVEL_PLAYER_SPAWN.rotation] as [number, number, number, number]),
  };
};

const normalizeGroundPlane = (raw: unknown): LevelGroundPlane => {
  if (!raw || typeof raw !== 'object') {
    return {
      position: [...DEFAULT_LEVEL_GROUND_PLANE.position] as [number, number, number],
      size: DEFAULT_LEVEL_GROUND_PLANE.size,
      variant: DEFAULT_LEVEL_GROUND_PLANE.variant,
    };
  }

  const plane = raw as Partial<LevelGroundPlane>;
  const size = typeof plane.size === 'number' && plane.size > 0 ? plane.size : DEFAULT_LEVEL_GROUND_PLANE.size;
  return {
    position: readNumericTriple(plane.position) ?? ([...DEFAULT_LEVEL_GROUND_PLANE.position] as [number, number, number]),
    size,
    variant: normalizeLevelGroundVariant(plane.variant),
  };
};

const parseEmbeddedPropDocument = (raw: unknown): PropDocument => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid embedded prop');

  const doc = raw as Partial<PropDocument> & { version?: number };
  if (doc.version === 1 && typeof doc.id === 'string' && Array.isArray(doc.parts)) {
    return parsePropDocument(JSON.stringify(doc));
  }

  if (typeof doc.id === 'string' && typeof doc.displayName === 'string' && Array.isArray(doc.parts)) {
    return fromPropDefinition(doc as PropDefinition);
  }

  throw new Error('Invalid embedded standard prop');
};

const parseEmbeddedActorDocument = (raw: unknown): ActorDocument => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid embedded actor');

  const doc = raw as Partial<ActorDocument> & { version?: number; character?: unknown };
  if (doc.version === 1 && typeof doc.id === 'string') {
    return parseActorDocument(JSON.stringify(doc));
  }

  if (typeof doc.id === 'string' && typeof doc.displayName === 'string' && doc.character) {
    return fromActorDefinition(doc as ActorDefinition, 'none');
  }

  throw new Error('Invalid embedded standard actor');
};

export const parseLevelDocument = (raw: string): LevelDocument => {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid .level file');

  const doc = data as Partial<LevelDocument>;
  if (doc.version !== 1) throw new Error('Unsupported .level version');
  if (typeof doc.id !== 'string' || typeof doc.displayName !== 'string') {
    throw new Error('Invalid .level header');
  }
  if (!doc.index || typeof doc.index !== 'object') throw new Error('Invalid .level index');
  if (!doc.composition || typeof doc.composition !== 'object') {
    throw new Error('Invalid .level composition');
  }

  const indexRaw = doc.index as Partial<LevelDocumentIndex>;
  const simpleProps: Record<string, SimplePropIndex> = {};
  for (const [key, value] of Object.entries(indexRaw.simpleProps ?? {})) {
    simpleProps[key] = normalizeSimpleProp(value, key);
  }

  const standardProps: Record<string, PropDocument> = {};
  for (const [key, value] of Object.entries(indexRaw.standardProps ?? {})) {
    standardProps[key] = parseEmbeddedPropDocument(value);
  }

  const simpleActors: Record<string, ActorDocument> = {};
  for (const [key, value] of Object.entries(indexRaw.simpleActors ?? {})) {
    simpleActors[key] = parseEmbeddedActorDocument(value);
  }

  const standardActors: Record<string, ActorDocument> = {};
  for (const [key, value] of Object.entries(indexRaw.standardActors ?? {})) {
    standardActors[key] = parseEmbeddedActorDocument(value);
  }

  const compositionRaw = doc.composition as {
    props?: unknown[];
    actors?: unknown[];
    colliders?: unknown[];
  };

  return {
    version: 1,
    id: doc.id,
    displayName: doc.displayName,
    navGrid: normalizeNavGrid(doc.navGrid),
    index: {
      simpleProps,
      standardProps,
      simpleActors,
      standardActors,
    },
    composition: {
      props: (compositionRaw.props ?? []).map(normalizePropInstance),
      actors: (compositionRaw.actors ?? []).map(normalizeActorInstance),
      colliders: (compositionRaw.colliders ?? []).map(normalizeColliderInstance),
    },
    playerSpawn: normalizePlayerSpawn((doc as { playerSpawn?: unknown }).playerSpawn),
    groundPlane: normalizeGroundPlane((doc as { groundPlane?: unknown }).groundPlane),
    groups: Array.isArray(doc.groups) ? doc.groups.map(normalizeGroup) : [],
  };
};

export const serializeLevelDocument = (doc: LevelDocument): string =>
  `${JSON.stringify(doc, null, 2)}\n`;

export const cloneLevelDocument = (doc: LevelDocument): LevelDocument =>
  parseLevelDocument(serializeLevelDocument(doc));

export const toLevelDefinition = (doc: LevelDocument): LevelDefinition => {
  const standardProps: Record<string, PropDefinition> = {};
  for (const [key, value] of Object.entries(doc.index.standardProps)) {
    standardProps[key] = toPropDefinition(value);
  }

  const simpleActors: Record<string, ActorDefinition> = {};
  for (const [key, value] of Object.entries(doc.index.simpleActors)) {
    simpleActors[key] = toActorDefinition(value);
  }

  const standardActors: Record<string, ActorDefinition> = {};
  for (const [key, value] of Object.entries(doc.index.standardActors)) {
    standardActors[key] = toActorDefinition(value);
  }

  return {
    id: doc.id,
    displayName: doc.displayName,
    navGrid: { ...doc.navGrid },
    index: {
      simpleProps: { ...doc.index.simpleProps },
      standardProps,
      simpleActors,
      standardActors,
    },
    composition: {
      props: doc.composition.props.map(({ id, kind, indexId, position, rotation, scale }) => ({
        id,
        kind,
        indexId,
        position: [...position] as [number, number, number],
        rotation: [...rotation] as [number, number, number, number],
        scale: [...scale] as [number, number, number],
      })),
      actors: doc.composition.actors.map(({ id, kind, indexId, position, rotation, scale }) => ({
        id,
        kind,
        indexId,
        position: [...position] as [number, number, number],
        rotation: [...rotation] as [number, number, number, number],
        scale: [...scale] as [number, number, number],
      })),
      colliders: doc.composition.colliders.map(
        ({ id, shape, halfExtents, radius, halfHeight, position, rotation, scale }) => ({
          id,
          shape,
          halfExtents: halfExtents ? ([...halfExtents] as [number, number, number]) : undefined,
          radius,
          halfHeight,
          position: [...position] as [number, number, number],
          rotation: [...rotation] as [number, number, number, number],
          scale: [...scale] as [number, number, number],
        }),
      ),
    },
    playerSpawn: {
      position: [...doc.playerSpawn.position] as [number, number, number],
      rotation: [...doc.playerSpawn.rotation] as [number, number, number, number],
    },
    groundPlane: {
      position: [...doc.groundPlane.position] as [number, number, number],
      size: doc.groundPlane.size,
      variant: doc.groundPlane.variant,
    },
  };
};

export const collectActorAiPackages = (doc: LevelDocument): Record<string, ActorAiPackage> => {
  const map: Record<string, ActorAiPackage> = {};
  for (const actor of doc.composition.actors) {
    map[actor.id] = actor.aiPackage;
  }
  return map;
};

export const simplePropFingerprint = (
  url: string,
  materialPrefix: string,
  textureVariantUrl: string | null | undefined,
): string => `${url}|${materialPrefix}|${textureVariantUrl ?? ''}`;

export const findSimplePropIndexId = (
  doc: LevelDocument,
  url: string,
  materialPrefix: string,
  textureVariantUrl: string | null | undefined,
): string | null => {
  const fp = simplePropFingerprint(url, materialPrefix, textureVariantUrl);
  for (const [id, entry] of Object.entries(doc.index.simpleProps)) {
    if (simplePropFingerprint(entry.url, entry.materialPrefix, entry.textureVariantUrl) === fp) {
      return id;
    }
  }
  return null;
};

export const findStandardPropIndexId = (doc: LevelDocument, sourceId: string): string | null => {
  for (const [id, entry] of Object.entries(doc.index.standardProps)) {
    if (entry.id === sourceId || id === sourceId) return id;
  }
  return null;
};

export const findStandardActorIndexId = (doc: LevelDocument, sourceId: string): string | null => {
  for (const [id, entry] of Object.entries(doc.index.standardActors)) {
    if (entry.id === sourceId || id === sourceId) return id;
  }
  return null;
};

export const findSimpleActorIndexId = (
  doc: LevelDocument,
  url: string,
  materialPrefix: string,
  textureVariantUrl: string | null | undefined,
): string | null => {
  const fp = simplePropFingerprint(url, materialPrefix, textureVariantUrl);
  for (const [id, entry] of Object.entries(doc.index.simpleActors)) {
    const character = entry.character;
    if (!character) continue;
    if (
      simplePropFingerprint(character.url, character.materialPrefix, character.textureVariantUrl) ===
      fp
    ) {
      return id;
    }
  }
  return null;
};

export const nextIndexId = (prefix: string, existing: Record<string, unknown>): string => {
  let n = Object.keys(existing).length;
  let id = `${prefix}${n}`;
  while (id in existing) {
    n += 1;
    id = `${prefix}${n}`;
  }
  return id;
};

export const maxIdSuffix = (prefix: string, ids: Iterable<string>): number => {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let max = 0;
  for (const id of ids) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
};

const remappedUniqueIds = <T extends { id: string }>(
  items: T[],
  prefix: string,
  used: Set<string>,
): { items: T[]; changed: boolean } => {
  let next = maxIdSuffix(prefix, [...used, ...items.map((item) => item.id)]);
  let changed = false;
  const result = items.map((item) => {
    if (!used.has(item.id)) {
      used.add(item.id);
      return item;
    }

    next += 1;
    const id = `${prefix}${next}`;
    used.add(id);
    changed = true;
    return { ...item, id };
  });
  return { items: result, changed };
};

export const ensureUniqueInstanceIds = (doc: LevelDocument): LevelDocument => {
  const used = new Set<string>();
  const props = remappedUniqueIds(doc.composition.props, 'prop_', used);
  const actors = remappedUniqueIds(doc.composition.actors, 'actor_', used);
  const colliders = remappedUniqueIds(doc.composition.colliders, 'col_', used);

  if (!props.changed && !actors.changed && !colliders.changed) return doc;

  return {
    ...doc,
    composition: {
      props: props.items,
      actors: actors.items,
      colliders: colliders.items,
    },
  };
};

export const uniqueInstanceName = (base: string, used: Set<string>): string => {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
};

export const allInstanceNames = (doc: LevelDocument): Set<string> => {
  const used = new Set<string>();
  for (const p of doc.composition.props) used.add(p.name);
  for (const a of doc.composition.actors) used.add(a.name);
  for (const c of doc.composition.colliders) used.add(c.name);
  return used;
};

export const withAnimDefaults = (doc: ActorDocument): ActorDocument => {
  if (doc.animPack && doc.clips) return doc;

  return {
    ...doc,
    animPack: doc.animPack ?? { ...KAYKIT_MEDIUM_ANIM_PACK },
    clips: doc.clips ?? { ...KAYKIT_MEDIUM_CLIPS },
  };
};

export const resolveInstancePropDefinition = (
  doc: LevelDocument,
  instance: LevelDocumentPropInstance,
): PropDefinition | null => {
  if (instance.kind === 'standardProp') {
    const entry = doc.index.standardProps[instance.indexId];
    return entry ? toPropDefinition(entry) : null;
  }

  const entry = doc.index.simpleProps[instance.indexId];
  if (!entry) return null;

  const wrapper: LevelDefinition = {
    id: doc.id,
    displayName: doc.displayName,
    navGrid: doc.navGrid,
    index: { simpleProps: doc.index.simpleProps, standardProps: {}, simpleActors: {}, standardActors: {} },
    composition: { props: [], actors: [], colliders: [] },
    playerSpawn: doc.playerSpawn,
    groundPlane: doc.groundPlane,
  };
  return resolveLevelPropDefinition(wrapper, instance);
};

export const resolveInstanceActorCharacter = (
  doc: LevelDocument,
  instance: LevelDocumentActorInstance,
): ActorDocumentCharacter | null => {
  const entry =
    instance.kind === 'standardActor'
      ? doc.index.standardActors[instance.indexId]
      : doc.index.simpleActors[instance.indexId];
  return entry?.character ?? null;
};

export const resolveInstanceActorDocument = (
  doc: LevelDocument,
  instance: LevelDocumentActorInstance,
): ActorDocument | null => {
  const entry =
    instance.kind === 'standardActor'
      ? doc.index.standardActors[instance.indexId]
      : doc.index.simpleActors[instance.indexId];
  return entry ?? null;
};

export { serializePropDocument, serializeActorDocument };
