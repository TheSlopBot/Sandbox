import {
  identityAttachmentLocal,
  type ActorAttachmentDef,
  type ActorDefinition,
} from './actorDefinition.ts';
import { DEFAULT_CHARACTER_BODY_CAPSULE } from './defaultCharacterBodyCapsule.ts';

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
  attachments?: SimpleActorAttachment[];
  textureVariantUrl?: string | null;
  baseColorTextureUrl?: string;
  visualYOffset?: number;
  animPack: ActorDefinition['animPack'];
  clips: ActorDefinition['clips'];
  colliders?: ActorDefinition['colliders'];
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
  opts: BuildSimpleActorOpts,
): ActorDefinition => ({
  id,
  displayName,
  tags: opts.tags ?? [],
  character: {
    url: bodyGlb,
    materialPrefix,
    textureVariantUrl: opts.textureVariantUrl,
  },
  attachments: (opts.attachments ?? []).map(buildAttachment),
  colliders: opts.colliders ?? [{ ...DEFAULT_CHARACTER_BODY_CAPSULE }],
  animPack: opts.animPack,
  clips: opts.clips,
  ...(opts.baseColorTextureUrl ? { baseColorTextureUrl: opts.baseColorTextureUrl } : {}),
  ...(opts.visualYOffset !== undefined ? { visualYOffset: opts.visualYOffset } : {}),
});
