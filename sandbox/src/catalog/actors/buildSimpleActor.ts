import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from '../animations/kaykitMedium.ts';
import {
  buildSimpleActor as buildPortableSimpleActor,
  type ActorAttachmentDef,
  type SimpleActorAttachment,
} from 'viberanium';
import { type ActorAiPackage, type GameActorDefinition } from './actorDefinition.ts';

export type { SimpleActorAttachment };

export type BuildSimpleActorOpts = {
  tags?: string[];
  aiPackage?: ActorAiPackage;
  attachments?: SimpleActorAttachment[];
  textureVariantUrl?: string | null;
  baseColorTextureUrl?: string;
  visualYOffset?: number;
  animPack?: GameActorDefinition['animPack'];
  clips?: GameActorDefinition['clips'];
  colliders?: GameActorDefinition['colliders'];
};

export const buildSimpleActor = (
  id: string,
  displayName: string,
  bodyGlb: string,
  materialPrefix: string,
  opts: BuildSimpleActorOpts = {},
): GameActorDefinition => ({
  ...buildPortableSimpleActor(id, displayName, bodyGlb, materialPrefix, {
    tags: opts.tags,
    attachments: opts.attachments,
    textureVariantUrl: opts.textureVariantUrl,
    baseColorTextureUrl: opts.baseColorTextureUrl,
    visualYOffset: opts.visualYOffset,
    animPack: opts.animPack ?? KAYKIT_MEDIUM_ANIM_PACK,
    clips: opts.clips ?? KAYKIT_MEDIUM_CLIPS,
    colliders: opts.colliders,
  }),
  aiPackage: opts.aiPackage ?? 'none',
});

export type { ActorAttachmentDef };
