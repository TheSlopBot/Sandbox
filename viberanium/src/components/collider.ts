import { type EntityId } from '../engine/entity.ts';
import { type Vec3, v3, v3Copy } from '../math/vec3.ts';
import { type Quat, q4, q4Copy, q4TransformVec3 } from '../math/quat.ts';
import { type Mat4 } from '../math/mat4.ts';

export type Aabb = {
  min: Vec3;
  max: Vec3;
};

export type ColliderShape =
  | { kind: 'box'; center: Vec3; halfExtents: Vec3; rotation: Quat }
  | { kind: 'cylinder'; center: Vec3; radius: number; halfHeight: number; rotation: Quat }
  | { kind: 'capsule'; center: Vec3; radius: number; halfHeight: number; rotation: Quat }
  | { kind: 'sphere'; center: Vec3; radius: number }
  | { kind: 'ellipsoid'; center: Vec3; radii: Vec3; rotation: Quat };

export type Collider = {
  entityId?: EntityId;
  aabb: Aabb;
  isStatic: boolean;
  shape: ColliderShape;
  localShape?: ColliderShape;
};

export const aabb = (
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number,
): Aabb => ({ min: v3(minX, minY, minZ), max: v3(maxX, maxY, maxZ) });

const _corner = v3();
const _rotated = v3();

const expandAabbPoint = (out: Aabb, x: number, y: number, z: number) => {
  if (x < out.min[0]) out.min[0] = x;
  if (y < out.min[1]) out.min[1] = y;
  if (z < out.min[2]) out.min[2] = z;
  if (x > out.max[0]) out.max[0] = x;
  if (y > out.max[1]) out.max[1] = y;
  if (z > out.max[2]) out.max[2] = z;
};

const resetAabb = (out: Aabb, x: number, y: number, z: number) => {
  out.min[0] = x;
  out.min[1] = y;
  out.min[2] = z;
  out.max[0] = x;
  out.max[1] = y;
  out.max[2] = z;
};

export const updateColliderAabbFromShape = (collider: Collider): void => {
  const shape = collider.shape;
  const out = collider.aabb;

  if (shape.kind === 'sphere') {
    const r = shape.radius;
    const c = shape.center;
    out.min[0] = c[0] - r;
    out.min[1] = c[1] - r;
    out.min[2] = c[2] - r;
    out.max[0] = c[0] + r;
    out.max[1] = c[1] + r;
    out.max[2] = c[2] + r;
    return;
  }

  if (shape.kind === 'box') {
    const hx = shape.halfExtents[0];
    const hy = shape.halfExtents[1];
    const hz = shape.halfExtents[2];
    let first = true;
    for (let ix = -1; ix <= 1; ix += 2) {
      for (let iy = -1; iy <= 1; iy += 2) {
        for (let iz = -1; iz <= 1; iz += 2) {
          _corner[0] = ix * hx;
          _corner[1] = iy * hy;
          _corner[2] = iz * hz;
          q4TransformVec3(_rotated, shape.rotation, _corner);
          const x = shape.center[0] + _rotated[0];
          const y = shape.center[1] + _rotated[1];
          const z = shape.center[2] + _rotated[2];
          if (first) {
            resetAabb(out, x, y, z);
            first = false;
          } else {
            expandAabbPoint(out, x, y, z);
          }
        }
      }
    }
    return;
  }

  if (shape.kind === 'ellipsoid') {
    const rx = shape.radii[0];
    const ry = shape.radii[1];
    const rz = shape.radii[2];
    let first = true;
    for (let ix = -1; ix <= 1; ix += 2) {
      for (let iy = -1; iy <= 1; iy += 2) {
        for (let iz = -1; iz <= 1; iz += 2) {
          _corner[0] = ix * rx;
          _corner[1] = iy * ry;
          _corner[2] = iz * rz;
          q4TransformVec3(_rotated, shape.rotation, _corner);
          const x = shape.center[0] + _rotated[0];
          const y = shape.center[1] + _rotated[1];
          const z = shape.center[2] + _rotated[2];
          if (first) {
            resetAabb(out, x, y, z);
            first = false;
          } else {
            expandAabbPoint(out, x, y, z);
          }
        }
      }
    }
    return;
  }

  const axis = v3(0, 1, 0);
  q4TransformVec3(_rotated, shape.rotation, axis);
  const ax = Math.abs(_rotated[0]);
  const ay = Math.abs(_rotated[1]);
  const az = Math.abs(_rotated[2]);
  const r = shape.radius;
  const hh = shape.kind === 'capsule' ? shape.halfHeight + shape.radius : shape.halfHeight;
  const ex = hh * ax + r * Math.sqrt(Math.max(0, 1 - ax * ax));
  const ey = hh * ay + r * Math.sqrt(Math.max(0, 1 - ay * ay));
  const ez = hh * az + r * Math.sqrt(Math.max(0, 1 - az * az));
  out.min[0] = shape.center[0] - ex;
  out.min[1] = shape.center[1] - ey;
  out.min[2] = shape.center[2] - ez;
  out.max[0] = shape.center[0] + ex;
  out.max[1] = shape.center[1] + ey;
  out.max[2] = shape.center[2] + ez;
};

