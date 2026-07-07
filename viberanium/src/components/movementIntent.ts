import { type Vec3, v3 } from '../math/vec3.ts';

export type MovementIntent = {
  desiredVelocity: Vec3;
  jumpRequested: boolean;
};

export const createMovementIntent = (): MovementIntent => ({
  desiredVelocity: v3(),
  jumpRequested: false,
});
