import { ROBOT_ONE_GLB } from '../assets/kaykit.ts';
import { ROBOT_OME_ACTOR, ROBOT_ONE_ACTOR } from '../actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../actors/actorDefinitionToSkeletalDef.ts';
import { type SkeletalCharacterDef } from './characterDef.ts';

export const ROBOT_PRESETS = {
  robotOne: {
    bodyGlb: ROBOT_ONE_GLB,
    materialPrefix: 'robot_one',
  },
  robotOme: {
    bodyGlb: ROBOT_ONE_GLB,
    materialPrefix: 'robot_ome',
  },
} as const;

export type RobotPresetId = keyof typeof ROBOT_PRESETS;

export const ROBOT_ONE_DEF: SkeletalCharacterDef = actorDefinitionToSkeletalDef(ROBOT_ONE_ACTOR);

export const ROBOT_OME_DEF: SkeletalCharacterDef = actorDefinitionToSkeletalDef(ROBOT_OME_ACTOR);
