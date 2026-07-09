import { DUMMY_GLB } from '../assets/kaykit.ts';
import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from '../animations/kaykitMedium.ts';
import { type SkeletalCharacterDef } from '../types/character.ts';

export const DUMMY_DEF: SkeletalCharacterDef = {
  bodyGlb: DUMMY_GLB,
  materialPrefix: 'dummy',
  animPack: KAYKIT_MEDIUM_ANIM_PACK,
  clips: KAYKIT_MEDIUM_CLIPS,
};
