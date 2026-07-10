import { type Vec3 } from './vec3.ts';

export type Quat = Float32Array;

export const q4 = (x = 0, y = 0, z = 0, w = 1): Quat => new Float32Array([x, y, z, w]);

export const q4Copy = (out: Quat, a: Quat): Quat => {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
};

export const q4Normalize = (out: Quat, a: Quat): Quat => {
  const x = a[0], y = a[1], z = a[2], w = a[3];
  const len = Math.hypot(x, y, z, w);
  if (len > 1e-8) {
    const inv = 1 / len;
    out[0] = x * inv;
    out[1] = y * inv;
    out[2] = z * inv;
    out[3] = w * inv;
  } else {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
  }
  return out;
};

export const q4FromYaw = (out: Quat, yawRad: number): Quat => {
  const half = yawRad * 0.5;
  out[0] = 0;
  out[1] = Math.sin(half);
  out[2] = 0;
  out[3] = Math.cos(half);
  return out;
};

export const q4Conjugate = (out: Quat, a: Quat): Quat => {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
};

export const q4TransformVec3 = (out: Vec3, q: Quat, v: Vec3): Vec3 => {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const vx = v[0], vy = v[1], vz = v[2];

  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;

  out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  return out;
};

export const q4Slerp = (out: Quat, a: Quat, b: Quat, t: number): Quat => {
  let ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];

  let cos = ax * bx + ay * by + az * bz + aw * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (cos > 0.9995) {
    out[0] = ax + (bx - ax) * t;
    out[1] = ay + (by - ay) * t;
    out[2] = az + (bz - az) * t;
    out[3] = aw + (bw - aw) * t;
    return q4Normalize(out, out);
  }

  const theta = Math.acos(Math.min(1, Math.max(-1, cos)));
  const sinTheta = Math.sin(theta);
  const w1 = Math.sin((1 - t) * theta) / sinTheta;
  const w2 = Math.sin(t * theta) / sinTheta;

  out[0] = ax * w1 + bx * w2;
  out[1] = ay * w1 + by * w2;
  out[2] = az * w1 + bz * w2;
  out[3] = aw * w1 + bw * w2;
  return out;
};

