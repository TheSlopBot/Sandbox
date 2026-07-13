import { type CharacterController } from './characterController.ts';
import { type MovementIntent } from './movementIntent.ts';

export type AnimStateId = 'idle' | 'run' | 'jumpStart' | 'jumpAir' | 'jumpLand';

export type AnimationStateMachine = {
  current: AnimStateId;
  stateTime: number;
  animTime: number;
  paused: boolean;
  runPlaybackSpeed: number;
  jumpStartDuration: number;
  jumpLandDuration: number;
  jumpStartSpeed: number;
  jumpLandSpeed: number;
};

export const createAnimationStateMachine = (): AnimationStateMachine => ({
  current: 'idle',
  stateTime: 0,
  animTime: 0,
  paused: false,
  runPlaybackSpeed: 1.5,
  jumpStartDuration: 0.3,
  jumpLandDuration: 0.3,
  jumpStartSpeed: 4,
  jumpLandSpeed: 2,
});

const MOVE_SPEED_EPS = 0.05 * 0.05;

const hasMoveSpeed = (x: number, z: number) => x * x + z * z > MOVE_SPEED_EPS;

const isMoving = (cc: CharacterController, intent?: MovementIntent | null) => {
  if (cc.sliding || cc.slideIgnoreInputRemaining > 0) return false;
  if (intent) return hasMoveSpeed(intent.desiredVelocity[0], intent.desiredVelocity[2]);
  return hasMoveSpeed(cc.velocity[0], cc.velocity[2]);
};

export const stepAnimationFsm = (
  cc: CharacterController,
  fsm: AnimationStateMachine,
  dt: number,
  intent?: MovementIntent | null,
): void => {
  if (fsm.paused) return;

  const grounded = cc.onGround || cc.sliding || cc.slideIgnoreInputRemaining > 0 || cc.coyoteRemaining > 0;
  const moving = isMoving(cc, intent);

  if (grounded && (fsm.current === 'jumpStart' || fsm.current === 'jumpAir')) {
    if (moving) fsm.current = 'run';
    else {
      fsm.current = 'jumpLand';
      fsm.stateTime = 0;
    }
  } else if (!grounded && (fsm.current === 'idle' || fsm.current === 'run')) {
    fsm.current = 'jumpAir';
    fsm.stateTime = 0;
  } else if (fsm.current === 'jumpStart' && fsm.stateTime >= fsm.jumpStartDuration) {
    fsm.current = 'jumpAir';
    fsm.stateTime = 0;
  } else if (fsm.current === 'jumpLand') {
    if (moving) fsm.current = 'run';
    else if (fsm.stateTime >= fsm.jumpLandDuration) fsm.current = 'idle';
  } else if (grounded && (fsm.current === 'idle' || fsm.current === 'run')) {
    fsm.current = moving ? 'run' : 'idle';
  }

  if (fsm.current === 'jumpStart') fsm.stateTime += dt * fsm.jumpStartSpeed;
  else if (fsm.current === 'jumpAir') fsm.stateTime += dt;
  else if (fsm.current === 'jumpLand') fsm.stateTime += dt * fsm.jumpLandSpeed;

  fsm.animTime += dt;
};
