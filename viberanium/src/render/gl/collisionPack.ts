export const STATIC_COLLIDER_FLOATS = 20;
export const STATIC_COLLIDER_STRIDE = STATIC_COLLIDER_FLOATS * 4;

export const CHARACTER_STATE_FLOATS = 12;
export const CHARACTER_STATE_STRIDE = CHARACTER_STATE_FLOATS * 4;

export const COLLIDER_KIND_BOX = 0;
export const COLLIDER_KIND_CYLINDER = 1;
export const COLLIDER_KIND_CAPSULE = 2;
export const COLLIDER_KIND_SPHERE = 3;
export const COLLIDER_KIND_ELLIPSOID = 4;

export const GRID_CELL_SIZE = 4;
export const GRID_RES = 64;
export const GRID_ORIGIN = -128;
export const GRID_CELL_COUNT = GRID_RES * GRID_RES;
export const MAX_CANDIDATES = 64;

export type PackedStaticCollider = {
  floats: Float32Array;
};

export const packStaticCollider = (
  out: Float32Array,
  offset: number,
  aabbMin: readonly [number, number, number] | Float32Array,
  aabbMax: readonly [number, number, number] | Float32Array,
  kind: number,
  center: readonly [number, number, number] | Float32Array,
  p0: number,
  p1: number,
  p2: number,
  rot: readonly [number, number, number, number] | Float32Array,
): void => {
  out[offset] = aabbMin[0]!;
  out[offset + 1] = aabbMin[1]!;
  out[offset + 2] = aabbMin[2]!;
  out[offset + 3] = kind;
  out[offset + 4] = aabbMax[0]!;
  out[offset + 5] = aabbMax[1]!;
  out[offset + 6] = aabbMax[2]!;
  out[offset + 7] = 0;
  out[offset + 8] = center[0]!;
  out[offset + 9] = center[1]!;
  out[offset + 10] = center[2]!;
  out[offset + 11] = p0;
  out[offset + 12] = p1;
  out[offset + 13] = p2;
  out[offset + 14] = 0;
  out[offset + 15] = 0;
  out[offset + 16] = rot[0]!;
  out[offset + 17] = rot[1]!;
  out[offset + 18] = rot[2]!;
  out[offset + 19] = rot[3]!;
};

export const writeCharacterState = (
  out: Float32Array,
  offset: number,
  pos: readonly [number, number, number] | Float32Array,
  vel: readonly [number, number, number] | Float32Array,
  radius: number,
  halfHeight: number,
  gravity: number,
  onGround: boolean,
  active: boolean,
): void => {
  out[offset] = pos[0]!;
  out[offset + 1] = pos[1]!;
  out[offset + 2] = pos[2]!;
  out[offset + 3] = vel[1]!;
  out[offset + 4] = vel[0]!;
  out[offset + 5] = vel[2]!;
  out[offset + 6] = radius;
  out[offset + 7] = halfHeight;
  out[offset + 8] = gravity;
  out[offset + 9] = onGround ? 1 : 0;
  out[offset + 10] = active ? 1 : 0;
  out[offset + 11] = 0;
};

export const cellIndexXZ = (x: number, z: number): number => {
  const cx = Math.floor((x - GRID_ORIGIN) / GRID_CELL_SIZE);
  const cz = Math.floor((z - GRID_ORIGIN) / GRID_CELL_SIZE);
  if (cx < 0 || cz < 0 || cx >= GRID_RES || cz >= GRID_RES) return -1;
  return cz * GRID_RES + cx;
};
