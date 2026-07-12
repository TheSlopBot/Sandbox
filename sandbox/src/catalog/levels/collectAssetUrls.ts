import { collectUrlsFromLevel, type LevelDefinition } from './levelDefinition.ts';

export const collectLevelAssetUrls = (definition: LevelDefinition): string[] => collectUrlsFromLevel(definition);
