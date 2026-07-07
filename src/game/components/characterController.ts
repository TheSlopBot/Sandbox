import { type Vec3, v3 } from '../../math/vec3.ts';

export type JumpPhase = 'none' | 'start' | 'air' | 'land';

export type CharacterController = {
  velocity: Vec3;
  moveSpeed: number;
  jumpSpeed: number;
  gravity: number;
  onGround: boolean;
  halfExtents: Vec3; // AABB half-size
  jumpPhase: JumpPhase;
  jumpAnimTime: number;
  jumpStartDuration: number;
  jumpLandDuration: number;
  jumpStartSpeed: number;
  jumpLandSpeed: number;
  moveAnimSpeed: number;
  locomotionBlend: number; // 0 = jump anim only, 1 = full idle/move blend
};

export function createCharacterController(): CharacterController {
  return {
    velocity: v3(),
    moveSpeed: 5.2,
    jumpSpeed: 10.0,
    gravity: 24.0,
    onGround: false,
    halfExtents: v3(0.28, 0.55, 0.28),
    jumpPhase: 'none',
    jumpAnimTime: 0,
    jumpStartDuration: 0.3,
    jumpLandDuration: 0.3,
    jumpStartSpeed: 4,
    jumpLandSpeed: 2,
    moveAnimSpeed: 1.5,
    locomotionBlend: 1,
  };
}
