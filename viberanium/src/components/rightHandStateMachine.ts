export type RightHandStateId = 'none' | 'idleHold' | 'aim' | 'attack' | 'reload';

export type RightHandEquipmentCaps = {
  canAim: boolean;
  attackOnPrimary: boolean;
  reloadAfterAttack: boolean;
  attackSpeedScales: boolean;
  holdIdleAtEnd: boolean;
};

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

export const handCapsForWeaponKind = (
  kind: 'melee' | 'gun' | 'shield' | 'projectile' | undefined,
): RightHandEquipmentCaps => {
  if (kind === 'gun') {
    return {
      canAim: false,
      attackOnPrimary: false,
      reloadAfterAttack: false,
      attackSpeedScales: false,
      holdIdleAtEnd: true,
    };
  }

  return {
    canAim: false,
    attackOnPrimary: true,
    reloadAfterAttack: false,
    attackSpeedScales: true,
    holdIdleAtEnd: false,
  };
};

const GUN_IDLE_END_TIME = 1e6;

export const stepRightHandFsm = (
  fsm: RightHandStateMachine,
  dt: number,
  opts: {
    hasWeapon: boolean;
    attackPressed: boolean;
    aimHeld: boolean;
    caps: RightHandEquipmentCaps;
    attackSpeed?: number;
  },
): void => {
  if (!opts.hasWeapon) {
    fsm.current = 'none';
    fsm.stateTime = 0;
    return;
  }

  if (opts.caps.holdIdleAtEnd) {
    fsm.current = 'idleHold';
    fsm.stateTime = 0;
    fsm.animTime = GUN_IDLE_END_TIME;
    return;
  }

  fsm.animTime += dt;

  if (fsm.current === 'attack') {
    const attackSpeed = opts.caps.attackSpeedScales
      ? Math.max(1e-4, opts.attackSpeed ?? 1)
      : 1;
    fsm.stateTime += dt * attackSpeed;
    if (fsm.stateTime >= fsm.attackDuration) {
      if (opts.caps.reloadAfterAttack) {
        fsm.current = 'reload';
        fsm.stateTime = 0;
      } else {
        fsm.current = opts.caps.canAim && opts.aimHeld ? 'aim' : 'idleHold';
        fsm.stateTime = 0;
      }
    }
    return;
  }

  if (fsm.current === 'reload') {
    fsm.stateTime += dt;
    if (fsm.stateTime >= fsm.reloadDuration) {
      fsm.current = opts.caps.canAim && opts.aimHeld ? 'aim' : 'idleHold';
      fsm.stateTime = 0;
    }
    return;
  }

  if (opts.caps.attackOnPrimary && opts.attackPressed) {
    fsm.current = 'attack';
    fsm.stateTime = 0;
    return;
  }

  if (opts.caps.canAim && opts.aimHeld) {
    fsm.current = 'aim';
    return;
  }

  fsm.current = 'idleHold';
};
