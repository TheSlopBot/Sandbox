export type PlayerController = {
  resetKey: string;
};

export const createPlayerController = (): PlayerController => ({
  resetKey: 'KeyR',
});
