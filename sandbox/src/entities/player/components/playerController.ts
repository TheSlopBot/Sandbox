export type PlayerController = {
  resetKey: string;
  moveLeftKeys: readonly string[];
  moveRightKeys: readonly string[];
  moveForwardKeys: readonly string[];
  moveBackwardKeys: readonly string[];
  jumpKey: string;
};

export const createPlayerController = (): PlayerController => ({
  resetKey: 'Home',
  moveLeftKeys: ['KeyA', 'ArrowLeft'],
  moveRightKeys: ['KeyD', 'ArrowRight'],
  moveForwardKeys: ['KeyW', 'ArrowUp'],
  moveBackwardKeys: ['KeyS', 'ArrowDown'],
  jumpKey: 'Space',
});
