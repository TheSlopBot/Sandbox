import { type Collider } from '../components/collider.ts';
import {
  COMBAT_LAYER,
  type CombatLayerBits,
  combatLayersOverlap,
} from './combatLayers.ts';
import { collidersOverlap } from './combatContact.ts';

const CELL = 4;
const ORIGIN = -128;
const GRID = 64;

type Cell = Collider[];

const cells: Cell[] = Array.from({ length: GRID * GRID }, () => []);
const scratch: Collider[] = [];
const seen = new Set<Collider>();

const cellIndex = (x: number, z: number): number => {
  const cx = Math.floor((x - ORIGIN) / CELL);
  const cz = Math.floor((z - ORIGIN) / CELL);
  if (cx < 0 || cz < 0 || cx >= GRID || cz >= GRID) return -1;
  return cz * GRID + cx;
};

const clearCells = () => {
  for (let i = 0; i < cells.length; i++) cells[i]!.length = 0;
};

export const rebuildCombatBroadphase = (colliders: readonly Collider[]): void => {
  clearCells();
  for (const c of colliders) {
    const layer = c.combatLayer ?? 0;
    if ((layer & (COMBAT_LAYER.HURTBOX | COMBAT_LAYER.HITBOX | COMBAT_LAYER.SHIELD | COMBAT_LAYER.PROJECTILE)) === 0) {
      continue;
    }

    const minCx = Math.floor((c.aabb.min[0] - ORIGIN) / CELL);
    const maxCx = Math.floor((c.aabb.max[0] - ORIGIN) / CELL);
    const minCz = Math.floor((c.aabb.min[2] - ORIGIN) / CELL);
    const maxCz = Math.floor((c.aabb.max[2] - ORIGIN) / CELL);

    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (cx < 0 || cz < 0 || cx >= GRID || cz >= GRID) continue;
        cells[cz * GRID + cx]!.push(c);
      }
    }
  }
};

export const queryCombatNearby = (
  x: number,
  z: number,
  radius: number,
  layer: CombatLayerBits,
  mask: CombatLayerBits,
): Collider[] => {
  scratch.length = 0;
  seen.clear();

  const minCx = Math.floor((x - radius - ORIGIN) / CELL);
  const maxCx = Math.floor((x + radius - ORIGIN) / CELL);
  const minCz = Math.floor((z - radius - ORIGIN) / CELL);
  const maxCz = Math.floor((z + radius - ORIGIN) / CELL);

  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      if (cx < 0 || cz < 0 || cx >= GRID || cz >= GRID) continue;
      const cell = cells[cz * GRID + cx]!;
      for (const c of cell) {
        if (seen.has(c)) continue;
        seen.add(c);
        const cLayer = c.combatLayer ?? 0;
        const cMask = c.combatMask ?? 0;
        if (!combatLayersOverlap(layer, mask, cLayer, cMask)) continue;
        scratch.push(c);
      }
    }
  }

  return scratch;
};

export const findCombatOverlaps = (
  source: Collider,
  candidates: readonly Collider[],
): Collider[] => {
  const out: Collider[] = [];
  const layer = source.combatLayer ?? 0;
  const mask = source.combatMask ?? 0;

  for (const c of candidates) {
    if (c === source) continue;
    if (source.ownerId !== undefined && c.ownerId === source.ownerId) continue;
    const cLayer = c.combatLayer ?? 0;
    const cMask = c.combatMask ?? 0;
    if (!combatLayersOverlap(layer, mask, cLayer, cMask)) continue;
    if (!collidersOverlap(source, c)) continue;
    out.push(c);
  }

  return out;
};

export const combatCellIndex = cellIndex;
