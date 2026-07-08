import {
  CUBE_SMALL,
  CUBE_LARGE,
  ROBOT_ONE_GLB,
  SPACE_RANGER_GLB,
  ANIM_GENERAL_GLB,
  ANIM_MOVEMENT_GLB,
} from './assets.ts';

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
};

const DEFAULT_NAV_GRID: LevelNavGridConfig = {
  minX: -18,
  maxX: 18,
  minZ: -18,
  maxZ: 18,
  cellSize: 1.0,
};

export const LEVEL_TEST: LevelDefinition = {
  id: 'test',
  displayName: 'Test Arena',
  navGrid: DEFAULT_NAV_GRID,
  props: [
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
  ],
  robots: [
    { x: -11, z: -11, bodyGlb: ROBOT_ONE_GLB, materialPrefix: 'robot_one' },
    { x: 11, z: -11, bodyGlb: ROBOT_ONE_GLB, materialPrefix: 'robot_ome' },
  ],
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
  robots: [
    { x: -14, z: 12, bodyGlb: ROBOT_ONE_GLB, materialPrefix: 'robot_one' },
  ],
};

export const LEVEL_CATALOG: Record<string, LevelDefinition> = {
  test: LEVEL_TEST,
  alt: LEVEL_ALT,
};

export const collectLevelAssetUrls = (definition: LevelDefinition): string[] => {
  const urls = new Set<string>([ROBOT_ONE_GLB, ANIM_GENERAL_GLB, ANIM_MOVEMENT_GLB, SPACE_RANGER_GLB]);

  for (const prop of definition.props) urls.add(prop.url);
  for (const robot of definition.robots ?? []) urls.add(robot.bodyGlb);

  return [...urls];
};