const cloneShape = (shape: ColliderShape): ColliderShape => {
  if (shape.kind === 'box') {
    return {
      kind: 'box',
      center: v3(shape.center[0], shape.center[1], shape.center[2]),
      halfExtents: v3(shape.halfExtents[0], shape.halfExtents[1], shape.halfExtents[2]),
      rotation: q4(shape.rotation[0], shape.rotation[1], shape.rotation[2], shape.rotation[3]),
    };
  }

  if (shape.kind === 'cylinder') {
    return {
      kind: 'cylinder',
      center: v3(shape.center[0], shape.center[1], shape.center[2]),
      radius: shape.radius,
      halfHeight: shape.halfHeight,
      rotation: q4(shape.rotation[0], shape.rotation[1], shape.rotation[2], shape.rotation[3]),
    };
  }

  if (shape.kind === 'capsule') {
    return {
      kind: 'capsule',
      center: v3(shape.center[0], shape.center[1], shape.center[2]),
      radius: shape.radius,
      halfHeight: shape.halfHeight,
      rotation: q4(shape.rotation[0], shape.rotation[1], shape.rotation[2], shape.rotation[3]),
    };
  }

  if (shape.kind === 'sphere') {
    return {
      kind: 'sphere',
      center: v3(shape.center[0], shape.center[1], shape.center[2]),
      radius: shape.radius,
    };
  }

  return {
    kind: 'ellipsoid',
    center: v3(shape.center[0], shape.center[1], shape.center[2]),
    radii: v3(shape.radii[0], shape.radii[1], shape.radii[2]),
    rotation: q4(shape.rotation[0], shape.rotation[1], shape.rotation[2], shape.rotation[3]),
  };
};

