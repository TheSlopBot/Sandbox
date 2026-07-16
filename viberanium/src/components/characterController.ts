import { type Vec3, v3 } from '../math/vec3.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';

export type CharacterController = {
  velocity: Vec3;
  moveSpeed: number;
  jumpSpeed: number;
  gravity: number;
  onGround: boolean;
  sliding: boolean;
  slideSpeed: number;
  groundNormal: Vec3;
  floorMaxAngle: number;
  obstructiveColliderKeys: readonly string[];
  coyoteRemaining: number;
  jumpBufferRemaining: number;
};

export type CharacterBodyCylinder = {
  radius: number;
  halfHeight: number;
  centerX: number;
  centerY: number;
  centerZ: number;
};

export const createCharacterController = (): CharacterController => ({
  velocity: v3(),
  moveSpeed: 5.2,
  jumpSpeed: 10.0,
  gravity: 24.0,
  onGround: false,
  sliding: false,
  slideSpeed: 0,
  groundNormal: v3(0, 1, 0),
  floorMaxAngle: (50 * Math.PI) / 180,
  obstructiveColliderKeys: [COMPONENT_KEYS.collider],
  coyoteRemaining: 0,
  jumpBufferRemaining: 0,
});

export const characterBodyToSolver = (
  body: CharacterBodyCylinder,
): { radius: number; halfHeight: number } => ({
  radius: body.radius,
  halfHeight: Math.max(1e-4, body.halfHeight - body.radius),
});
