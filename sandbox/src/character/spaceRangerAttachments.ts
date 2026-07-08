import {
  SPACE_RANGER_HELMET,
  SPACE_RANGER_JETPACK,
} from '../levels/assets.ts';
import { type CharacterAttachmentDef } from './assembleCharacter.ts';

export const SPACE_RANGER_ATTACHMENTS: CharacterAttachmentDef[] = [
  {
    id: 'helmet',
    gltfUrl: SPACE_RANGER_HELMET,
    materialPrefix: 'spaceranger_helmet',
    boneName: 'head',
    offsetT: [0, -0.02555268658183585, 0],
  },
  {
    id: 'jetpack',
    gltfUrl: SPACE_RANGER_JETPACK,
    materialPrefix: 'spaceranger_jetpack',
    boneName: 'chest',
    offsetT: [0, -0.00195912904760126, -0.3929741382598877],
  },
];
