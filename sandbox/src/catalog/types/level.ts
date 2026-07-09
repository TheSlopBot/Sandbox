import { type CombatMechVariant } from '../characters/combatMech.ts';

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
