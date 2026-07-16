import { type Vec3, v3 } from '../math/vec3.ts';

export type MovementImpulse = {
  velocity: Vec3;
  groundDrag: number;
  airDrag: number;
};

export const createMovementImpulse = (opts?: {
  groundDrag?: number;
  airDrag?: number;
}): MovementImpulse => ({
  velocity: v3(),
  groundDrag: opts?.groundDrag ?? 6,
  airDrag: opts?.airDrag ?? 4,
});

export const addMovementImpulse = (
  impulse: MovementImpulse,
  x: number,
  y: number,
  z: number,
): void => {
  impulse.velocity[0] += x;
  impulse.velocity[1] += y;
  impulse.velocity[2] += z;
};
