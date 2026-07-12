import {
  type ActorDefinition,
  type LevelColliderInstance,
  type LevelDefinition,
  type LevelGroundPlane,
  type LevelNavGridConfig,
  type LevelPlayerSpawn,
  type PropDefinition,
  type SimplePropIndex,
  DEFAULT_LEVEL_GROUND_PLANE,
  DEFAULT_LEVEL_NAV_GRID,
  DEFAULT_LEVEL_PLAYER_SPAWN,
  normalizeLevelGroundVariant,
} from 'viberanium';

export type LevelAiPackage = 'none' | 'testAi';

export type ParsedLevelFile = {
  definition: LevelDefinition;
  aiPackages: Record<string, LevelAiPackage>;
  documentJson: string;
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

const toPropDefinition = (raw: unknown): PropDefinition => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid prop in .level');
  const doc = raw as Partial<PropDefinition> & { parts?: unknown[] };
  if (typeof doc.id !== 'string' || typeof doc.displayName !== 'string' || !Array.isArray(doc.parts)) {
    throw new Error('Invalid prop definition in .level');
  }
  return {
    id: doc.id,
    displayName: doc.displayName,
    parts: doc.parts.map((part) => {
      if (!part || typeof part !== 'object') throw new Error('Invalid prop part');
      const p = part as Record<string, unknown>;
      if (p.kind === 'asset') {
        return {
          id: String(p.id),
          kind: 'asset' as const,
          url: String(p.url),
          materialPrefix: typeof p.materialPrefix === 'string' ? p.materialPrefix : 'prop',
          textureVariantUrl:
            typeof p.textureVariantUrl === 'string' || p.textureVariantUrl === null
              ? (p.textureVariantUrl as string | null)
              : null,
          tags: Array.isArray(p.tags)
            ? p.tags.filter((t): t is string => typeof t === 'string')
            : [],
          position: readNumericTriple(p.position) ?? [0, 0, 0],
          rotation: readNumericQuat(p.rotation) ?? [0, 0, 0, 1],
          scale: readNumericTriple(p.scale) ?? [1, 1, 1],
        };
      }
      return {
        id: String(p.id),
        kind: 'collider' as const,
        shape: p.shape as 'box' | 'cylinder' | 'sphere' | 'capsule',
        halfExtents: readNumericTriple(p.halfExtents) ?? undefined,
        radius: typeof p.radius === 'number' ? p.radius : undefined,
        halfHeight: typeof p.halfHeight === 'number' ? p.halfHeight : undefined,
        position: readNumericTriple(p.position) ?? [0, 0, 0],
        rotation: readNumericQuat(p.rotation) ?? [0, 0, 0, 1],
        scale: readNumericTriple(p.scale) ?? [1, 1, 1],
      };
    }),
  };
};

const toActorDefinition = (raw: unknown): ActorDefinition => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid actor in .level');
  const doc = raw as Partial<ActorDefinition> & {
    character?: { url?: string; materialPrefix?: string; textureVariantUrl?: string | null };
    animPack?: { generalGlb?: string; movementGlb?: string };
    clips?: Record<string, string>;
  };
  if (typeof doc.id !== 'string' || typeof doc.displayName !== 'string') {
    throw new Error('Invalid actor header in .level');
  }
  if (!doc.character || typeof doc.character.url !== 'string') {
    throw new Error('Invalid actor character in .level');
  }
  if (!doc.animPack || typeof doc.animPack.generalGlb !== 'string' || typeof doc.animPack.movementGlb !== 'string') {
    throw new Error('Invalid actor animPack in .level');
  }
  if (
    !doc.clips ||
    typeof doc.clips.idle !== 'string' ||
    typeof doc.clips.run !== 'string' ||
    typeof doc.clips.jumpStart !== 'string' ||
    typeof doc.clips.jumpIdle !== 'string' ||
    typeof doc.clips.jumpLand !== 'string'
  ) {
    throw new Error('Invalid actor clips in .level');
  }

  return {
    id: doc.id,
    displayName: doc.displayName,
    tags: Array.isArray(doc.tags) ? doc.tags.filter((t): t is string => typeof t === 'string') : [],
    character: {
      url: doc.character.url,
      materialPrefix:
        typeof doc.character.materialPrefix === 'string' ? doc.character.materialPrefix : 'character',
      textureVariantUrl: doc.character.textureVariantUrl,
    },
    attachments: Array.isArray(doc.attachments) ? (doc.attachments as ActorDefinition['attachments']) : [],
    colliders: Array.isArray(doc.colliders) ? (doc.colliders as ActorDefinition['colliders']) : [],
    animPack: {
      generalGlb: doc.animPack.generalGlb,
      movementGlb: doc.animPack.movementGlb,
    },
    clips: {
      idle: doc.clips.idle,
      run: doc.clips.run,
      jumpStart: doc.clips.jumpStart,
      jumpIdle: doc.clips.jumpIdle,
      jumpLand: doc.clips.jumpLand,
    },
    baseColorTextureUrl: typeof doc.baseColorTextureUrl === 'string' ? doc.baseColorTextureUrl : undefined,
    visualYOffset: typeof doc.visualYOffset === 'number' ? doc.visualYOffset : undefined,
  };
};

