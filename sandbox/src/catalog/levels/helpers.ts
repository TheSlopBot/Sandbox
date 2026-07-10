import {
  type LevelCombatMechSpawn,
  type LevelDefinition,
  type LevelDummySpawn,
  type LevelNavGridConfig,
  type LevelPropPlacement,
  type LevelRobotSpawn,
} from './levelDefinition.ts';

export const GROUND_HALF_EXTENT = 60;

export const DEFAULT_NAV_GRID: LevelNavGridConfig = {
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

export const buildCombatMechPerfSpawns = (count: number): LevelCombatMechSpawn[] => {
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

      spawns.push({ x: pos.x, z: pos.z });
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

export type { LevelDefinition };