import { type LevelDefinition } from '../types/level.ts';
import { LEVEL_ALT } from './alt.ts';
import { LEVEL_TEST } from './test.ts';

export const LEVEL_CATALOG: Record<string, LevelDefinition> = {
  test: LEVEL_TEST,
  alt: LEVEL_ALT,
};
