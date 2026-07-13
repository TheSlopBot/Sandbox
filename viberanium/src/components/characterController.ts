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

export type CharacterBodyCapsule = {
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

export const characterFootOffset = (body: CharacterBodyCapsule): number =>
  body.halfHeight + body.radius;

export const characterHeadOffset = (body: CharacterBodyCapsule): number =>
  body.halfHeight + body.radius;

export const readCharacterBodyCapsule = (
  collider: Collider | undefined,
): CharacterBodyCapsule | null => {
  const shape = collider?.localShape ?? collider?.shape;
  if (!shape || shape.kind !== 'capsule') return null;
  if (!(shape.radius > 0) || !(shape.halfHeight > 0)) return null;

  return { radius: shape.radius, halfHeight: shape.halfHeight };
};
