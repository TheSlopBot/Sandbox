import { type Collider, type ColliderShape } from '../components/collider.ts';
import { type Quat, q4Conjugate, q4TransformVec3 } from '../math/quat.ts';
import { type Vec3, v3, v3Copy, v3Len, v3Normalize, v3Set, v3Sub } from '../math/vec3.ts';

export type CapsuleY = {
  x: number;
  y: number;
  z: number;
  radius: number;
  halfHeight: number;
};

export type CapsuleContact = {
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

const capsuleSegment = (capsule: CapsuleY, outA: Vec3, outB: Vec3) => {
  v3Set(outA, capsule.x, capsule.y - capsule.halfHeight, capsule.z);
  v3Set(outB, capsule.x, capsule.y + capsule.halfHeight, capsule.z);
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

const closestPointsSegments = (
  outP: Vec3,
  outQ: Vec3,
  a0: Vec3,
  a1: Vec3,
  b0: Vec3,
  b1: Vec3,
) => {
  const d1x = a1[0] - a0[0];
  const d1y = a1[1] - a0[1];
  const d1z = a1[2] - a0[2];
  const d2x = b1[0] - b0[0];
  const d2y = b1[1] - b0[1];
  const d2z = b1[2] - b0[2];
  const rx = a0[0] - b0[0];
  const ry = a0[1] - b0[1];
  const rz = a0[2] - b0[2];
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s = 0;
  let t = 0;

  if (a <= 1e-12 && e <= 1e-12) {
    v3Copy(outP, a0);
    v3Copy(outQ, b0);
    return;
  }

  if (a <= 1e-12) {
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-12) {
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }

  outP[0] = a0[0] + d1x * s;
  outP[1] = a0[1] + d1y * s;
  outP[2] = a0[2] + d1z * s;
  outQ[0] = b0[0] + d2x * t;
  outQ[1] = b0[1] + d2y * t;
  outQ[2] = b0[2] + d2z * t;
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
  capPt: Vec3,
  shapePt: Vec3,
  capsuleRadius: number,
  shapeRadius: number,
): CapsuleContact | null => {
  v3Sub(_n, capPt, shapePt);
  const dist = v3Len(_n);
  const minDist = capsuleRadius + shapeRadius;

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

const toLocalSegment = (
  capsule: CapsuleY,
  center: Vec3,
  rotation: Quat,
  outLa: Vec3,
  outLb: Vec3,
) => {
  capsuleSegment(capsule, _a, _b);
  q4Conjugate(_invQ, rotation);
  v3Sub(_tmp, _a, center);
  q4TransformVec3(outLa, _invQ, _tmp);
  v3Sub(_tmp, _b, center);
  q4TransformVec3(outLb, _invQ, _tmp);
};

const contactVsSphere = (
  capsule: CapsuleY,
  center: Vec3,
  radius: number,
): CapsuleContact | null => {
  capsuleSegment(capsule, _a, _b);
  closestPointOnSegment(_p, center, _a, _b);
  return contactFromPoints(_p, center, capsule.radius, radius);
};

const contactVsBox = (
  capsule: CapsuleY,
  center: Vec3,
  halfExtents: Vec3,
  rotation: Quat,
): CapsuleContact | null => {
  const hx = halfExtents[0];
  const hy = halfExtents[1];
  const hz = halfExtents[2];
  toLocalSegment(capsule, center, rotation, _la, _lb);

  const closestOnBox = (out: Vec3, p: Vec3) => {
    clampAabbCentered(out, p, hx, hy, hz);
  };

  refineClosestOutside(_p, _q, _la, _lb, closestOnBox);

  const inside =
    Math.abs(_p[0]) <= hx && Math.abs(_p[1]) <= hy && Math.abs(_p[2]) <= hz;

  if (inside) {
    const dx = hx - Math.abs(_p[0]);
    const dy = hy - Math.abs(_p[1]);
    const dz = hz - Math.abs(_p[2]);
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let push = 0;
    if (dx <= dy && dx <= dz) {
      nx = _p[0] >= 0 ? 1 : -1;
      push = dx;
      _q[0] = nx * hx;
      _q[1] = _p[1];
      _q[2] = _p[2];
    } else if (dy <= dz) {
      ny = _p[1] >= 0 ? 1 : -1;
      push = dy;
      _q[0] = _p[0];
      _q[1] = ny * hy;
      _q[2] = _p[2];
    } else {
      nz = _p[2] >= 0 ? 1 : -1;
      push = dz;
      _q[0] = _p[0];
      _q[1] = _p[1];
      _q[2] = nz * hz;
    }
    q4TransformVec3(_n, rotation, v3Set(_tmp, nx, ny, nz));
    v3Normalize(_n, _n);
    worldFromLocal(_segA, _p, center, rotation);
    return {
      nx: _n[0],
      ny: _n[1],
      nz: _n[2],
      depth: push + capsule.radius,
    };
  }

  worldFromLocal(_segA, _p, center, rotation);
  worldFromLocal(_segB, _q, center, rotation);
  const hit = contactFromPoints(_segA, _segB, capsule.radius, 0);
  if (!hit) return null;

  const onX = Math.abs(Math.abs(_q[0]) - hx) <= 1e-4;
  const onY = Math.abs(Math.abs(_q[1]) - hy) <= 1e-4;
  const onZ = Math.abs(Math.abs(_q[2]) - hz) <= 1e-4;
  const faces = (onX ? 1 : 0) + (onY ? 1 : 0) + (onZ ? 1 : 0);

  if (faces === 1) {
    let lx = 0;
    let ly = 0;
    let lz = 0;
    if (onX) lx = _q[0] >= 0 ? 1 : -1;
    else if (onY) ly = _q[1] >= 0 ? 1 : -1;
    else lz = _q[2] >= 0 ? 1 : -1;

    q4TransformVec3(_n, rotation, v3Set(_tmp, lx, ly, lz));
    v3Normalize(_n, _n);
    return {
      nx: _n[0],
      ny: _n[1],
      nz: _n[2],
      depth: hit.depth,
    };
  }

  return hit;
};

const contactVsCylinder = (
  capsule: CapsuleY,
  center: Vec3,
  radius: number,
  halfHeight: number,
  rotation: Quat,
): CapsuleContact | null => {
  toLocalSegment(capsule, center, rotation, _la, _lb);

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
      depth: push + capsule.radius,
    };
  }

  worldFromLocal(_segA, _p, center, rotation);
  worldFromLocal(_segB, _q, center, rotation);
  return contactFromPoints(_segA, _segB, capsule.radius, 0);
};

const contactVsCapsuleShape = (
  capsule: CapsuleY,
  center: Vec3,
  radius: number,
  halfHeight: number,
  rotation: Quat,
): CapsuleContact | null => {
  capsuleSegment(capsule, _a, _b);
  v3Set(_segA, 0, -halfHeight, 0);
  v3Set(_segB, 0, halfHeight, 0);
  q4TransformVec3(_la, rotation, _segA);
  q4TransformVec3(_lb, rotation, _segB);
  _la[0] += center[0];
  _la[1] += center[1];
  _la[2] += center[2];
  _lb[0] += center[0];
  _lb[1] += center[1];
  _lb[2] += center[2];
  closestPointsSegments(_p, _q, _a, _b, _la, _lb);
  return contactFromPoints(_p, _q, capsule.radius, radius);
};

const contactVsEllipsoid = (
  capsule: CapsuleY,
  center: Vec3,
  radii: Vec3,
  rotation: Quat,
): CapsuleContact | null => {
  const rx = radii[0];
  const ry = radii[1];
  const rz = radii[2];
  toLocalSegment(capsule, center, rotation, _la, _lb);

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
      depth: surfaceDist + capsule.radius,
    };
  }

  worldFromLocal(_segA, _p, center, rotation);
  worldFromLocal(_segB, _q, center, rotation);
  return contactFromPoints(_segA, _segB, capsule.radius, 0);
};

