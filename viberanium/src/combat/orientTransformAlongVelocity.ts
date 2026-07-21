import { type Mat4 } from '../math/mat4.ts';
import { type Transform } from '../components/transform.ts';

export const orientTransformAlongVelocity = (
  t: Transform,
  velocity: [number, number, number],
): void => {
  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  if (speed < 1e-8) {
    t.yaw = 0;
    t.dirty = true;
    return;
  }

  const fx = velocity[0] / speed;
  const fy = velocity[1] / speed;
  const fz = velocity[2] / speed;

  let ux = 0;
  let uy = 1;
  let uz = 0;
  if (Math.abs(fy) > 0.999) {
    ux = 0;
    uy = 0;
    uz = -1;
  }

  let rx = uy * fz - uz * fy;
  let ry = uz * fx - ux * fz;
  let rz = ux * fy - uy * fx;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  const upx = fy * rz - fz * ry;
  const upy = fz * rx - fx * rz;
  const upz = fx * ry - fy * rx;

  const w = t.world as Mat4;
  w[0] = rx;
  w[1] = ry;
  w[2] = rz;
  w[3] = 0;
  w[4] = upx;
  w[5] = upy;
  w[6] = upz;
  w[7] = 0;
  w[8] = fx;
  w[9] = fy;
  w[10] = fz;
  w[11] = 0;
  w[12] = t.position[0];
  w[13] = t.position[1];
  w[14] = t.position[2];
  w[15] = 1;
  t.yaw = Math.atan2(fx, fz);
  t.dirty = false;
};