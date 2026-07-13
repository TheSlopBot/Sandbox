import { type LevelActorInstance, type LevelNavGridConfig, type LevelPropInstance } from './levelDefinition.ts';
import { type LevelAiPackage } from './levelFile.ts';

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

export const createSeededRng = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const randomPointInNavGrid = (rng: () => number, navGrid: LevelNavGridConfig, margin: number) => {
  const minX = navGrid.minX + margin;
  const maxX = navGrid.maxX - margin;
  const minZ = navGrid.minZ + margin;
  const maxZ = navGrid.maxZ - margin;

  return {
    x: minX + rng() * (maxX - minX),
    z: minZ + rng() * (maxZ - minZ),
  };
};

export const yawQuat = (yaw: number): [number, number, number, number] => {
  const half = yaw / 2;
  return [0, Math.sin(half), 0, Math.cos(half)];
};

export const indexById = <T extends { id: string }>(items: readonly T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]));

export const propInstance = (
  id: string,
  indexId: string,
  x: number,
  z: number,
  opts: { y?: number; yaw?: number; scale?: number } = {},
): LevelPropInstance => ({
  id,
  kind: 'standardProp',
  indexId,
  position: [x, opts.y ?? 0, z],
  rotation: yawQuat(opts.yaw ?? 0),
  scale: [opts.scale ?? 1, opts.scale ?? 1, opts.scale ?? 1],
});

export const actorInstance = (id: string, indexId: string, x: number, z: number, y = 1.6): LevelActorInstance => ({
  id,
  kind: 'standardActor',
  indexId,
  position: [x, y, z],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

export const withTestAi = (instances: readonly LevelActorInstance[]): Record<string, LevelAiPackage> =>
  Object.fromEntries(instances.map((instance) => [instance.id, 'testAi' as const]));

export const buildCombatMechPerfInstances = (
  count: number,
  indexIds: { primary: string; alt: string },
  navGrid: LevelNavGridConfig = DEFAULT_NAV_GRID,
  seed = 20260708,
): LevelActorInstance[] => {
  const rng = createSeededRng(seed);
  const instances: LevelActorInstance[] = [];

  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInNavGrid(rng, navGrid, 1.5);
    instances.push(actorInstance(`combatMech${i}`, i >= count / 2 ? indexIds.alt : indexIds.primary, x, z));
  }

  return instances;
};

export const buildRobotPerfInstances = (
  count: number,
  indexIds: { one: string; ome: string },
  navGrid: LevelNavGridConfig = DEFAULT_NAV_GRID,
  seed = 20260711,
): LevelActorInstance[] => {
  const rng = createSeededRng(seed);
  const instances: LevelActorInstance[] = [];

  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInNavGrid(rng, navGrid, 1.5);
    instances.push(actorInstance(`robot${i}`, i >= count / 2 ? indexIds.ome : indexIds.one, x, z));
  }

  return instances;
};

export const buildDummyPerfInstances = (
  count: number,
  indexIds: readonly string[],
  navGrid: LevelNavGridConfig = DEFAULT_NAV_GRID,
  seed = 20260712,
): LevelActorInstance[] => {
  const rng = createSeededRng(seed);
  const instances: LevelActorInstance[] = [];

  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInNavGrid(rng, navGrid, 1.5);
    const indexId = indexIds[Math.floor((i * indexIds.length) / count) % indexIds.length]!;
    instances.push(actorInstance(`dummy${i}`, indexId, x, z));
  }

  return instances;
};

type OccupiedCircle = { x: number; z: number; radius: number };

const isSpawnClear = (pos: { x: number; z: number }, radius: number, occupied: OccupiedCircle[], gap: number) =>
  occupied.every((circle) => Math.hypot(pos.x - circle.x, pos.z - circle.z) >= radius + circle.radius + gap);

export const buildDummySpawnInstances = (
  props: readonly LevelPropInstance[],
  robots: readonly LevelActorInstance[],
  combatMechs: readonly LevelActorInstance[],
  dummyIndexIds: readonly string[],
  count: number,
  seed: number,
  navGrid: LevelNavGridConfig = DEFAULT_NAV_GRID,
): LevelActorInstance[] => {
  const rng = createSeededRng(seed);
  const margin = 1.5;
  const minX = navGrid.minX + margin;
  const maxX = navGrid.maxX - margin;
  const minZ = navGrid.minZ + margin;
  const maxZ = navGrid.maxZ - margin;
  const npcRadius = 1.2;
  const gap = 0.8;
  const occupied: OccupiedCircle[] = [{ x: 0, z: 0, radius: npcRadius }];

  for (const prop of props) {
    occupied.push({
      x: prop.position[0],
      z: prop.position[2],
      radius: prop.indexId === 'cube_large' || prop.indexId === 'plank' ? 2.5 : 1.5,
    });
  }

  for (const robot of robots) occupied.push({ x: robot.position[0], z: robot.position[2], radius: npcRadius });
  for (const mech of combatMechs) occupied.push({ x: mech.position[0], z: mech.position[2], radius: npcRadius });

  const instances: LevelActorInstance[] = [];

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = minX + rng() * (maxX - minX);
      const z = minZ + rng() * (maxZ - minZ);
      if (!isSpawnClear({ x, z }, npcRadius, occupied, gap)) continue;

      const indexId = dummyIndexIds[i % dummyIndexIds.length]!;
      instances.push(actorInstance(`dummy${i}`, indexId, x, z));
      occupied.push({ x, z, radius: npcRadius });
      break;
    }
  }

  return instances;
};

export const buildScatteredPropInstances = (
  indexIds: readonly string[],
  countPerProp: number,
  halfExtent: number,
  seed: number,
  margin = 2,
): LevelPropInstance[] => {
  const rng = createSeededRng(seed);
  const min = -halfExtent + margin;
  const max = halfExtent - margin;
  const instances: LevelPropInstance[] = [];
  let n = 0;

  for (const indexId of indexIds) {
    for (let i = 0; i < countPerProp; i++) {
      const x = min + rng() * (max - min);
      const z = min + rng() * (max - min);
      instances.push(propInstance(`prop${n}`, indexId, x, z, { yaw: rng() * Math.PI * 2 }));
      n++;
    }
  }

  return instances;
};

export const buildScatteredPropInstancesTotal = (
  indexIds: readonly string[],
  totalCount: number,
  halfExtent: number,
  seed: number,
  margin = 2,
): LevelPropInstance[] => {
  const rng = createSeededRng(seed);
  const min = -halfExtent + margin;
  const max = halfExtent - margin;
  const instances: LevelPropInstance[] = [];

  for (let i = 0; i < totalCount; i++) {
    const indexId = indexIds[i % indexIds.length];
    if (!indexId) continue;

    const x = min + rng() * (max - min);
    const z = min + rng() * (max - min);
    instances.push(propInstance(`prop${i}`, indexId, x, z, { yaw: rng() * Math.PI * 2 }));
  }

  return instances;
};
