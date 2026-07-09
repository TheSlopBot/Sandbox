import { type LoadedAttachment } from '../../character/loadSkeletalCharacter.ts';

export const PLAYER_CONTROLLER_KEY = 'playerController';

export type PlayerController = {
  resetKey: string;
  toggleHelmetKey: string;
  moveLeftKeys: readonly string[];
  moveRightKeys: readonly string[];
  moveForwardKeys: readonly string[];
  moveBackwardKeys: readonly string[];
  jumpKey: string;
  helmetEntityId: number | null;
  stowedHelmet: LoadedAttachment | null;
};

export const createPlayerController = (): PlayerController => ({
  resetKey: 'KeyR',
  toggleHelmetKey: 'KeyH',
  moveLeftKeys: ['KeyA', 'ArrowLeft'],
  moveRightKeys: ['KeyD', 'ArrowRight'],
  moveForwardKeys: ['KeyW', 'ArrowUp'],
  moveBackwardKeys: ['KeyS', 'ArrowDown'],
  jumpKey: 'Space',
  helmetEntityId: null,
  stowedHelmet: null,
});