const transformPointByMat4 = (out: Vec3, m: Mat4, x: number, y: number, z: number) => {
  out[0] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  out[1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  out[2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
};

const rotationFromMat4 = (out: Quat, m: Mat4) => {
  const m00 = m[0]!, m01 = m[4]!, m02 = m[8]!;
  const m10 = m[1]!, m11 = m[5]!, m12 = m[9]!;
  const m20 = m[2]!, m21 = m[6]!, m22 = m[10]!;
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    out[3] = 0.25 * s;
    out[0] = (m21 - m12) / s;
    out[1] = (m02 - m20) / s;
    out[2] = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    out[3] = (m21 - m12) / s;
    out[0] = 0.25 * s;
    out[1] = (m01 + m10) / s;
    out[2] = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    out[3] = (m02 - m20) / s;
    out[0] = (m01 + m10) / s;
    out[1] = 0.25 * s;
    out[2] = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    out[3] = (m10 - m01) / s;
    out[0] = (m02 + m20) / s;
    out[1] = (m12 + m21) / s;
    out[2] = 0.25 * s;
  }
};

export const bakeColliderWorldFromLocal = (collider: Collider, world: Mat4): void => {
  const local = collider.localShape ?? collider.shape;
  const worldShape = cloneShape(local);

  transformPointByMat4(
    worldShape.center,
    world,
    local.center[0],
    local.center[1],
    local.center[2],
  );

  if (
    worldShape.kind === 'box' ||
    worldShape.kind === 'cylinder' ||
    worldShape.kind === 'capsule' ||
    worldShape.kind === 'ellipsoid'
  ) {
    const localRot = local.kind === 'sphere' ? q4() : local.rotation;
    const worldRot = q4();
    rotationFromMat4(worldRot, world);
    const qx = worldRot[0], qy = worldRot[1], qz = worldRot[2], qw = worldRot[3];
    const lx = localRot[0], ly = localRot[1], lz = localRot[2], lw = localRot[3];
    worldShape.rotation[0] = qw * lx + qx * lw + qy * lz - qz * ly;
    worldShape.rotation[1] = qw * ly - qx * lz + qy * lw + qz * lx;
    worldShape.rotation[2] = qw * lz + qx * ly - qy * lx + qz * lw;
    worldShape.rotation[3] = qw * lw - qx * lx - qy * ly - qz * lz;
  }

  if (worldShape.kind === 'box') {
    const sx = Math.hypot(world[0]!, world[1]!, world[2]!);
    const sy = Math.hypot(world[4]!, world[5]!, world[6]!);
    const sz = Math.hypot(world[8]!, world[9]!, world[10]!);
    worldShape.halfExtents[0] = local.kind === 'box' ? local.halfExtents[0] * sx : worldShape.halfExtents[0];
    worldShape.halfExtents[1] = local.kind === 'box' ? local.halfExtents[1] * sy : worldShape.halfExtents[1];
    worldShape.halfExtents[2] = local.kind === 'box' ? local.halfExtents[2] * sz : worldShape.halfExtents[2];
  }

  if (
    (worldShape.kind === 'cylinder' && local.kind === 'cylinder') ||
    (worldShape.kind === 'capsule' && local.kind === 'capsule')
  ) {
    const sx = Math.hypot(world[0]!, world[1]!, world[2]!);
    const sy = Math.hypot(world[4]!, world[5]!, world[6]!);
    worldShape.radius = local.radius * sx;
    worldShape.halfHeight = local.halfHeight * sy;
  }

  if (worldShape.kind === 'sphere' && local.kind === 'sphere') {
    const sx = Math.hypot(world[0]!, world[1]!, world[2]!);
    const sy = Math.hypot(world[4]!, world[5]!, world[6]!);
    const sz = Math.hypot(world[8]!, world[9]!, world[10]!);
    const uniform = Math.abs(sx - sy) < 1e-4 && Math.abs(sy - sz) < 1e-4;
    if (!uniform) {
      collider.shape = {
        kind: 'ellipsoid',
        center: worldShape.center,
        radii: v3(local.radius * sx, local.radius * sy, local.radius * sz),
        rotation: q4(),
      };
      rotationFromMat4(collider.shape.rotation, world);
      updateColliderAabbFromShape(collider);
      return;
    }
    worldShape.radius = local.radius * sx;
  }

  if (worldShape.kind === 'ellipsoid' && local.kind === 'ellipsoid') {
    const sx = Math.hypot(world[0]!, world[1]!, world[2]!);
    const sy = Math.hypot(world[4]!, world[5]!, world[6]!);
    const sz = Math.hypot(world[8]!, world[9]!, world[10]!);
    worldShape.radii[0] = local.radii[0] * sx;
    worldShape.radii[1] = local.radii[1] * sy;
    worldShape.radii[2] = local.radii[2] * sz;
  }

  collider.shape = worldShape;
  updateColliderAabbFromShape(collider);
};

export const createBoxCollider = (opts: {
  center?: Vec3;
  halfExtents: Vec3;
  rotation?: Quat;
  isStatic?: boolean;
}): Collider => {
  const shape: ColliderShape = {
    kind: 'box',
    center: opts.center ? v3(opts.center[0], opts.center[1], opts.center[2]) : v3(),
    halfExtents: v3(opts.halfExtents[0], opts.halfExtents[1], opts.halfExtents[2]),
    rotation: opts.rotation
      ? q4(opts.rotation[0], opts.rotation[1], opts.rotation[2], opts.rotation[3])
      : q4(),
  };
  const collider: Collider = {
    aabb: aabb(0, 0, 0, 0, 0, 0),
    isStatic: opts.isStatic ?? true,
    shape,
    localShape: cloneShape(shape),
  };
  updateColliderAabbFromShape(collider);
  return collider;
};

export const createCylinderCollider = (opts: {
  center?: Vec3;
  radius: number;
  halfHeight: number;
  rotation?: Quat;
  isStatic?: boolean;
}): Collider => {
  const shape: ColliderShape = {
    kind: 'cylinder',
    center: opts.center ? v3(opts.center[0], opts.center[1], opts.center[2]) : v3(),
    radius: opts.radius,
    halfHeight: opts.halfHeight,
    rotation: opts.rotation
      ? q4(opts.rotation[0], opts.rotation[1], opts.rotation[2], opts.rotation[3])
      : q4(),
  };
  const collider: Collider = {
    aabb: aabb(0, 0, 0, 0, 0, 0),
    isStatic: opts.isStatic ?? true,
    shape,
    localShape: cloneShape(shape),
  };
  updateColliderAabbFromShape(collider);
  return collider;
};

export const createCapsuleCollider = (opts: {
  center?: Vec3;
  radius: number;
  halfHeight: number;
  rotation?: Quat;
  isStatic?: boolean;
}): Collider => {
  const shape: ColliderShape = {
    kind: 'capsule',
    center: opts.center ? v3(opts.center[0], opts.center[1], opts.center[2]) : v3(),
    radius: opts.radius,
    halfHeight: opts.halfHeight,
    rotation: opts.rotation
      ? q4(opts.rotation[0], opts.rotation[1], opts.rotation[2], opts.rotation[3])
      : q4(),
  };
  const collider: Collider = {
    aabb: aabb(0, 0, 0, 0, 0, 0),
    isStatic: opts.isStatic ?? true,
    shape,
    localShape: cloneShape(shape),
  };
  updateColliderAabbFromShape(collider);
  return collider;
};

export const createSphereCollider = (opts: {
  center?: Vec3;
  radius: number;
  isStatic?: boolean;
}): Collider => {
  const shape: ColliderShape = {
    kind: 'sphere',
    center: opts.center ? v3(opts.center[0], opts.center[1], opts.center[2]) : v3(),
    radius: opts.radius,
  };
  const collider: Collider = {
    aabb: aabb(0, 0, 0, 0, 0, 0),
    isStatic: opts.isStatic ?? true,
    shape,
    localShape: cloneShape(shape),
  };
  updateColliderAabbFromShape(collider);
  return collider;
};

export const createEllipsoidCollider = (opts: {
  center?: Vec3;
  radii: Vec3;
  rotation?: Quat;
  isStatic?: boolean;
}): Collider => {
  const shape: ColliderShape = {
    kind: 'ellipsoid',
    center: opts.center ? v3(opts.center[0], opts.center[1], opts.center[2]) : v3(),
    radii: v3(opts.radii[0], opts.radii[1], opts.radii[2]),
    rotation: opts.rotation
      ? q4(opts.rotation[0], opts.rotation[1], opts.rotation[2], opts.rotation[3])
      : q4(),
  };
  const collider: Collider = {
    aabb: aabb(0, 0, 0, 0, 0, 0),
    isStatic: opts.isStatic ?? true,
    shape,
    localShape: cloneShape(shape),
  };
  updateColliderAabbFromShape(collider);
  return collider;
};

export const copyColliderShape = (dst: ColliderShape, src: ColliderShape): void => {
  v3Copy(dst.center, src.center);
  if (dst.kind === 'box' && src.kind === 'box') {
    v3Copy(dst.halfExtents, src.halfExtents);
    q4Copy(dst.rotation, src.rotation);
  } else if (dst.kind === 'cylinder' && src.kind === 'cylinder') {
    dst.radius = src.radius;
    dst.halfHeight = src.halfHeight;
    q4Copy(dst.rotation, src.rotation);
  } else if (dst.kind === 'capsule' && src.kind === 'capsule') {
    dst.radius = src.radius;
    dst.halfHeight = src.halfHeight;
    q4Copy(dst.rotation, src.rotation);
  } else if (dst.kind === 'sphere' && src.kind === 'sphere') {
    dst.radius = src.radius;
  } else if (dst.kind === 'ellipsoid' && src.kind === 'ellipsoid') {
    v3Copy(dst.radii, src.radii);
    q4Copy(dst.rotation, src.rotation);
  }
};
