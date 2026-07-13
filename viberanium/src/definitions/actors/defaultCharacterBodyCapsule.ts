import { identityAttachmentLocal, type ActorColliderDef } from './actorDefinition.ts';

export const DEFAULT_CHARACTER_BODY_CAPSULE: ActorColliderDef = {
  id: 'body',
  name: 'body',
  shape: 'capsule',
  radius: 0.39323,
  halfHeight: 0.7024,
  collision: true,
  hitbox: false,
  parent: { kind: 'character' },
  ...identityAttachmentLocal(),
};
