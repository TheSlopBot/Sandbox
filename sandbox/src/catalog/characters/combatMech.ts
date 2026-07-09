import {
  COMBAT_MECH_GLB,
  COMBAT_MECH_TEX_ALT,
  COMBAT_MECH_TEX_PRIMARY,
} from '../assets/kaykit.ts';
import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from '../animations/kaykitMedium.ts';
import { type SkeletalCharacterDef } from '../types/character.ts';

export type CombatMechVariant = 'primary' | 'alt';

export const COMBAT_MECH_CHARACTER_ENTRIES: Record<
  CombatMechVariant,
  Pick<SkeletalCharacterDef, 'bodyGlb' | 'materialPrefix' | 'baseColorTextureUrl'>
> = {
  primary: {
    bodyGlb: COMBAT_MECH_GLB,
    materialPrefix: 'combat_mech_primary',
    baseColorTextureUrl: COMBAT_MECH_TEX_PRIMARY,
  },
  alt: {
    bodyGlb: COMBAT_MECH_GLB,
    materialPrefix: 'combat_mech_alt',
    baseColorTextureUrl: COMBAT_MECH_TEX_ALT,
  },
};

export const COMBAT_MECH_DEFS: Record<CombatMechVariant, SkeletalCharacterDef> = {
  primary: {
    ...COMBAT_MECH_CHARACTER_ENTRIES.primary,
    animPack: KAYKIT_MEDIUM_ANIM_PACK,
    clips: KAYKIT_MEDIUM_CLIPS,
  },
  alt: {
    ...COMBAT_MECH_CHARACTER_ENTRIES.alt,
    animPack: KAYKIT_MEDIUM_ANIM_PACK,
    clips: KAYKIT_MEDIUM_CLIPS,
  },
};
