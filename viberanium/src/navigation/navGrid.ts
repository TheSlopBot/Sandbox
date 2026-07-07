import { type Collider } from '../components/collider.ts';

export type NavGrid = {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  cellSize: number;
  blocked: Uint8Array;
};

const cellIndex = (grid: NavGrid, col: number, row: number): number => row * grid.cols + col;

const isInside = (grid: NavGrid, col: number, row: number): boolean =>
  col >= 0 && row >= 0 && col < grid.cols && row < grid.rows;

export const worldToCell = (grid: NavGrid, x: number, z: number): { col: number; row: number } => ({
  col: Math.floor((x - grid.minX) / grid.cellSize),
  row: Math.floor((z - grid.minZ) / grid.cellSize),
});

export const cellToWorld = (grid: NavGrid, col: number, row: number): { x: number; z: number } => ({
  x: grid.minX + (col + 0.5) * grid.cellSize,
  z: grid.minZ + (row + 0.5) * grid.cellSize,
});

const isBlockedWorld = (x: number, z: number, colliders: Collider[], margin: number): boolean => {
  for (const c of colliders) {
    if (!c.isStatic) continue;
    const { min, max } = c.aabb;
    if (x >= min[0] - margin && x <= max[0] + margin && z >= min[2] - margin && z <= max[2] + margin) {
      return true;
    }
  }
  return false;
};

export const updateNavGridBlocked = (
  grid: NavGrid,
  colliders: Collider[],
  agentRadius = 0.35,
): void => {
  grid.blocked.fill(0);

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const { x, z } = cellToWorld(grid, col, row);
      if (isBlockedWorld(x, z, colliders, agentRadius)) {
        grid.blocked[cellIndex(grid, col, row)] = 1;
      }
    }
  }
};

export const buildNavGrid = (
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  cellSize: number,
  colliders: Collider[],
  agentRadius = 0.35,
): NavGrid => {
  const cols = Math.max(1, Math.ceil((maxX - minX) / cellSize));
  const rows = Math.max(1, Math.ceil((maxZ - minZ) / cellSize));
  const grid: NavGrid = { minX, minZ, cols, rows, cellSize, blocked: new Uint8Array(cols * rows) };

  updateNavGridBlocked(grid, colliders, agentRadius);

  return grid;
};

export const isWalkableWorld = (grid: NavGrid, x: number, z: number, colliders: Collider[]): boolean => {
  const { col, row } = worldToCell(grid, x, z);
  if (!isInside(grid, col, row)) return false;
  if (grid.blocked[cellIndex(grid, col, row)] === 1) return false;
  return !isBlockedWorld(x, z, colliders, 0.35);
};
