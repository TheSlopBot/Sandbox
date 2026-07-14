import { type Collider, type ColliderShape } from '../components/collider.ts';
import { type Quat, q4Conjugate, q4TransformVec3 } from '../math/quat.ts';
import { type Vec3, v3, v3Len, v3Normalize, v3Set, v3Sub } from '../math/vec3.ts';

export type BodyY = {
  x: number;
  y: number;
  z: number;
  radius: number;
  halfHeight: number;
};

export type BodyContact = {
  nx: number;
  ny: number;
  nz: number;
  depth: number;
  shapeKind?: ColliderShape['kind'];
};

const _invQ = new Float32Array(4) as Quat;
const _a = v3();
const _b = v3();
const _la = v3();
const _lb = v3();
const _p = v3();
const _q = v3();
const _n = v3();
const _tmp = v3();
const _segA = v3();
const _segB = v3();

const bodySegment = (body: BodyY, outA: Vec3, outB: Vec3) => {
  v3Set(outA, body.x, body.y - body.halfHeight, body.z);
  v3Set(outB, body.x, body.y + body.halfHeight, body.z);
};

const closestPointOnSegment = (out: Vec3, p: Vec3, a: Vec3, b: Vec3) => {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const apz = p[2] - a[2];
  const abLen2 = abx * abx + aby * aby + abz * abz;
  let t = abLen2 > 1e-12 ? (apx * abx + apy * aby + apz * abz) / abLen2 : 0;
  t = Math.max(0, Math.min(1, t));
  out[0] = a[0] + abx * t;
  out[1] = a[1] + aby * t;
  out[2] = a[2] + abz * t;
};

const clampAabbCentered = (out: Vec3, p: Vec3, hx: number, hy: number, hz: number) => {
  out[0] = Math.max(-hx, Math.min(hx, p[0]));
  out[1] = Math.max(-hy, Math.min(hy, p[1]));
  out[2] = Math.max(-hz, Math.min(hz, p[2]));
};

const closestOnCylinderLocal = (out: Vec3, p: Vec3, radius: number, halfHeight: number) => {
  const y = Math.max(-halfHeight, Math.min(halfHeight, p[1]));
  const xzLen = Math.hypot(p[0], p[2]);

  if (xzLen > radius) {
    const s = radius / xzLen;
    out[0] = p[0] * s;
    out[1] = y;
    out[2] = p[2] * s;
    return;
  }

  if (p[1] > halfHeight || p[1] < -halfHeight) {
    out[0] = p[0];
    out[1] = y;
    out[2] = p[2];
    return;
  }

  const toSide = radius - xzLen;
  const toTop = halfHeight - p[1];
  const toBot = p[1] + halfHeight;
  if (toSide <= toTop && toSide <= toBot) {
    if (xzLen < 1e-8) {
      out[0] = radius;
      out[1] = p[1];
      out[2] = 0;
    } else {
      const s = radius / xzLen;
      out[0] = p[0] * s;
      out[1] = p[1];
      out[2] = p[2] * s;
    }
  } else if (toTop <= toBot) {
    out[0] = p[0];
    out[1] = halfHeight;
    out[2] = p[2];
  } else {
    out[0] = p[0];
    out[1] = -halfHeight;
    out[2] = p[2];
  }
};

const closestOnEllipsoidLocal = (out: Vec3, p: Vec3, rx: number, ry: number, rz: number) => {
  const sx = p[0] / rx;
  const sy = p[1] / ry;
  const sz = p[2] / rz;
  const len = Math.hypot(sx, sy, sz);

  if (len < 1e-8) {
    out[0] = 0;
    out[1] = ry;
    out[2] = 0;
    return;
  }

  if (len >= 1) {
    out[0] = (sx / len) * rx;
    out[1] = (sy / len) * ry;
    out[2] = (sz / len) * rz;
    return;
  }

  out[0] = (sx / len) * rx;
  out[1] = (sy / len) * ry;
  out[2] = (sz / len) * rz;
};

const contactFromPoints = (
  bodyPt: Vec3,
  shapePt: Vec3,
  bodyRadius: number,
  shapeRadius: number,
): BodyContact | null => {
  v3Sub(_n, bodyPt, shapePt);
  const dist = v3Len(_n);
  const minDist = bodyRadius + shapeRadius;

  if (dist >= minDist && dist > 1e-12) return null;

  if (dist < 1e-8) {
    return { nx: 0, ny: 1, nz: 0, depth: minDist };
  }

  const inv = 1 / dist;
  return {
    nx: _n[0] * inv,
    ny: _n[1] * inv,
    nz: _n[2] * inv,
    depth: minDist - dist,
  };
};

