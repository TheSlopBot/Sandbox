import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type NavGrid } from '../navigation/navGrid.ts';

export type NavGridComponent = NavGrid & {
  agentRadius: number;
  dirty: boolean;
};

export type NavGridOpts = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cellSize: number;
  agentRadius?: number;
};

export const createNavGrid = (opts: NavGridOpts): NavGridComponent => {
  const cols = Math.max(1, Math.ceil((opts.maxX - opts.minX) / opts.cellSize));
  const rows = Math.max(1, Math.ceil((opts.maxZ - opts.minZ) / opts.cellSize));

  return {
    minX: opts.minX,
    minZ: opts.minZ,
    cols,
    rows,
    cellSize: opts.cellSize,
    blocked: new Uint8Array(cols * rows),
    agentRadius: opts.agentRadius ?? 0.35,
    dirty: true,
  };
};

export const markNavGridDirty = (registry: Registry): void => {
  for (const e of registry.view(COMPONENT_KEYS.navGrid)) {
    (e.components[COMPONENT_KEYS.navGrid] as NavGridComponent).dirty = true;
  }
};
