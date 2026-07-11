import { type ActorDefinition } from 'viberanium';

export type ActorAiPackage = 'none' | 'testAi';

export type {
  ActorAttachmentDef,
  ActorCharacterDef,
  ActorColliderDef,
  ActorColliderParent,
  ActorColliderShape,
  ActorDefinition,
} from 'viberanium';

export { identityAttachmentLocal, collectUrlsFromActor } from 'viberanium';

export type GameActorDefinition = ActorDefinition & {
  aiPackage: ActorAiPackage;
};
