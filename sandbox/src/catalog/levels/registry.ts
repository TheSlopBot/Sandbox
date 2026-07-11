import { type LevelDefinition } from './levelDefinition.ts';
import { TEST_ONE } from './testOne.ts';
import { TEST_TWO } from './testTwo.ts';
import { TEST_THREE } from './testThree.ts';
import { TEST_FOUR } from './testFour.ts';

export const LEVEL_CATALOG: Record<string, LevelDefinition> = {
  testOne: TEST_ONE,
  testTwo: TEST_TWO,
  testThree: TEST_THREE,
  testFour: TEST_FOUR,
};
