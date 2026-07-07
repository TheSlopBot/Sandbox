import { type Mat4, m4, m4FromTRS } from '../math/mat4.ts';
import { type Vec3, v3 } from '../math/vec3.ts';

export type Transform = {
  position: Vec3;
  yaw: number;
  scale: Vec3;
  world: Mat4;
  dirty: boolean;
};

export const createTransform = (): Transform => ({
  position: v3(),
  yaw: 0,
  scale: v3(1, 1, 1),
  world: m4(),
  dirty: true,
});

export const updateWorldMatrix = (t: Transform): void => {
  if (!t.dirty) return;
  m4FromTRS(t.world, t.position, t.yaw, t.scale);
  t.dirty = false;
};
