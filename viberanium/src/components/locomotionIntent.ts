import { type Vec3, v3 } from '../math/vec3.ts';

export type LocomotionIntent = {
  desiredVelocity: Vec3;
  jumpRequested: boolean;
};

export const createLocomotionIntent = (): LocomotionIntent => ({
  desiredVelocity: v3(),
  jumpRequested: false,
});
