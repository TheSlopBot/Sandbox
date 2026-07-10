import { type Quat, q4 } from 'viberanium';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export type EulerDegrees = [number, number, number];

export const quatToEulerDegrees = (q: readonly [number, number, number, number]): EulerDegrees => {
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];

  const sinrCosp = 2 * (w * x + y * z);
  const cosrCosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp);

  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return [
    Math.round(roll * DEG * 1000) / 1000,
    Math.round(pitch * DEG * 1000) / 1000,
    Math.round(yaw * DEG * 1000) / 1000,
  ];
};

export const eulerDegreesToQuat = (
  out: Quat,
  euler: readonly [number, number, number],
): Quat => {
  const hx = euler[0] * RAD * 0.5;
  const hy = euler[1] * RAD * 0.5;
  const hz = euler[2] * RAD * 0.5;

  const cx = Math.cos(hx);
  const sx = Math.sin(hx);
  const cy = Math.cos(hy);
  const sy = Math.sin(hy);
  const cz = Math.cos(hz);
  const sz = Math.sin(hz);

  out[0] = sx * cy * cz - cx * sy * sz;
  out[1] = cx * sy * cz + sx * cy * sz;
  out[2] = cx * cy * sz - sx * sy * cz;
  out[3] = cx * cy * cz + sx * sy * sz;
  return out;
};

export const createEulerQuat = (euler: readonly [number, number, number]): Quat =>
  eulerDegreesToQuat(q4(), euler);
