import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from '../../catalog/animations/kaykitMedium.ts';
import { type SkeletalCharacterDef } from '../../catalog/types/character.ts';

export const buildKaykitMediumDef = (
  bodyGlb: string,
  materialPrefix: string,
  extras: Partial<SkeletalCharacterDef> = {},
): SkeletalCharacterDef => ({
  bodyGlb,
  materialPrefix,
  animPack: KAYKIT_MEDIUM_ANIM_PACK,
  clips: KAYKIT_MEDIUM_CLIPS,
  ...extras,
});
