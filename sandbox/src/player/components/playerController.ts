export const PLAYER_CONTROLLER_KEY = 'playerController';

export type PlayerController = {
  resetKey: string;
  toggleHelmetKey: string;
};

export const createPlayerController = (): PlayerController => ({
  resetKey: 'KeyR',
  toggleHelmetKey: 'KeyH',
});
