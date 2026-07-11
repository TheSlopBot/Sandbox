import { type Collider } from '../components/collider.ts';
import {
  GRID_CELL_COUNT,
  GRID_CELL_SIZE,
  GRID_ORIGIN,
  GRID_RES,
} from '../render/gl/collisionPack.ts';

type BroadphaseState = {
  colliders: Collider[];
  cellStarts: Uint32Array;
  cellCounts: Uint32Array;
  cellIndices: Uint32Array;
  dirty: boolean;
};

const state: BroadphaseState = {
  colliders: [],
  cellStarts: new Uint32Array(GRID_CELL_COUNT),
  cellCounts: new Uint32Array(GRID_CELL_COUNT),
  cellIndices: new Uint32Array(0),
  dirty: true,
};

export const markCollisionBroadphaseDirty = (): void => {
  state.dirty = true;
};

export const rebuildCollisionBroadphase = (colliders: readonly Collider[]): void => {
  const statics = colliders.filter((c) => c.isStatic);
  state.colliders = statics;
  state.cellStarts.fill(0);
  state.cellCounts.fill(0);

  const lists: number[][] = Array.from({ length: GRID_CELL_COUNT }, () => []);

  for (let i = 0; i < statics.length; i++) {
    const aabb = statics[i]!.aabb;
    const minX = aabb.min[0]!;
    const maxX = aabb.max[0]!;
    const minZ = aabb.min[2]!;
    const maxZ = aabb.max[2]!;

    const cx0 = Math.max(0, Math.floor((minX - GRID_ORIGIN) / GRID_CELL_SIZE));
    const cx1 = Math.min(GRID_RES - 1, Math.floor((maxX - GRID_ORIGIN) / GRID_CELL_SIZE));
    const cz0 = Math.max(0, Math.floor((minZ - GRID_ORIGIN) / GRID_CELL_SIZE));
    const cz1 = Math.min(GRID_RES - 1, Math.floor((maxZ - GRID_ORIGIN) / GRID_CELL_SIZE));

    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        lists[cz * GRID_RES + cx]!.push(i);
      }
    }
  }

  let total = 0;
  for (let c = 0; c < GRID_CELL_COUNT; c++) {
    state.cellStarts[c] = total;
    state.cellCounts[c] = lists[c]!.length;
    total += lists[c]!.length;
  }

  if (state.cellIndices.length < total) {
    state.cellIndices = new Uint32Array(Math.max(total, 64));
  }

  for (let c = 0; c < GRID_CELL_COUNT; c++) {
    const start = state.cellStarts[c]!;
    const list = lists[c]!;
    for (let k = 0; k < list.length; k++) {
      state.cellIndices[start + k] = list[k]!;
    }
  }

  state.dirty = false;
};

const _nearby: Collider[] = [];
const _seen = new Set<number>();

export const queryNearbyStaticColliders = (
  x: number,
  z: number,
  radius: number,
): Collider[] => {
  _nearby.length = 0;
  _seen.clear();

  if (state.colliders.length === 0) return _nearby;

  const minX = x - radius;
  const maxX = x + radius;
  const minZ = z - radius;
  const maxZ = z + radius;

  const cx0 = Math.max(0, Math.floor((minX - GRID_ORIGIN) / GRID_CELL_SIZE));
  const cx1 = Math.min(GRID_RES - 1, Math.floor((maxX - GRID_ORIGIN) / GRID_CELL_SIZE));
  const cz0 = Math.max(0, Math.floor((minZ - GRID_ORIGIN) / GRID_CELL_SIZE));
  const cz1 = Math.min(GRID_RES - 1, Math.floor((maxZ - GRID_ORIGIN) / GRID_CELL_SIZE));

  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const cell = cz * GRID_RES + cx;
      const start = state.cellStarts[cell]!;
      const count = state.cellCounts[cell]!;
      for (let k = 0; k < count; k++) {
        const idx = state.cellIndices[start + k]!;
        if (_seen.has(idx)) continue;
        _seen.add(idx);
        _nearby.push(state.colliders[idx]!);
      }
    }
  }

  return _nearby;
};

export const ensureCollisionBroadphase = (colliders: readonly Collider[]): void => {
  if (state.dirty) rebuildCollisionBroadphase(colliders);
};

export const isCollisionBroadphaseDirty = (): boolean => state.dirty;
