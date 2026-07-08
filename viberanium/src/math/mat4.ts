import { type Vec3, v3, v3Cross, v3Normalize, v3Sub } from './vec3.ts';
import { type Quat } from './quat.ts';

export type Mat4 = Float32Array;

export const m4 = (): Mat4 => {
  const out = new Float32Array(16);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
};

export const m4Identity = (out: Mat4): Mat4 => {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
};

export const m4Mul = (out: Mat4, a: Mat4, b: Mat4): Mat4 => {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
  const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
  const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
  const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

  out[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;

  out[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;

  out[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;

  out[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
  out[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
  out[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
  out[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;
  return out;
};

export const m4Copy = (out: Mat4, a: Mat4): Mat4 => {
  out.set(a);
  return out;
};

export const m4Invert = (out: Mat4, a: Mat4): Mat4 => {
  // General 4x4 inverse (adapted from gl-matrix mat4.invert)
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  // Calculate the determinant
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-12) {
    // Non-invertible; return identity to avoid NaNs cascading through render.
    return m4Identity(out);
  }
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
};

export const m4FromTRS = (out: Mat4, t: Vec3, yawRad: number, s: Vec3): Mat4 => {
  const c = Math.cos(yawRad);
  const sn = Math.sin(yawRad);
  const sx = s[0], sy = s[1], sz = s[2];

  out[0] = c * sx;
  out[1] = 0;
  out[2] = -sn * sx;
  out[3] = 0;

  out[4] = 0;
  out[5] = sy;
  out[6] = 0;
  out[7] = 0;

  out[8] = sn * sz;
  out[9] = 0;
  out[10] = c * sz;
  out[11] = 0;

  out[12] = t[0];
  out[13] = t[1];
  out[14] = t[2];
  out[15] = 1;
  return out;
};

export const m4FromTRSQuat = (out: Mat4, t: Vec3, r: Quat, s: Vec3): Mat4 => {
  const x = r[0], y = r[1], z = r[2], w = r[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  const sx = s[0], sy = s[1], sz = s[2];

  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;

  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;

  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;

  out[12] = t[0];
  out[13] = t[1];
  out[14] = t[2];
  out[15] = 1;
  return out;
};

export const m4Ortho = (out: Mat4, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 => {
  const rl = 1 / (right - left);
  const tb = 1 / (top - bottom);
  const fn = 1 / (far - near);
  out[0] = 2 * rl;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 2 * tb;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = -2 * fn;
  out[11] = 0;
  out[12] = -(right + left) * rl;
  out[13] = -(top + bottom) * tb;
  out[14] = -(far + near) * fn;
  out[15] = 1;
  return out;
};

export const m4Perspective = (out: Mat4, fovyRad: number, aspect: number, near: number, far: number): Mat4 => {
  const f = 1.0 / Math.tan(fovyRad / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[11] = -1;
  if (Number.isFinite(far)) {
    const nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }
  return out;
};

const _f = v3();
const _s = v3();
const _u = v3();
const _tmp = v3();

export const m4LookAt = (out: Mat4, eye: Vec3, target: Vec3, up: Vec3): Mat4 => {
  v3Sub(_f, target, eye);
  v3Normalize(_f, _f);

  v3Cross(_s, _f, up);
  v3Normalize(_s, _s);

  v3Cross(_u, _s, _f);

  out[0] = _s[0];
  out[1] = _u[0];
  out[2] = -_f[0];
  out[3] = 0;

  out[4] = _s[1];
  out[5] = _u[1];
  out[6] = -_f[1];
  out[7] = 0;

  out[8] = _s[2];
  out[9] = _u[2];
  out[10] = -_f[2];
  out[11] = 0;

  _tmp[0] = -(_s[0] * eye[0] + _s[1] * eye[1] + _s[2] * eye[2]);
  _tmp[1] = -(_u[0] * eye[0] + _u[1] * eye[1] + _u[2] * eye[2]);
  _tmp[2] = (_f[0] * eye[0] + _f[1] * eye[1] + _f[2] * eye[2]);

  out[12] = _tmp[0];
  out[13] = _tmp[1];
  out[14] = _tmp[2];
  out[15] = 1;
  return out;
};