const refineClosestOutside = (
  outCap: Vec3,
  outShape: Vec3,
  a: Vec3,
  b: Vec3,
  closestOnShape: (out: Vec3, p: Vec3) => void,
) => {
  outCap[0] = (a[0] + b[0]) * 0.5;
  outCap[1] = (a[1] + b[1]) * 0.5;
  outCap[2] = (a[2] + b[2]) * 0.5;
  closestOnShape(outShape, outCap);

  for (let i = 0; i < 5; i++) {
    closestPointOnSegment(outCap, outShape, a, b);
    closestOnShape(outShape, outCap);
  }
};

const worldFromLocal = (out: Vec3, local: Vec3, center: Vec3, rotation: Quat) => {
  q4TransformVec3(_tmp, rotation, local);
  out[0] = center[0] + _tmp[0];
  out[1] = center[1] + _tmp[1];
  out[2] = center[2] + _tmp[2];
};

export const bodyFeetY = (body: BodyY): number => body.y - body.halfHeight - body.radius;

const BOX_SURFACE_EPS = 0.05;

const _colX = v3();
const _colY = v3();
const _colZ = v3();

export const boxTopSurfaceYAt = (
  center: Vec3,
  halfExtents: Vec3,
  rotation: Quat,
  x: number,
  z: number,
): number => {
  q4TransformVec3(_colX, rotation, v3Set(_tmp, 1, 0, 0));
  q4TransformVec3(_colZ, rotation, v3Set(_tmp, 0, 0, 1));
  q4TransformVec3(_colY, rotation, v3Set(_tmp, 0, halfExtents[1], 0));

  const det = _colX[0] * _colZ[2] - _colZ[0] * _colX[2];
  if (Math.abs(det) < 1e-8) return -Infinity;

  const rx = x - center[0] - _colY[0];
  const rz = z - center[2] - _colY[2];
  const lx = (rx * _colZ[2] - rz * _colZ[0]) / det;
  const lz = (rz * _colX[0] - rx * _colX[2]) / det;

  if (Math.abs(lx) > halfExtents[0] || Math.abs(lz) > halfExtents[2]) return -Infinity;

  return center[1] + _colY[1] + _colX[1] * lx + _colZ[1] * lz;
};

