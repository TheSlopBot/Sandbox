import { type NavGrid, worldToCell, cellToWorld, isWalkableWorld } from './navGrid.ts';
import { type Collider } from '../components/collider.ts';

type Cell = { col: number; row: number };

const cellKey = (col: number, row: number): string => `${col},${row}`;

const heuristic = (a: Cell, b: Cell): number => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

const isWalkableCell = (grid: NavGrid, col: number, row: number): boolean => {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
  return grid.blocked[row * grid.cols + col] === 0;
};

const nearestWalkableCell = (grid: NavGrid, col: number, row: number): Cell | null => {
  if (isWalkableCell(grid, col, row)) return { col, row };
  for (let r = 1; r <= 4; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        const nc = col + dc;
        const nr = row + dr;
        if (isWalkableCell(grid, nc, nr)) return { col: nc, row: nr };
      }
    }
  }
  return null;
};

type HeapNode = { cell: Cell; f: number };

const heapPush = (heap: HeapNode[], node: HeapNode) => {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent]!.f <= heap[i]!.f) break;
    const tmp = heap[parent]!;
    heap[parent] = heap[i]!;
    heap[i] = tmp;
    i = parent;
  }
};

const heapPop = (heap: HeapNode[]): HeapNode | undefined => {
  const top = heap[0];
  if (top === undefined) return undefined;
  const last = heap.pop()!;
  if (heap.length === 0) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const left = i * 2 + 1;
    const right = left + 1;
    let smallest = i;
    if (left < heap.length && heap[left]!.f < heap[smallest]!.f) smallest = left;
    if (right < heap.length && heap[right]!.f < heap[smallest]!.f) smallest = right;
    if (smallest === i) break;
    const tmp = heap[i]!;
    heap[i] = heap[smallest]!;
    heap[smallest] = tmp;
    i = smallest;
  }
  return top;
};

export const findPath = (
  grid: NavGrid,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
): Array<{ x: number; z: number }> | null => {
  const startRaw = worldToCell(grid, startX, startZ);
  const goalRaw = worldToCell(grid, goalX, goalZ);
  const startCell = nearestWalkableCell(grid, startRaw.col, startRaw.row);
  const goalCell = nearestWalkableCell(grid, goalRaw.col, goalRaw.row);
  if (!startCell || !goalCell) return null;

  const open: HeapNode[] = [];
  const cameFrom = new Map<string, Cell>();
  const gScore = new Map<string, number>([[cellKey(startCell.col, startCell.row), 0]]);
  const startF = heuristic(startCell, goalCell);
  const fScore = new Map<string, number>([[cellKey(startCell.col, startCell.row), startF]]);
  heapPush(open, { cell: startCell, f: startF });

  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];

  while (open.length > 0) {
    const currentNode = heapPop(open)!;
    const current = currentNode.cell;
    const currentKey = cellKey(current.col, current.row);
    const bestF = fScore.get(currentKey) ?? Infinity;
    if (currentNode.f > bestF) continue;

    if (current.col === goalCell.col && current.row === goalCell.row) {
      const path: Array<{ x: number; z: number }> = [];
      let node: Cell | null = current;
      while (node) {
        path.push(cellToWorld(grid, node.col, node.row));
        node = cameFrom.get(cellKey(node.col, node.row)) ?? null;
      }
      path.reverse();
      return path;
    }

    for (const { dc, dr } of dirs) {
      const nc = current.col + dc;
      const nr = current.row + dr;
      if (!isWalkableCell(grid, nc, nr)) continue;

      const neighbor = { col: nc, row: nr };
      const neighborKey = cellKey(nc, nr);
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1;

      if (tentative < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentative);
        const f = tentative + heuristic(neighbor, goalCell);
        fScore.set(neighborKey, f);
        heapPush(open, { cell: neighbor, f });
      }
    }
  }

  return null;
};

export const pickRandomObjective = (
  grid: NavGrid,
  colliders: Collider[],
  fromX: number,
  fromZ: number,
  minDist: number,
  maxDist: number,
): { x: number; z: number } | null => {
  for (let attempt = 0; attempt < 48; attempt++) {
    const col = Math.floor(Math.random() * grid.cols);
    const row = Math.floor(Math.random() * grid.rows);
    if (!isWalkableCell(grid, col, row)) continue;
    const { x, z } = cellToWorld(grid, col, row);
    if (!isWalkableWorld(grid, x, z, colliders)) continue;
    const dist = Math.hypot(x - fromX, z - fromZ);
    if (dist < minDist || dist > maxDist) continue;
    return { x, z };
  }
  return null;
};
