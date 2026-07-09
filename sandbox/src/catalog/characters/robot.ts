import { ROBOT_ONE_GLB } from '../assets/kaykit.ts';
import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from '../animations/kaykitMedium.ts';
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

export const ROBOT_ONE_DEF: SkeletalCharacterDef = {
  bodyGlb: ROBOT_ONE_GLB,
  materialPrefix: 'robot_one',
  animPack: KAYKIT_MEDIUM_ANIM_PACK,
  clips: KAYKIT_MEDIUM_CLIPS,
};
