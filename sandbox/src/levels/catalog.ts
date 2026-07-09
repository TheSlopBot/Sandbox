import {
  CUBE_SMALL,
  CUBE_LARGE,
  ROBOT_ONE_GLB,
} from './assets.ts';
import { collectUrlsFromDef } from '../character/types.ts';
import { SPACE_RANGER_DEF } from '../character/defs/spaceRanger.ts';
import { createKaykitMediumDef } from '../character/defs/kaykitMedium.ts';
import { createCombatMechDef } from '../character/defs/combatMech.ts';
import { DUMMY_DEF } from '../character/defs/dummy.ts';
import { type CombatMechVariant } from '../character/defs/combatMech.ts';

export type LevelPropSpawn = {
  url: string;
  prefix: string;
  opts?: { x?: number; y?: number; z?: number; scale?: number; yaw?: number };
};

export type LevelRobotSpawn = {
  x: number;
  z: number;
  bodyGlb: string;
  materialPrefix: string;
  y?: number;
};

export type LevelCombatMechSpawn = {
  x: number;
  z: number;
  variant?: CombatMechVariant;
  y?: number;
};

export type LevelDummySpawn = {
  x: number;
  z: number;
  y?: number;
};

export type LevelNavGridConfig = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cellSize: number;
};

export type LevelDefinition = {
  id: string;
  displayName: string;
  navGrid: LevelNavGridConfig;
  props: LevelPropSpawn[];
  robots?: LevelRobotSpawn[];
  combatMechs?: LevelCombatMechSpawn[];
  dummies?: LevelDummySpawn[];
};

const DEFAULT_NAV_GRID: LevelNavGridConfig = {
  minX: -18,
  maxX: 18,
  minZ: -18,
  maxZ: 18,
  cellSize: 1.0,
};

const createSeededRng = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const buildCombatMechPerfSpawns = (count: number): LevelCombatMechSpawn[] => {
  const rng = createSeededRng(20260708);
  const margin = 1.5;
  const minX = DEFAULT_NAV_GRID.minX + margin;
  const maxX = DEFAULT_NAV_GRID.maxX - margin;
  const minZ = DEFAULT_NAV_GRID.minZ + margin;
  const maxZ = DEFAULT_NAV_GRID.maxZ - margin;
  const mechs: LevelCombatMechSpawn[] = [];

  for (let i = 0; i < count; i++) {
    mechs.push({
      x: minX + rng() * (maxX - minX),
      z: minZ + rng() * (maxZ - minZ),
      variant: i >= count / 2 ? 'alt' : 'primary',
    });
  }

  return mechs;
};

type LevelPoint2 = { x: number; z: number };

type OccupiedCircle = {
  pos: LevelPoint2;
  radius: number;
};

const dist2 = (a: LevelPoint2, b: LevelPoint2) => Math.hypot(a.x - b.x, a.z - b.z);

const isSpawnClear = (pos: LevelPoint2, radius: number, occupied: OccupiedCircle[], gap: number) =>
  occupied.every((circle) => dist2(pos, circle.pos) >= radius + circle.radius + gap);

const buildDummySpawns = (
  props: LevelPropSpawn[],
  robots: LevelRobotSpawn[] | undefined,
  combatMechs: LevelCombatMechSpawn[] | undefined,
  dummies: LevelDummySpawn[] | undefined,
  count: number,
  seed: number,
  navGrid: LevelNavGridConfig = DEFAULT_NAV_GRID,
): LevelDummySpawn[] => {
  const rng = createSeededRng(seed);
  const margin = 1.5;
  const minX = navGrid.minX + margin;
  const maxX = navGrid.maxX - margin;
  const minZ = navGrid.minZ + margin;
  const maxZ = navGrid.maxZ - margin;
  const npcRadius = 1.2;
  const gap = 0.8;
  const occupied: OccupiedCircle[] = [{ pos: { x: 0, z: 0 }, radius: npcRadius }];

  for (const prop of props) {
    const radius = prop.url === CUBE_LARGE ? 2.5 : 1.5;
    occupied.push({ pos: { x: prop.opts?.x ?? 0, z: prop.opts?.z ?? 0 }, radius });
  }

  for (const robot of robots ?? []) {
    occupied.push({ pos: { x: robot.x, z: robot.z }, radius: npcRadius });
  }

  for (const mech of combatMechs ?? []) {
    occupied.push({ pos: { x: mech.x, z: mech.z }, radius: npcRadius });
  }

  for (const dummy of dummies ?? []) {
    occupied.push({ pos: { x: dummy.x, z: dummy.z }, radius: npcRadius });
  }

  const spawns: LevelDummySpawn[] = [];

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const pos = {
        x: minX + rng() * (maxX - minX),
        z: minZ + rng() * (maxZ - minZ),
      };

      if (!isSpawnClear(pos, npcRadius, occupied, gap)) continue;

      spawns.push({ x: pos.x, z: pos.z });
      occupied.push({ pos, radius: npcRadius });
      break;
    }
  }

  return spawns;
};

