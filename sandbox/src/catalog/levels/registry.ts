import { buildLevelSeedDocument, type LevelSeedDocument } from './levelSeed.ts';
import { TEST_ONE } from './testOne.ts';
import { TEST_TWO } from './testTwo.ts';
import { TEST_THREE } from './testThree.ts';
import { TEST_FOUR } from './testFour.ts';

export const LEVEL_SEED_DOCUMENTS: LevelSeedDocument[] = [TEST_ONE, TEST_TWO, TEST_THREE, TEST_FOUR].map(
  buildLevelSeedDocument,
);
