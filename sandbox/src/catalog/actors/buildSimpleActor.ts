import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from '../animations/kaykitMedium.ts';
import {
  identityAttachmentLocal,
  type ActorAiPackage,
  type ActorAttachmentDef,
  type ActorDefinition,
} from './actorDefinition.ts';

export type SimpleActorAttachment = {
  id: string;
  name: string;
  boneName: string;
  url: string;
  materialPrefix: string;
  textureVariantUrl?: string | null;
  tags?: string[];
  placeholder?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
};

export type BuildSimpleActorOpts = {
  tags?: string[];
  aiPackage?: ActorAiPackage;
  attachments?: SimpleActorAttachment[];
  textureVariantUrl?: string | null;
  baseColorTextureUrl?: string;
  visualYOffset?: number;
  animPack?: ActorDefinition['animPack'];
  clips?: ActorDefinition['clips'];
};

const buildAttachment = (partial: SimpleActorAttachment): ActorAttachmentDef => ({
  ...identityAttachmentLocal(),
  id: partial.id,
  name: partial.name,
  boneName: partial.boneName,
  url: partial.url,
  materialPrefix: partial.materialPrefix,
  textureVariantUrl: partial.textureVariantUrl,
  tags: partial.tags ?? [],
  placeholder: partial.placeholder ?? false,
  ...(partial.position ? { position: partial.position } : {}),
  ...(partial.rotation ? { rotation: partial.rotation } : {}),
  ...(partial.scale ? { scale: partial.scale } : {}),
});

export const buildSimpleActor = (
  id: string,
  displayName: string,
  bodyGlb: string,
  materialPrefix: string,
  opts: BuildSimpleActorOpts = {},
): ActorDefinition => ({
  id,
  displayName,
  tags: opts.tags ?? [],
  aiPackage: opts.aiPackage ?? 'none',
  character: {
    url: bodyGlb,
    materialPrefix,
    textureVariantUrl: opts.textureVariantUrl,
  },
  attachments: (opts.attachments ?? []).map(buildAttachment),
  animPack: opts.animPack ?? KAYKIT_MEDIUM_ANIM_PACK,
  clips: opts.clips ?? KAYKIT_MEDIUM_CLIPS,
  ...(opts.baseColorTextureUrl ? { baseColorTextureUrl: opts.baseColorTextureUrl } : {}),
  ...(opts.visualYOffset !== undefined ? { visualYOffset: opts.visualYOffset } : {}),
});
