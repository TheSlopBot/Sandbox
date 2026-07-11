import {
  COMBAT_MECH_ACTORS,
  type CombatMechVariant,
} from '../actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../actors/actorDefinitionToSkeletalDef.ts';
import { type SkeletalCharacterDef } from './characterDef.ts';

export type { CombatMechVariant };

export const COMBAT_MECH_CHARACTER_ENTRIES: Record<
  CombatMechVariant,
  Pick<SkeletalCharacterDef, 'bodyGlb' | 'materialPrefix' | 'baseColorTextureUrl'>
> = {
  primary: {
    bodyGlb: COMBAT_MECH_ACTORS.primary.character.url,
    materialPrefix: COMBAT_MECH_ACTORS.primary.character.materialPrefix,
    baseColorTextureUrl: COMBAT_MECH_ACTORS.primary.baseColorTextureUrl,
  },
  alt: {
    bodyGlb: COMBAT_MECH_ACTORS.alt.character.url,
    materialPrefix: COMBAT_MECH_ACTORS.alt.character.materialPrefix,
    baseColorTextureUrl: COMBAT_MECH_ACTORS.alt.baseColorTextureUrl,
  },
};

export const COMBAT_MECH_DEFS: Record<CombatMechVariant, SkeletalCharacterDef> = {
  primary: actorDefinitionToSkeletalDef(COMBAT_MECH_ACTORS.primary),
  alt: actorDefinitionToSkeletalDef(COMBAT_MECH_ACTORS.alt),
};
