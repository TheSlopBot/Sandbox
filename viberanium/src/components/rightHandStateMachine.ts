export type RightHandStateId = 'none' | 'idleHold' | 'aim' | 'attack' | 'reload';

export type RightHandStateMachine = {
  current: RightHandStateId;
  stateTime: number;
  animTime: number;
  attackDuration: number;
  reloadDuration: number;
};

export const createRightHandStateMachine = (): RightHandStateMachine => ({
  current: 'none',
  stateTime: 0,
  animTime: 0,
  attackDuration: 0.45,
  reloadDuration: 0.5,
});

export const stepRightHandFsm = (
  fsm: RightHandStateMachine,
  dt: number,
  opts: {
    hasWeapon: boolean;
    attackPressed: boolean;
    aimHeld: boolean;
    releasePressed: boolean;
    isRanged: boolean;
    attackSpeed?: number;
  },
): void => {
  if (!opts.hasWeapon) {
    fsm.current = 'none';
    fsm.stateTime = 0;
    return;
  }

  fsm.animTime += dt;

  if (fsm.current === 'attack') {
    const attackSpeed = opts.isRanged ? 1 : Math.max(1e-4, opts.attackSpeed ?? 1);
    fsm.stateTime += dt * attackSpeed;
    if (fsm.stateTime >= fsm.attackDuration) {
      if (opts.isRanged) {
        fsm.current = 'reload';
        fsm.stateTime = 0;
      } else {
        fsm.current = opts.aimHeld && opts.isRanged ? 'aim' : 'idleHold';
        fsm.stateTime = 0;
      }
    }
    return;
  }

  if (fsm.current === 'reload') {
    fsm.stateTime += dt;
    if (fsm.stateTime >= fsm.reloadDuration) {
      fsm.current = opts.aimHeld ? 'aim' : 'idleHold';
      fsm.stateTime = 0;
    }
    return;
  }

  if (opts.isRanged && opts.releasePressed && opts.aimHeld) {
    fsm.current = 'attack';
    fsm.stateTime = 0;
    return;
  }

  if (!opts.isRanged && opts.attackPressed) {
    fsm.current = 'attack';
    fsm.stateTime = 0;
    return;
  }

  if (opts.isRanged && opts.aimHeld) {
    fsm.current = 'aim';
    return;
  }

  fsm.current = 'idleHold';
};