const _boxFaceLocals: readonly [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const snapBoxFaceNormal = (
  rotation: Quat,
  nx: number,
  ny: number,
  nz: number,
  minDot = 0.92,
): { nx: number; ny: number; nz: number } | null => {
  let bestDot = -1;
  let bestNx = 0;
  let bestNy = 0;
  let bestNz = 0;

  for (const [lx, ly, lz] of _boxFaceLocals) {
    q4TransformVec3(_n, rotation, v3Set(_tmp, lx, ly, lz));
    v3Normalize(_n, _n);
    const dot = nx * _n[0] + ny * _n[1] + nz * _n[2];
    if (dot <= bestDot) continue;

    bestDot = dot;
    bestNx = _n[0];
    bestNy = _n[1];
    bestNz = _n[2];
  }

  if (bestDot < minDot) return null;

  return { nx: bestNx, ny: bestNy, nz: bestNz };
};

const toLocalSegment = (
  body: BodyY,
  center: Vec3,
  rotation: Quat,
  outLa: Vec3,
  outLb: Vec3,
) => {
  bodySegment(body, _a, _b);
  q4Conjugate(_invQ, rotation);
  v3Sub(_tmp, _a, center);
  q4TransformVec3(outLa, _invQ, _tmp);
  v3Sub(_tmp, _b, center);
  q4TransformVec3(outLb, _invQ, _tmp);
};

const contactVsSphere = (
  body: BodyY,
  center: Vec3,
  radius: number,
): BodyContact | null => {
  bodySegment(body, _a, _b);
  closestPointOnSegment(_p, center, _a, _b);
  return contactFromPoints(_p, center, body.radius, radius);
};

const pickBoxInsideSeparation = (
  body: BodyY,
  center: Vec3,
  halfExtents: Vec3,
  rotation: Quat,
  localP: Vec3,
  localSegA: Vec3,
  localSegB: Vec3,
): { lx: number; ly: number; lz: number; push: number } => {
  const hx = halfExtents[0];
  const hy = halfExtents[1];
  const hz = halfExtents[2];
  const dx = hx - Math.abs(localP[0]);
  const dy = hy - Math.abs(localP[1]);
  const dz = hz - Math.abs(localP[2]);
  const capCx = (localSegA[0] + localSegB[0]) * 0.5;
  const capCz = (localSegA[2] + localSegB[2]) * 0.5;
  const overFootprint = Math.abs(capCx) <= hx && Math.abs(capCz) <= hz;
  const footWorld = bodyFeetY(body);
  const topAtFootprint = boxTopSurfaceYAt(center, halfExtents, rotation, body.x, body.z);
  const aboveTop = footWorld >= topAtFootprint - BOX_SURFACE_EPS;

  if (overFootprint && aboveTop) {
    const highestY = Math.max(localSegA[1], localSegB[1]);
    return { lx: 0, ly: 1, lz: 0, push: Math.max(hy - highestY, 0) };
  }

  if (aboveTop) {
    const lateral = Math.min(dx, dz);
    if (lateral > 0 && lateral <= dy) {
      if (dx <= dz) return { lx: localP[0] >= 0 ? 1 : -1, ly: 0, lz: 0, push: dx };
      return { lx: 0, ly: 0, lz: localP[2] >= 0 ? 1 : -1, push: dz };
    }
  }

  if (dx <= dy && dx <= dz) return { lx: localP[0] >= 0 ? 1 : -1, ly: 0, lz: 0, push: dx };
  if (dy <= dz) return { lx: 0, ly: localP[1] >= 0 ? 1 : -1, lz: 0, push: dy };
  return { lx: 0, ly: 0, lz: localP[2] >= 0 ? 1 : -1, push: dz };
};

const boxContactFromLocalNormal = (
  rotation: Quat,
  lx: number,
  ly: number,
  lz: number,
  push: number,
  bodyRadius: number,
): BodyContact => {
  q4TransformVec3(_n, rotation, v3Set(_tmp, lx, ly, lz));
  v3Normalize(_n, _n);
  return {
    nx: _n[0],
    ny: _n[1],
    nz: _n[2],
    depth: push + bodyRadius,
  };
};

const contactVsBox = (
  body: BodyY,
  center: Vec3,
  halfExtents: Vec3,
  rotation: Quat,
): BodyContact | null => {
  const hx = halfExtents[0];
  const hy = halfExtents[1];
  const hz = halfExtents[2];
  toLocalSegment(body, center, rotation, _la, _lb);

  const closestOnBox = (out: Vec3, p: Vec3) => {
    clampAabbCentered(out, p, hx, hy, hz);
  };

  refineClosestOutside(_p, _q, _la, _lb, closestOnBox);

  const inside =
    Math.abs(_p[0]) <= hx && Math.abs(_p[1]) <= hy && Math.abs(_p[2]) <= hz;

  if (inside) {
    const sep = pickBoxInsideSeparation(body, center, halfExtents, rotation, _p, _la, _lb);
    return boxContactFromLocalNormal(rotation, sep.lx, sep.ly, sep.lz, sep.push, body.radius);
  }

  worldFromLocal(_segA, _p, center, rotation);
  worldFromLocal(_segB, _q, center, rotation);
  const hit = contactFromPoints(_segA, _segB, body.radius, 0);
  if (!hit) return null;

  const face = snapBoxFaceNormal(rotation, hit.nx, hit.ny, hit.nz);
  if (face) {
    return { nx: face.nx, ny: face.ny, nz: face.nz, depth: hit.depth };
  }

  return hit;
};

const contactVsCylinder = (
  body: BodyY,
  center: Vec3,
  radius: number,
  halfHeight: number,
  rotation: Quat,
): BodyContact | null => {
  toLocalSegment(body, center, rotation, _la, _lb);

  const closestOnCyl = (out: Vec3, p: Vec3) => {
    closestOnCylinderLocal(out, p, radius, halfHeight);
  };

  refineClosestOutside(_p, _q, _la, _lb, closestOnCyl);

  const xzLen = Math.hypot(_p[0], _p[2]);
  const inside =
    xzLen <= radius && _p[1] >= -halfHeight && _p[1] <= halfHeight;

  if (inside) {
    const toSide = radius - xzLen;
    const toTop = halfHeight - _p[1];
    const toBot = _p[1] + halfHeight;
    let lx = 0;
    let ly = 0;
    let lz = 0;
    let push = 0;
    if (toSide <= toTop && toSide <= toBot) {
      push = toSide;
      if (xzLen < 1e-8) {
        lx = 1;
      } else {
        lx = _p[0] / xzLen;
        lz = _p[2] / xzLen;
      }
    } else if (toTop <= toBot) {
      push = toTop;
      ly = 1;
    } else {
      push = toBot;
      ly = -1;
    }
    q4TransformVec3(_n, rotation, v3Set(_tmp, lx, ly, lz));
    v3Normalize(_n, _n);
    return {
      nx: _n[0],
      ny: _n[1],
      nz: _n[2],
      depth: push + body.radius,
    };
  }

  worldFromLocal(_segA, _p, center, rotation);
  worldFromLocal(_segB, _q, center, rotation);
  return contactFromPoints(_segA, _segB, body.radius, 0);
};

const contactVsEllipsoid = (
  body: BodyY,
  center: Vec3,
  radii: Vec3,
  rotation: Quat,
): BodyContact | null => {
  const rx = radii[0];
  const ry = radii[1];
  const rz = radii[2];
  toLocalSegment(body, center, rotation, _la, _lb);

  const closestOnEll = (out: Vec3, p: Vec3) => {
    closestOnEllipsoidLocal(out, p, rx, ry, rz);
  };

  refineClosestOutside(_p, _q, _la, _lb, closestOnEll);

  const sx = _p[0] / rx;
  const sy = _p[1] / ry;
  const sz = _p[2] / rz;
  const len2 = sx * sx + sy * sy + sz * sz;

  if (len2 < 1) {
    const len = Math.sqrt(Math.max(len2, 1e-12));
    v3Set(_tmp, sx / (rx * len), sy / (ry * len), sz / (rz * len));
    q4TransformVec3(_n, rotation, _tmp);
    v3Normalize(_n, _n);
    const surfaceDist = (1 - len) * Math.min(rx, ry, rz);
    return {
      nx: _n[0],
      ny: _n[1],
      nz: _n[2],
      depth: surfaceDist + body.radius,
    };
  }

  worldFromLocal(_segA, _p, center, rotation);
  worldFromLocal(_segB, _q, center, rotation);
  return contactFromPoints(_segA, _segB, body.radius, 0);
};

export const contactBodyVsShape = (
  body: BodyY,
  shape: ColliderShape,
): BodyContact | null => {
  if (shape.kind === 'sphere') {
    return contactVsSphere(body, shape.center, shape.radius);
  }

  if (shape.kind === 'box') {
    return contactVsBox(body, shape.center, shape.halfExtents, shape.rotation);
  }

  if (shape.kind === 'cylinder') {
    return contactVsCylinder(
      body,
      shape.center,
      shape.radius,
      shape.halfHeight,
      shape.rotation,
    );
  }

  return contactVsEllipsoid(body, shape.center, shape.radii, shape.rotation);
};

export const contactBodyVsCollider = (
  body: BodyY,
  collider: Collider,
): BodyContact | null => contactBodyVsShape(body, collider.shape);

export const contactNormalDot = (contact: BodyContact, v: Vec3): number =>
  contact.nx * v[0] + contact.ny * v[1] + contact.nz * v[2];

export const projectOutOfNormal = (v: Vec3, contact: BodyContact) => {
  const vn = contactNormalDot(contact, v);
  if (vn >= 0) return;
  v[0] -= contact.nx * vn;
  v[1] -= contact.ny * vn;
  v[2] -= contact.nz * vn;
};

export const footprintOverlapsShape = (
  shape: ColliderShape,
  x: number,
  z: number,
  radius: number,
): boolean => {
  if (shape.kind === 'sphere') {
    const dx = x - shape.center[0];
    const dz = z - shape.center[2];
    const r = shape.radius + radius;
    return dx * dx + dz * dz <= r * r;
  }

  if (shape.kind === 'box') {
    q4Conjugate(_invQ, shape.rotation);
    v3Set(_tmp, x - shape.center[0], 0, z - shape.center[2]);
    q4TransformVec3(_p, _invQ, _tmp);
    const hx = shape.halfExtents[0] + radius;
    const hz = shape.halfExtents[2] + radius;
    return Math.abs(_p[0]) <= hx && Math.abs(_p[2]) <= hz;
  }

  if (shape.kind === 'cylinder') {
    q4Conjugate(_invQ, shape.rotation);
    v3Set(_tmp, x - shape.center[0], 0, z - shape.center[2]);
    q4TransformVec3(_p, _invQ, _tmp);
    return Math.hypot(_p[0], _p[2]) <= shape.radius + radius;
  }

  q4Conjugate(_invQ, shape.rotation);
  v3Set(_tmp, x - shape.center[0], 0, z - shape.center[2]);
  q4TransformVec3(_p, _invQ, _tmp);
  const nx = _p[0] / (shape.radii[0] + radius);
  const nz = _p[2] / (shape.radii[2] + radius);
  return nx * nx + nz * nz <= 1;
};
