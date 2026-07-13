import { identityAttachmentLocal, type ActorColliderDef } from './actorDefinition.ts';

export const DEFAULT_CHARACTER_BODY_CYLINDER: ActorColliderDef = {
  id: 'body',
  name: 'body',
  shape: 'cylinder',
  radius: 0.39323,
  halfHeight: 1.09563,
  collision: true,
  hitbox: false,
  parent: { kind: 'character' },
  ...identityAttachmentLocal(),
};
