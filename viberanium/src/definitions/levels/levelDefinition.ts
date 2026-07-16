import { type ActorDefinition, collectUrlsFromActor } from '../actors/actorDefinition.ts';
import { type PropDefinition } from '../props/propDefinition.ts';
import { type SimplePropCollider } from '../props/buildSimpleProp.ts';

export type LevelNavGridConfig = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cellSize: number;
};

export type SimplePropIndex = {
  id: string;
  displayName: string;
  url: string;
  materialPrefix: string;
  textureVariantUrl?: string | null;
  collider?: SimplePropCollider | null;
};

export type LevelPropKind = 'simpleProp' | 'standardProp';

export type LevelActorKind = 'simpleActor' | 'standardActor';

export type LevelPropInstance = {
  id: string;
  kind: LevelPropKind;
  indexId: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type LevelActorInstance = {
  id: string;
  kind: LevelActorKind;
  indexId: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type LevelColliderShape = 'box' | 'cylinder' | 'sphere';

export type LevelColliderInstance = {
  id: string;
  shape: LevelColliderShape;
  halfExtents?: [number, number, number];
  radius?: number;
  halfHeight?: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type LevelPlayerSpawn = {
  position: [number, number, number];
  rotation: [number, number, number, number];
};

export type LevelGroundVariant = 'blue' | 'green' | 'brown' | 'yellow' | 'gray';

export type LevelGroundPlane = {
  position: [number, number, number];
  size: number;
  variant: LevelGroundVariant;
};

export type LevelIndex = {
  simpleProps: Record<string, SimplePropIndex>;
  standardProps: Record<string, PropDefinition>;
  simpleActors: Record<string, ActorDefinition>;
  standardActors: Record<string, ActorDefinition>;
};

export type LevelComposition = {
  props: LevelPropInstance[];
  actors: LevelActorInstance[];
  colliders: LevelColliderInstance[];
};

export type LevelDefinition = {
  id: string;
  displayName: string;
  navGrid: LevelNavGridConfig;
  index: LevelIndex;
  composition: LevelComposition;
  playerSpawn: LevelPlayerSpawn;
  groundPlane: LevelGroundPlane;
};

export const DEFAULT_LEVEL_NAV_GRID: LevelNavGridConfig = {
  minX: -18,
  maxX: 18,
  minZ: -18,
  maxZ: 18,
  cellSize: 1.0,
};

export const DEFAULT_LEVEL_PLAYER_SPAWN: LevelPlayerSpawn = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
};

export const DEFAULT_LEVEL_GROUND_PLANE: LevelGroundPlane = {
  position: [0, 0, 0],
  size: 60,
  variant: 'blue',
};

export const LEVEL_GROUND_VARIANTS: readonly LevelGroundVariant[] = [
  'blue',
  'green',
  'brown',
  'yellow',
  'gray',
];

export const groundVariantIndex = (variant: LevelGroundVariant): number => {
  const index = LEVEL_GROUND_VARIANTS.indexOf(variant);
  return index < 0 ? 0 : index;
};

export const normalizeLevelGroundVariant = (raw: unknown): LevelGroundVariant => {
  if (
    raw === 'green' ||
    raw === 'brown' ||
    raw === 'yellow' ||
    raw === 'blue' ||
    raw === 'gray'
  ) {
    return raw;
  }
  return DEFAULT_LEVEL_GROUND_PLANE.variant;
};

export const identityLevelLocal = (): Pick<
  LevelPropInstance,
  'position' | 'rotation' | 'scale'
> => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

export const collectUrlsFromLevel = (definition: LevelDefinition): string[] => {
  const urls = new Set<string>();

  for (const entry of Object.values(definition.index.simpleProps)) {
    urls.add(entry.url);
    if (entry.textureVariantUrl) urls.add(entry.textureVariantUrl);
  }

  for (const def of Object.values(definition.index.standardProps)) {
    for (const part of def.parts) {
      if (part.kind === 'asset') {
        urls.add(part.url);
        if (part.textureVariantUrl) urls.add(part.textureVariantUrl);
      }
    }
  }

  for (const def of Object.values(definition.index.simpleActors)) {
    for (const url of collectUrlsFromActor(def)) urls.add(url);
  }

  for (const def of Object.values(definition.index.standardActors)) {
    for (const url of collectUrlsFromActor(def)) urls.add(url);
  }

  return [...urls];
};

export const resolveLevelPropDefinition = (
  definition: LevelDefinition,
  instance: LevelPropInstance,
): PropDefinition | null => {
  if (instance.kind === 'simpleProp') {
    const entry = definition.index.simpleProps[instance.indexId];
    if (!entry) return null;

    const parts: PropDefinition['parts'] = [
      {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
        id: `${entry.id}_mesh`,
        kind: 'asset',
        url: entry.url,
        materialPrefix: entry.materialPrefix,
        textureVariantUrl: entry.textureVariantUrl,
        tags: [],
      },
    ];

    if (entry.collider) {
      const base = {
        position: (entry.collider.position ?? [0, 0, 0]) as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        id: `${entry.id}_collider`,
        kind: 'collider' as const,
      };
      const c = entry.collider;
      if (c.shape === 'box') parts.push({ ...base, shape: 'box' as const, halfExtents: c.halfExtents });
      else if (c.shape === 'cylinder') {
        parts.push({ ...base, shape: 'cylinder' as const, radius: c.radius, halfHeight: c.halfHeight });
      } else {
        parts.push({ ...base, shape: 'sphere' as const, radius: c.radius });
      }
    }

    return {
      id: entry.id,
      displayName: entry.displayName,
      parts,
    };
  }

  return definition.index.standardProps[instance.indexId] ?? null;
};

export const resolveLevelActorDefinition = (
  definition: LevelDefinition,
  instance: LevelActorInstance,
): ActorDefinition | null => {
  if (instance.kind === 'simpleActor') {
    return definition.index.simpleActors[instance.indexId] ?? null;
  }

  return definition.index.standardActors[instance.indexId] ?? null;
};

export const resolveLevelColliderPropDefinition = (
  instance: LevelColliderInstance,
): PropDefinition => {
  const base = {
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0, 1] as [number, number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    id: `${instance.id}_collider`,
    kind: 'collider' as const,
  };

  if (instance.shape === 'box') {
    return {
      id: instance.id,
      displayName: instance.id,
      parts: [{ ...base, shape: 'box', halfExtents: instance.halfExtents ?? [0.5, 0.5, 0.5] }],
    };
  }

  if (instance.shape === 'cylinder') {
    return {
      id: instance.id,
      displayName: instance.id,
      parts: [
        {
          ...base,
          shape: 'cylinder',
          radius: instance.radius ?? 0.35,
          halfHeight: instance.halfHeight ?? 0.5,
        },
      ],
    };
  }

  return {
    id: instance.id,
    displayName: instance.id,
    parts: [{ ...base, shape: 'sphere', radius: instance.radius ?? 0.5 }],
  };
};
