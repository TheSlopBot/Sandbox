import { type CombatMechVariant, type DummyVariant } from '../actors/kaykitActors.ts';

export type LevelPropPlacement = {
  propId: string;
  x: number;
  y?: number;
  z: number;
  yaw?: number;
  scale?: number;
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
  variant?: DummyVariant;
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
  props: LevelPropPlacement[];
  robots?: LevelRobotSpawn[];
  combatMechs?: LevelCombatMechSpawn[];
  dummies?: LevelDummySpawn[];
};