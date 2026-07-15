export type LeftHandStateId = 'none' | 'idleHold' | 'block' | 'attack';

export type LeftHandStateMachine = {
  current: LeftHandStateId;
  stateTime: number;
  animTime: number;
};

export const createLeftHandStateMachine = (): LeftHandStateMachine => ({
  current: 'none',
  stateTime: 0,
  animTime: 0,
});

export const stepLeftHandFsm = (
  fsm: LeftHandStateMachine,
  dt: number,
  opts: {
    hasShield: boolean;
    blockHeld: boolean;
  },
): void => {
  if (!opts.hasShield) {
    fsm.current = 'none';
    fsm.stateTime = 0;
    return;
  }

  fsm.animTime += dt;

  if (opts.blockHeld) {
    fsm.current = 'block';
    return;
  }

  fsm.current = 'idleHold';
};
