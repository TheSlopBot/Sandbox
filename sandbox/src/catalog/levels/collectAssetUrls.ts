import { collectUrlsFromDef } from '../characters/characterDef.ts';
import { type LevelDefinition } from './levelDefinition.ts';
import { COMBAT_MECH_DEFS } from '../characters/combatMech.ts';
import { DUMMY_DEF } from '../characters/dummy.ts';
import { ROBOT_ONE_DEF } from '../characters/robot.ts';
import { SPACE_RANGER_DEF } from '../characters/spaceRanger.ts';

export const collectLevelAssetUrls = (definition: LevelDefinition): string[] => {
  const urls = new Set<string>([
    ...collectUrlsFromDef(SPACE_RANGER_DEF),
    ...collectUrlsFromDef(ROBOT_ONE_DEF),
    ...collectUrlsFromDef(COMBAT_MECH_DEFS.primary),
    ...collectUrlsFromDef(DUMMY_DEF),
  ]);

  for (const prop of definition.props) urls.add(prop.url);
  for (const robot of definition.robots ?? []) urls.add(robot.bodyGlb);

  return [...urls];
};
