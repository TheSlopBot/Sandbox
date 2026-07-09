import { type Vec3, v3 } from '../math/vec3.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';

export type CharacterController = {
  velocity: Vec3;
  moveSpeed: number;
  jumpSpeed: number;
  gravity: number;
  onGround: boolean;
  halfExtents: Vec3;
  obstructiveColliderKeys: readonly string[];
  wasOnGroundPrevious: boolean;
};

export const createCharacterController = (): CharacterController => ({
  velocity: v3(),
  moveSpeed: 5.2,
  jumpSpeed: 10.0,
  gravity: 24.0,
  onGround: false,
  halfExtents: v3(0.28, 0.55, 0.28),
  obstructiveColliderKeys: [COMPONENT_KEYS.collider],
  wasOnGroundPrevious: false,
});
