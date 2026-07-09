import { type CharacterController } from './characterController.ts';

export type AnimStateId = 'idle' | 'run' | 'jumpStart' | 'jumpAir' | 'jumpLand';

export type AnimationStateMachine = {
  current: AnimStateId;
  stateTime: number;
  animTime: number;
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
  runPlaybackSpeed: 1.5,
  jumpStartDuration: 0.3,
  jumpLandDuration: 0.3,
  jumpStartSpeed: 4,
  jumpLandSpeed: 2,
});

const moveSpeedSq = (cc: CharacterController) =>
  cc.velocity[0] * cc.velocity[0] + cc.velocity[2] * cc.velocity[2];

const isMoving = (cc: CharacterController) => moveSpeedSq(cc) > 0.05 * 0.05;

export const stepAnimationFsm = (
  cc: CharacterController,
  fsm: AnimationStateMachine,
  dt: number,
): void => {
  const wasOnGround = cc.wasOnGroundPrevious;
  const moving = isMoving(cc);

  if (cc.onGround && (fsm.current === 'jumpStart' || fsm.current === 'jumpAir')) {
    if (moving) fsm.current = 'run';
    else {
      fsm.current = 'jumpLand';
      fsm.stateTime = 0;
    }
  } else if (!cc.onGround && wasOnGround && (fsm.current === 'idle' || fsm.current === 'run')) {
    fsm.current = 'jumpAir';
    fsm.stateTime = 0;
  } else if (fsm.current === 'jumpStart' && fsm.stateTime >= fsm.jumpStartDuration) {
    fsm.current = 'jumpAir';
    fsm.stateTime = 0;
  } else if (fsm.current === 'jumpLand') {
    if (moving) fsm.current = 'run';
    else if (fsm.stateTime >= fsm.jumpLandDuration) fsm.current = 'idle';
  } else if (cc.onGround && (fsm.current === 'idle' || fsm.current === 'run')) {
    fsm.current = moving ? 'run' : 'idle';
  }

  if (fsm.current === 'jumpStart') fsm.stateTime += dt * fsm.jumpStartSpeed;
  else if (fsm.current === 'jumpAir') fsm.stateTime += dt;
  else if (fsm.current === 'jumpLand') fsm.stateTime += dt * fsm.jumpLandSpeed;

  fsm.animTime += dt;
};
