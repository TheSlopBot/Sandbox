import { type Vec3, v3 } from '../../math/vec3.ts';

export type Aabb = {
  min: Vec3;
  max: Vec3;
};

export type ObbY = {
  center: Vec3;
  halfExtents: Vec3; // half sizes along local X/Y/Z
  yaw: number; // rotation about Y axis in radians
};

export type Collider = {
  aabb: Aabb;
  isStatic: boolean;
  // Optional rotated box (yaw about Y). If present, collision should prefer this over the AABB.
  obbY?: ObbY;
};

export function aabb(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): Aabb {
  return { min: v3(minX, minY, minZ), max: v3(maxX, maxY, maxZ) };
}

