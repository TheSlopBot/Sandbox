import { DUMMY_ACTOR } from '../actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../actors/actorDefinitionToSkeletalDef.ts';
import { type SkeletalCharacterDef } from './characterDef.ts';

export const DUMMY_DEF: SkeletalCharacterDef = actorDefinitionToSkeletalDef(DUMMY_ACTOR);
