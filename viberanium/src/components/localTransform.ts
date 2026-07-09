import { type Vec3, v3 } from '../math/vec3.ts';

export type LocalTransform = {
  position: Vec3;
  yaw: number;
  scale: Vec3;
};

export const createLocalTransform = (): LocalTransform => ({
  position: v3(),
  yaw: 0,
  scale: v3(1, 1, 1),
});
