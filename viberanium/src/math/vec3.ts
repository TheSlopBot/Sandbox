export type Vec3 = Float32Array;

export const v3 = (x = 0, y = 0, z = 0): Vec3 => new Float32Array([x, y, z]);

export const v3Copy = (out: Vec3, a: Vec3): Vec3 => {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
};

export const v3Set = (out: Vec3, x: number, y: number, z: number): Vec3 => {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
};

export const v3Add = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
};

export const v3Sub = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
};

export const v3Scale = (out: Vec3, a: Vec3, s: number): Vec3 => {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
};

export const v3Dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const v3Len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

export const v3Normalize = (out: Vec3, a: Vec3): Vec3 => {
  const len = v3Len(a);
  if (len > 1e-8) {
    const inv = 1 / len;
    out[0] = a[0] * inv;
    out[1] = a[1] * inv;
    out[2] = a[2] * inv;
  } else {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  return out;
};

export const v3Cross = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
};

