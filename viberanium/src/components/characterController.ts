import { type Vec3, v3 } from '../math/vec3.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';

export type JumpPhase = 'none' | 'start' | 'air' | 'land';

export type CharacterController = {
  velocity: Vec3;
  moveSpeed: number;
  jumpSpeed: number;
  gravity: number;
  onGround: boolean;
  halfExtents: Vec3;
  jumpPhase: JumpPhase;
  jumpClipTime: number;
  jumpStartDuration: number;
  jumpLandDuration: number;
  jumpStartSpeed: number;
  jumpLandSpeed: number;
  movementAnimTime: number;
  moveAnimSpeed: number;
  movementBlend: number;
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
  jumpPhase: 'none',
  jumpClipTime: 0,
  jumpStartDuration: 0.3,
  jumpLandDuration: 0.3,
  jumpStartSpeed: 4,
  jumpLandSpeed: 2,
  movementAnimTime: 0,
  moveAnimSpeed: 1.5,
  movementBlend: 1,
  obstructiveColliderKeys: [COMPONENT_KEYS.collider],
  wasOnGroundPrevious: false,
});
