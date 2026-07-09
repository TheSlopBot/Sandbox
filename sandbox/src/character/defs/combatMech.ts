import {
  COMBAT_MECH_GLB,
  COMBAT_MECH_TEX_ALT,
  COMBAT_MECH_TEX_PRIMARY,
} from '../../levels/assets.ts';
import { type SkeletalCharacterDef } from '../types.ts';
import { createKaykitMediumDef } from './kaykitMedium.ts';

export type CombatMechVariant = 'primary' | 'alt';

export const createCombatMechDef = (variant: CombatMechVariant): SkeletalCharacterDef =>
  createKaykitMediumDef(
    COMBAT_MECH_GLB,
    variant === 'alt' ? 'combat_mech_alt' : 'combat_mech_primary',
    { baseColorTextureUrl: variant === 'alt' ? COMBAT_MECH_TEX_ALT : COMBAT_MECH_TEX_PRIMARY },
  );
