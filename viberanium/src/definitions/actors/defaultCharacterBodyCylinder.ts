import { identityAttachmentLocal, type ActorColliderDef } from './actorDefinition.ts';

export const DEFAULT_CHARACTER_BODY_CYLINDER: ActorColliderDef = {
  id: 'body',
  name: 'body',
  shape: 'cylinder',
  radius: 0.39323,
  halfHeight: 1.09563,
  collision: true,
  hitbox: false,
  parent: { kind: 'bone', boneName: 'spine' },
  ...identityAttachmentLocal(),
};

export const DEFAULT_CHARACTER_HURTBOX: ActorColliderDef = {
  id: 'hurtbox',
  name: 'Hurtbox',
  shape: 'box',
  halfExtents: [0.35, 0.9, 0.35],
  collision: false,
  hitbox: true,
  parent: { kind: 'bone', boneName: 'spine' },
  position: [0, 1, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};