const normalizeSimpleProp = (raw: unknown, key: string): SimplePropIndex => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid simple prop');
  const entry = raw as Partial<SimplePropIndex>;
  if (typeof entry.url !== 'string') throw new Error('Invalid simple prop');
  return {
    id: typeof entry.id === 'string' ? entry.id : key,
    displayName: typeof entry.displayName === 'string' ? entry.displayName : key,
    url: entry.url,
    materialPrefix: typeof entry.materialPrefix === 'string' ? entry.materialPrefix : 'prop',
    textureVariantUrl:
      typeof entry.textureVariantUrl === 'string' || entry.textureVariantUrl === null
        ? entry.textureVariantUrl
        : null,
    collider: entry.collider && typeof entry.collider === 'object' ? entry.collider : null,
  };
};

const normalizeColliderInstance = (raw: unknown): LevelColliderInstance => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid collider instance');
  const inst = raw as Partial<LevelColliderInstance>;
  if (typeof inst.id !== 'string') throw new Error('Invalid collider id');
  if (
    inst.shape !== 'box' &&
    inst.shape !== 'cylinder' &&
    inst.shape !== 'sphere' &&
    inst.shape !== 'capsule'
  ) {
    throw new Error('Invalid collider shape');
  }
  return {
    id: inst.id,
    shape: inst.shape,
    halfExtents: readNumericTriple(inst.halfExtents) ?? undefined,
    radius: typeof inst.radius === 'number' ? inst.radius : undefined,
    halfHeight: typeof inst.halfHeight === 'number' ? inst.halfHeight : undefined,
    position: readNumericTriple(inst.position) ?? [0, 0, 0],
    rotation: readNumericQuat(inst.rotation) ?? [0, 0, 0, 1],
    scale: readNumericTriple(inst.scale) ?? [1, 1, 1],
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

export const parseLevelFile = (raw: string): ParsedLevelFile => {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid .level file');

  const doc = data as {
    version?: number;
    id?: string;
    displayName?: string;
    navGrid?: unknown;
    index?: {
      simpleProps?: Record<string, unknown>;
      standardProps?: Record<string, unknown>;
      simpleActors?: Record<string, unknown>;
      standardActors?: Record<string, unknown>;
    };
    composition?: {
      props?: unknown[];
      actors?: unknown[];
      colliders?: unknown[];
    };
    playerSpawn?: unknown;
    groundPlane?: unknown;
  };

  if (doc.version !== 1) throw new Error('Unsupported .level version');
  if (typeof doc.id !== 'string' || typeof doc.displayName !== 'string') {
    throw new Error('Invalid .level header');
  }

  const simpleProps: Record<string, SimplePropIndex> = {};
  for (const [key, value] of Object.entries(doc.index?.simpleProps ?? {})) {
    simpleProps[key] = normalizeSimpleProp(value, key);
  }

  const standardProps: Record<string, PropDefinition> = {};
  for (const [key, value] of Object.entries(doc.index?.standardProps ?? {})) {
    standardProps[key] = toPropDefinition(value);
  }

  const simpleActors: Record<string, ActorDefinition> = {};
  for (const [key, value] of Object.entries(doc.index?.simpleActors ?? {})) {
    simpleActors[key] = toActorDefinition(value);
  }

  const standardActors: Record<string, ActorDefinition> = {};
  for (const [key, value] of Object.entries(doc.index?.standardActors ?? {})) {
    standardActors[key] = toActorDefinition(value);
  }

  const aiPackages: Record<string, LevelAiPackage> = {};

  const props = (doc.composition?.props ?? []).map((rawInst) => {
    if (!rawInst || typeof rawInst !== 'object') throw new Error('Invalid prop instance');
    const inst = rawInst as Record<string, unknown>;
    if (typeof inst.id !== 'string' || typeof inst.indexId !== 'string') {
      throw new Error('Invalid prop instance id');
    }
    if (inst.kind !== 'simpleProp' && inst.kind !== 'standardProp') {
      throw new Error('Invalid prop kind');
    }
    const kind: 'simpleProp' | 'standardProp' = inst.kind;
    return {
      id: inst.id,
      kind,
      indexId: inst.indexId,
      position: readNumericTriple(inst.position) ?? [0, 0, 0],
      rotation: readNumericQuat(inst.rotation) ?? [0, 0, 0, 1],
      scale: readNumericTriple(inst.scale) ?? [1, 1, 1],
    };
  });

  const actors = (doc.composition?.actors ?? []).map((rawInst) => {
    if (!rawInst || typeof rawInst !== 'object') throw new Error('Invalid actor instance');
    const inst = rawInst as Record<string, unknown>;
    if (typeof inst.id !== 'string' || typeof inst.indexId !== 'string') {
      throw new Error('Invalid actor instance id');
    }
    if (inst.kind !== 'simpleActor' && inst.kind !== 'standardActor') {
      throw new Error('Invalid actor kind');
    }
    const kind: 'simpleActor' | 'standardActor' = inst.kind;
    aiPackages[inst.id] = inst.aiPackage === 'testAi' ? 'testAi' : 'none';
    return {
      id: inst.id,
      kind,
      indexId: inst.indexId,
      position: readNumericTriple(inst.position) ?? [0, 0, 0],
      rotation: readNumericQuat(inst.rotation) ?? [0, 0, 0, 1],
      scale: readNumericTriple(inst.scale) ?? [1, 1, 1],
    };
  });

  return {
    definition: {
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
        props,
        actors,
        colliders: (doc.composition?.colliders ?? []).map(normalizeColliderInstance),
      },
      playerSpawn: normalizePlayerSpawn(doc.playerSpawn),
      groundPlane: normalizeGroundPlane(doc.groundPlane),
    },
    aiPackages,
    documentJson: raw,
  };
};

export const LEVEL_LOCAL_STORE_KEY = 'construct.levelLocalStore';
