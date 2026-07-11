import { SPACE_RANGER_ACTOR } from '../actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../actors/actorDefinitionToSkeletalDef.ts';
import { type SkeletalCharacterDef } from './characterDef.ts';

export const SPACE_RANGER_DEF: SkeletalCharacterDef = actorDefinitionToSkeletalDef(SPACE_RANGER_ACTOR);
