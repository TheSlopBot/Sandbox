import { ANIM_GENERAL_GLB, ANIM_MOVEMENT_GLB } from '../../levels/assets.ts';
import { type SkeletalCharacterDef } from '../types.ts';

export const KAYKIT_MEDIUM_ANIM_PACK = {
  generalGlb: ANIM_GENERAL_GLB,
  movementGlb: ANIM_MOVEMENT_GLB,
};

export const KAYKIT_MEDIUM_CLIPS = {
  idle: 'idle_a',
  run: 'running_a',
  jumpStart: 'jump_start',
  jumpIdle: 'jump_idle',
  jumpLand: 'jump_land',
};

export const createKaykitMediumDef = (
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
