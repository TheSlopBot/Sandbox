import { collectUrlsFromActor } from '../actors/actorDefinition.ts';
import { ACTOR_CATALOG } from '../actors/registry.ts';
import { type LevelDefinition } from './levelDefinition.ts';
import { getPropDefinition } from '../props/registry.ts';

export const collectLevelAssetUrls = (definition: LevelDefinition): string[] => {
  const urls = new Set<string>();

  for (const actor of Object.values(ACTOR_CATALOG)) {
    for (const url of collectUrlsFromActor(actor)) urls.add(url);
  }

  for (const placement of definition.props) {
    const def = getPropDefinition(placement.propId);

    for (const part of def.parts) {
      if (part.kind === 'asset') urls.add(part.url);
    }
  }

  for (const robot of definition.robots ?? []) urls.add(robot.bodyGlb);

  return [...urls];
};
