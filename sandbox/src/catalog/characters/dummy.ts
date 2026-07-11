import {
  DUMMY_ACTORS,
  type DummyVariant,
} from '../actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../actors/actorDefinitionToSkeletalDef.ts';
import { type SkeletalCharacterDef } from './characterDef.ts';

export type { DummyVariant };

export const DUMMY_CHARACTER_ENTRIES: Record<
  DummyVariant,
  Pick<SkeletalCharacterDef, 'bodyGlb' | 'materialPrefix' | 'baseColorTextureUrl'>
> = {
  primary: {
    bodyGlb: DUMMY_ACTORS.primary.character.url,
    materialPrefix: DUMMY_ACTORS.primary.character.materialPrefix,
    baseColorTextureUrl: DUMMY_ACTORS.primary.baseColorTextureUrl,
  },
  altA: {
    bodyGlb: DUMMY_ACTORS.altA.character.url,
    materialPrefix: DUMMY_ACTORS.altA.character.materialPrefix,
    baseColorTextureUrl: DUMMY_ACTORS.altA.baseColorTextureUrl,
  },
  altB: {
    bodyGlb: DUMMY_ACTORS.altB.character.url,
    materialPrefix: DUMMY_ACTORS.altB.character.materialPrefix,
    baseColorTextureUrl: DUMMY_ACTORS.altB.baseColorTextureUrl,
  },
  altC: {
    bodyGlb: DUMMY_ACTORS.altC.character.url,
    materialPrefix: DUMMY_ACTORS.altC.character.materialPrefix,
    baseColorTextureUrl: DUMMY_ACTORS.altC.baseColorTextureUrl,
  },
};

export const DUMMY_DEFS: Record<DummyVariant, SkeletalCharacterDef> = {
  primary: actorDefinitionToSkeletalDef(DUMMY_ACTORS.primary),
  altA: actorDefinitionToSkeletalDef(DUMMY_ACTORS.altA),
  altB: actorDefinitionToSkeletalDef(DUMMY_ACTORS.altB),
  altC: actorDefinitionToSkeletalDef(DUMMY_ACTORS.altC),
};

export const DUMMY_DEF = DUMMY_DEFS.primary;
