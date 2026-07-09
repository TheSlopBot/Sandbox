import {
  SPACE_RANGER_BLADE,
  SPACE_RANGER_GLB,
  SPACE_RANGER_HELMET,
  SPACE_RANGER_JETPACK,
} from '../../levels/assets.ts';
import { type SkeletalCharacterDef } from '../types.ts';
import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from './kaykitMedium.ts';

export const SPACE_RANGER_DEF: SkeletalCharacterDef = {
  bodyGlb: SPACE_RANGER_GLB,
  materialPrefix: 'spaceranger_body',
  animPack: KAYKIT_MEDIUM_ANIM_PACK,
  clips: KAYKIT_MEDIUM_CLIPS,
  attachments: [
    {
      id: 'helmet',
      gltfUrl: SPACE_RANGER_HELMET,
      materialPrefix: 'spaceranger_helmet',
      boneName: 'head',
      offsetT: [0, -0.02555268658183585, 0],
      spawnEquipped: true,
    },
    {
      id: 'jetpack',
      gltfUrl: SPACE_RANGER_JETPACK,
      materialPrefix: 'spaceranger_jetpack',
      boneName: 'chest',
      offsetT: [0, -0.00195912904760126, -0.3929741382598877],
      spawnEquipped: true,
    },
    {
      id: 'blade',
      gltfUrl: SPACE_RANGER_BLADE,
      materialPrefix: 'spaceranger_blade',
      boneName: 'hand.r',
      offsetR: [-0.8, 1, 0, 0],
      spawnEquipped: true,
    },
  ],
};