const LEVEL_TEST_PROPS: LevelPropSpawn[] = [
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: -7.5, z: -2.0 } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: -4.2, z: -8.0, yaw: Math.PI / 6 } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: -1.0, z: -4.5, yaw: Math.PI / 3 } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: 2.8, z: -9.5, yaw: Math.PI / 2 } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: 6.7, z: -5.8, yaw: (2 * Math.PI) / 3 } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: 8.5, z: 1.2, yaw: (5 * Math.PI) / 6 } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: 3.3, z: 4.8, yaw: Math.PI } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: -2.6, z: 6.4, yaw: (7 * Math.PI) / 6 } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: -6.8, z: 3.0, yaw: (4 * Math.PI) / 3 } },
  { url: CUBE_SMALL, prefix: 'proto', opts: { x: 5.8, z: -1.0, yaw: (3 * Math.PI) / 2 } },
  { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: 5.5, z: -13.5, yaw: Math.PI / 7 } },
  { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: 14.0, z: 4.5, yaw: -Math.PI / 5 } },
  { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: -11.5, z: 7.0, yaw: -Math.PI / 3 } },
];

const LEVEL_TEST_ROBOTS: LevelRobotSpawn[] = [
  { x: -11, z: -11, bodyGlb: ROBOT_ONE_GLB, materialPrefix: 'robot_one' },
  { x: 11, z: -11, bodyGlb: ROBOT_ONE_GLB, materialPrefix: 'robot_ome' },
];

export const LEVEL_TEST: LevelDefinition = {
  id: 'test',
  displayName: 'Test Arena',
  navGrid: DEFAULT_NAV_GRID,
  props: LEVEL_TEST_PROPS,
  robots: LEVEL_TEST_ROBOTS,
  dummies: buildDummySpawns(LEVEL_TEST_PROPS, LEVEL_TEST_ROBOTS, undefined, undefined, 2, 20260709),
};

export const LEVEL_ALT: LevelDefinition = {
  id: 'alt',
  displayName: 'Test Corridor',
  navGrid: DEFAULT_NAV_GRID,
  props: [
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: -10.0, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: -7.5, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: -5.0, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: -2.5, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 0.0, z: 0.0, yaw: Math.PI / 4 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 2.5, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 5.0, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 7.5, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 10.0, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 0.0, z: -5.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 0.0, z: 5.0 } },
    { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: 0.0, z: -10.0, yaw: Math.PI / 2 } },
    { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: 0.0, z: 10.0, yaw: -Math.PI / 2 } },
    { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: -12.0, z: 8.0, yaw: Math.PI / 3 } },
  ],
  combatMechs: buildCombatMechPerfSpawns(100),
};

export const LEVEL_CATALOG: Record<string, LevelDefinition> = {
  test: LEVEL_TEST,
  alt: LEVEL_ALT,
};

export const collectLevelAssetUrls = (definition: LevelDefinition): string[] => {
  const urls = new Set<string>([
    ...collectUrlsFromDef(SPACE_RANGER_DEF),
    ...collectUrlsFromDef(createKaykitMediumDef(ROBOT_ONE_GLB, 'robot_one')),
    ...collectUrlsFromDef(createCombatMechDef('primary')),
    ...collectUrlsFromDef(DUMMY_DEF),
  ]);

  for (const prop of definition.props) urls.add(prop.url);
  for (const robot of definition.robots ?? []) urls.add(robot.bodyGlb);

  return [...urls];
};
