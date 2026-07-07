import { type EntityId } from '../engine/entity.ts';
import { type Vec3, v3 } from '../math/vec3.ts';

export type Aabb = {
  min: Vec3;
  max: Vec3;
};

export type ObbY = {
  center: Vec3;
  halfExtents: Vec3;
  yaw: number;
};

export type Collider = {
  entityId?: EntityId;
  aabb: Aabb;
  isStatic: boolean;
  obbY?: ObbY;
};

export const aabb = (
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number,
): Aabb => ({ min: v3(minX, minY, minZ), max: v3(maxX, maxY, maxZ) });
