import { type Vec3, v3 } from '../math/vec3.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Collider } from './collider.ts';

export type CharacterController = {
  velocity: Vec3;
  moveSpeed: number;
  jumpSpeed: number;
  gravity: number;
  onGround: boolean;
  sliding: boolean;
  slideSpeed: number;
  slideIgnoreInputRemaining: number;
  groundNormal: Vec3;
  floorMaxAngle: number;
  obstructiveColliderKeys: readonly string[];
  wasOnGroundPrevious: boolean;
  coyoteRemaining: number;
  jumpBufferRemaining: number;
};

export type CharacterBodyCylinder = {
  radius: number;
  halfHeight: number;
};

export const createCharacterController = (): CharacterController => ({
  velocity: v3(),
  moveSpeed: 5.2,
  jumpSpeed: 10.0,
  gravity: 24.0,
  onGround: false,
  sliding: false,
  slideSpeed: 0,
  slideIgnoreInputRemaining: 0,
  groundNormal: v3(0, 1, 0),
  floorMaxAngle: (50 * Math.PI) / 180,
  obstructiveColliderKeys: [COMPONENT_KEYS.collider],
  wasOnGroundPrevious: false,
  coyoteRemaining: 0,
  jumpBufferRemaining: 0,
});

export const characterFootOffset = (body: CharacterBodyCylinder): number => body.halfHeight;

export const characterHeadOffset = (body: CharacterBodyCylinder): number => body.halfHeight;

export const readCharacterBodyCylinder = (
  collider: Collider | undefined,
): CharacterBodyCylinder | null => {
  const shape = collider?.localShape ?? collider?.shape;
  if (!shape || shape.kind !== 'cylinder') return null;
  if (!(shape.radius > 0) || !(shape.halfHeight > 0)) return null;

  return {
    radius: shape.radius,
    halfHeight: shape.halfHeight,
  };
};

export const characterBodyToSolver = (
  body: CharacterBodyCylinder,
): { radius: number; halfHeight: number } => ({
  radius: body.radius,
  halfHeight: Math.max(1e-4, body.halfHeight - body.radius),
});
