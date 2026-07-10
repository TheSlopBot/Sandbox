import { type Vec3, v3 } from '../math/vec3.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';

export type CharacterController = {
  velocity: Vec3;
  moveSpeed: number;
  jumpSpeed: number;
  gravity: number;
  onGround: boolean;
  radius: number;
  halfHeight: number;
  obstructiveColliderKeys: readonly string[];
  wasOnGroundPrevious: boolean;
};

export const createCharacterController = (): CharacterController => ({
  velocity: v3(),
  moveSpeed: 5.2,
  jumpSpeed: 10.0,
  gravity: 24.0,
  onGround: false,
  radius: 0.28,
  halfHeight: 0.27,
  obstructiveColliderKeys: [COMPONENT_KEYS.collider],
  wasOnGroundPrevious: false,
});

export const characterFootOffset = (cc: CharacterController): number =>
  cc.halfHeight + cc.radius;

export const characterHeadOffset = (cc: CharacterController): number =>
  cc.halfHeight + cc.radius;