export const contactCapsuleVsShape = (
  capsule: CapsuleY,
  shape: ColliderShape,
): CapsuleContact | null => {
  if (shape.kind === 'sphere') {
    return contactVsSphere(capsule, shape.center, shape.radius);
  }

  if (shape.kind === 'box') {
    return contactVsBox(capsule, shape.center, shape.halfExtents, shape.rotation);
  }

  if (shape.kind === 'cylinder') {
    return contactVsCylinder(
      capsule,
      shape.center,
      shape.radius,
      shape.halfHeight,
      shape.rotation,
    );
  }

  if (shape.kind === 'capsule') {
    return contactVsCapsuleShape(
      capsule,
      shape.center,
      shape.radius,
      shape.halfHeight,
      shape.rotation,
    );
  }

  return contactVsEllipsoid(capsule, shape.center, shape.radii, shape.rotation);
};

export const contactCapsuleVsCollider = (
  capsule: CapsuleY,
  collider: Collider,
): CapsuleContact | null => contactCapsuleVsShape(capsule, collider.shape);

export const separateCapsuleVsBoxVolume = (
  capsule: CapsuleY,
  center: Vec3,
  halfExtents: Vec3,
  rotation: Quat,
): CapsuleContact | null => {
  const hx = halfExtents[0];
  const hy = halfExtents[1];
  const hz = halfExtents[2];
  const r = capsule.radius;

  toLocalSegment(capsule, center, rotation, _la, _lb);

  const closestOnBox = (out: Vec3, p: Vec3) => {
    clampAabbCentered(out, p, hx, hy, hz);
  };

  refineClosestOutside(_p, _q, _la, _lb, closestOnBox);

  const cx = (_la[0] + _lb[0]) * 0.5;
  const cz = (_la[2] + _lb[2]) * 0.5;
  const footY = Math.min(_la[1], _lb[1]) - r;

  const inside =
    Math.abs(_p[0]) <= hx && Math.abs(_p[1]) <= hy && Math.abs(_p[2]) <= hz;

  const onTopFace =
    _q[1] >= hy - 1e-4 && Math.abs(_q[0]) <= hx + 1e-4 && Math.abs(_q[2]) <= hz + 1e-4;

  if (footY >= hy - 0.04 && Math.abs(cx) <= hx && Math.abs(cz) <= hz) {
    return null;
  }

  let depth = 0;
  let lx = 0;
  let lz = 0;

  if (inside) {
    const dx = hx - Math.abs(_p[0]);
    const dy = hy - Math.abs(_p[1]);
    const dz = hz - Math.abs(_p[2]);
    const lateral = Math.min(dx, dz);
    if (lateral <= 0) return null;
    if (_p[1] > 0 && dy <= lateral && dy < r && lateral > r * 0.75) return null;

    depth = lateral + r;
    if (dx <= dz) lx = _p[0] >= 0 ? 1 : -1;
    else lz = _p[2] >= 0 ? 1 : -1;
  } else {
    if (!onTopFace) return null;
    if (footY >= hy - 0.04) return null;

    worldFromLocal(_segA, _p, center, rotation);
    worldFromLocal(_segB, _q, center, rotation);
    const hit = contactFromPoints(_segA, _segB, r, 0);
    if (!hit || hit.depth <= 0) return null;

    const overlapX = hx + r - Math.abs(cx);
    const overlapZ = hz + r - Math.abs(cz);
    if (overlapX <= 0 && overlapZ <= 0) return null;

    const outsideX = Math.abs(cx) > hx;
    const outsideZ = Math.abs(cz) > hz;

    if (outsideZ && overlapZ > 0 && overlapZ <= overlapX) {
      depth = overlapZ;
      lz = cz >= 0 ? 1 : -1;
    } else if (outsideX && overlapX > 0) {
      depth = overlapX;
      lx = cx >= 0 ? 1 : -1;
    } else if (outsideZ && overlapZ > 0) {
      depth = overlapZ;
      lz = cz >= 0 ? 1 : -1;
    } else {
      return null;
    }
  }

  q4TransformVec3(_n, rotation, v3Set(_tmp, lx, 0, lz));
  v3Normalize(_n, _n);
  return {
    nx: _n[0],
    ny: _n[1],
    nz: _n[2],
    depth,
  };
};

export const contactNormalDot = (contact: CapsuleContact, v: Vec3): number =>
  contact.nx * v[0] + contact.ny * v[1] + contact.nz * v[2];

export const projectOutOfNormal = (v: Vec3, contact: CapsuleContact) => {
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

  if (shape.kind === 'cylinder' || shape.kind === 'capsule') {
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
