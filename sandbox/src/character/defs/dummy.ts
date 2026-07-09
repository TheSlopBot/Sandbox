import { DUMMY_GLB } from '../../levels/assets.ts';
import { type SkeletalCharacterDef } from '../types.ts';
import { createKaykitMediumDef } from './kaykitMedium.ts';

export const DUMMY_DEF: SkeletalCharacterDef = createKaykitMediumDef(DUMMY_GLB, 'dummy');
