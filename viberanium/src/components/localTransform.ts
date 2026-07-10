import { type Vec3, v3 } from '../math/vec3.ts';
import { type Quat, q4 } from '../math/quat.ts';

export type LocalTransform = {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
};

export const createLocalTransform = (): LocalTransform => ({
  position: v3(),
  rotation: q4(),
  scale: v3(1, 1, 1),
});
