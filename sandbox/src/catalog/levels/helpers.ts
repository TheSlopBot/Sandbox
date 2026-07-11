import { ROBOT_ONE_GLB } from '../assets/kaykit.ts';
import { type DummyVariant } from '../actors/kaykitActors.ts';
import {
  type LevelCombatMechSpawn,
  type LevelDefinition,
  type LevelDummySpawn,
  type LevelNavGridConfig,
  type LevelPropPlacement,
  type LevelRobotSpawn,
} from './levelDefinition.ts';

export const GROUND_HALF_EXTENT = 60;

export const MIXED_HALF_EXTENT = 40;

export const DEFAULT_NAV_GRID: LevelNavGridConfig = {
  minX: -18,
  maxX: 18,
  minZ: -18,
  maxZ: 18,
  cellSize: 1.0,
};

export const GROUND_NAV_GRID: LevelNavGridConfig = {
  minX: -GROUND_HALF_EXTENT,
  maxX: GROUND_HALF_EXTENT,
  minZ: -GROUND_HALF_EXTENT,
  maxZ: GROUND_HALF_EXTENT,
  cellSize: 2,
};

export const MIXED_NAV_GRID: LevelNavGridConfig = {
  minX: -MIXED_HALF_EXTENT,
  maxX: MIXED_HALF_EXTENT,
  minZ: -MIXED_HALF_EXTENT,
  maxZ: MIXED_HALF_EXTENT,
  cellSize: 1.5,
};

const DUMMY_VARIANTS: readonly DummyVariant[] = ['primary', 'altA', 'altB', 'altC'];

const createSeededRng = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const randomPointInNavGrid = (
  rng: () => number,
  navGrid: LevelNavGridConfig,
  margin: number,
) => {
  const minX = navGrid.minX + margin;
  const maxX = navGrid.maxX - margin;
  const minZ = navGrid.minZ + margin;
  const maxZ = navGrid.maxZ - margin;

  return {
    x: minX + rng() * (maxX - minX),
    z: minZ + rng() * (maxZ - minZ),
  };
};

export const buildCombatMechPerfSpawns = (
  count: number,
  navGrid: LevelNavGridConfig = DEFAULT_NAV_GRID,
  seed = 20260708,
): LevelCombatMechSpawn[] => {
  const rng = createSeededRng(seed);
  const mechs: LevelCombatMechSpawn[] = [];

  for (let i = 0; i < count; i++) {
    mechs.push({
      ...randomPointInNavGrid(rng, navGrid, 1.5),
      variant: i >= count / 2 ? 'alt' : 'primary',
    });
  }

  return mechs;
};

export const buildRobotPerfSpawns = (
  count: number,
  navGrid: LevelNavGridConfig = DEFAULT_NAV_GRID,
  seed = 20260711,
): LevelRobotSpawn[] => {
  const rng = createSeededRng(seed);
  const robots: LevelRobotSpawn[] = [];

  for (let i = 0; i < count; i++) {
    robots.push({
      ...randomPointInNavGrid(rng, navGrid, 1.5),
      bodyGlb: ROBOT_ONE_GLB,
      materialPrefix: i >= count / 2 ? 'robot_ome' : 'robot_one',
    });
  }

  return robots;
};

export const buildDummyPerfSpawns = (
  count: number,
  navGrid: LevelNavGridConfig = DEFAULT_NAV_GRID,
  seed = 20260712,
): LevelDummySpawn[] => {
  const rng = createSeededRng(seed);
  const dummies: LevelDummySpawn[] = [];

  for (let i = 0; i < count; i++) {
    dummies.push({
      ...randomPointInNavGrid(rng, navGrid, 1.5),
      variant: DUMMY_VARIANTS[Math.floor((i * DUMMY_VARIANTS.length) / count) % DUMMY_VARIANTS.length],
    });
  }

  return dummies;
};

type LevelPoint2 = { x: number; z: number };

type OccupiedCircle = {
  pos: LevelPoint2;
  radius: number;
};

const dist2 = (a: LevelPoint2, b: LevelPoint2) => Math.hypot(a.x - b.x, a.z - b.z);

const isSpawnClear = (pos: LevelPoint2, radius: number, occupied: OccupiedCircle[], gap: number) =>
  occupied.every((circle) => dist2(pos, circle.pos) >= radius + circle.radius + gap);

export const buildDummySpawns = (
  props: LevelPropPlacement[],
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
    const radius = prop.propId === 'cube_large' ? 2.5 : 1.5;
    occupied.push({ pos: { x: prop.x, z: prop.z }, radius });
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

      spawns.push({
        x: pos.x,
        z: pos.z,
        variant: DUMMY_VARIANTS[i % DUMMY_VARIANTS.length],
      });
      occupied.push({ pos, radius: npcRadius });
      break;
    }
  }

  return spawns;
};

export const buildScatteredPropSpawns = (
  propIds: readonly string[],
  countPerProp: number,
  halfExtent: number,
  seed: number,
  margin = 2,
): LevelPropPlacement[] => {
  const rng = createSeededRng(seed);
  const min = -halfExtent + margin;
  const max = halfExtent - margin;
  const props: LevelPropPlacement[] = [];

  for (const propId of propIds) {
    for (let i = 0; i < countPerProp; i++) {
      props.push({
        propId,
        x: min + rng() * (max - min),
        z: min + rng() * (max - min),
        yaw: rng() * Math.PI * 2,
      });
    }
  }

  return props;
};

export const buildScatteredPropSpawnsTotal = (
  propIds: readonly string[],
  totalCount: number,
  halfExtent: number,
  seed: number,
  margin = 2,
): LevelPropPlacement[] => {
  const rng = createSeededRng(seed);
  const min = -halfExtent + margin;
  const max = halfExtent - margin;
  const props: LevelPropPlacement[] = [];

  for (let i = 0; i < totalCount; i++) {
    const propId = propIds[i % propIds.length];

    if (!propId) continue;

    props.push({
      propId,
      x: min + rng() * (max - min),
      z: min + rng() * (max - min),
      yaw: rng() * Math.PI * 2,
    });
  }

  return props;
};

export type { LevelDefinition };
