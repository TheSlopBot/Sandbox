import {
  type BoneAttachmentDef,
  type SkeletalCharacterDef,
} from '../characters/skeletalCharacterDef.ts';
import { type ActorAttachmentDef, type ActorDefinition } from './actorDefinition.ts';

const isIdentityPosition = (position: [number, number, number]): boolean =>
  position[0] === 0 && position[1] === 0 && position[2] === 0;

const isIdentityRotation = (rotation: [number, number, number, number]): boolean =>
  rotation[0] === 0 && rotation[1] === 0 && rotation[2] === 0 && rotation[3] === 1;

const isIdentityScale = (scale: [number, number, number]): boolean =>
  scale[0] === 1 && scale[1] === 1 && scale[2] === 1;

const attachmentToBoneDef = (attachment: ActorAttachmentDef): BoneAttachmentDef => {
  const def: BoneAttachmentDef = {
    id: attachment.id,
    gltfUrl: attachment.url,
    materialPrefix: attachment.materialPrefix,
    boneName: attachment.boneName,
    spawnEquipped: true,
  };

  if (!isIdentityPosition(attachment.position)) def.offsetT = attachment.position;

  if (!isIdentityRotation(attachment.rotation)) def.offsetR = attachment.rotation;

  if (!isIdentityScale(attachment.scale)) def.offsetS = attachment.scale;

  return def;
};

export const actorDefinitionToSkeletalDef = (actor: ActorDefinition): SkeletalCharacterDef => {
  const attachments = actor.attachments
    .filter((attachment) => !attachment.placeholder)
    .map(attachmentToBoneDef);

  return {
    bodyGlb: actor.character.url,
    materialPrefix: actor.character.materialPrefix,
    animPack: actor.animPack,
    clips: actor.clips,
    ...(actor.baseColorTextureUrl
      ? { baseColorTextureUrl: actor.baseColorTextureUrl }
      : actor.character.textureVariantUrl
        ? { baseColorTextureUrl: actor.character.textureVariantUrl }
        : {}),
    ...(actor.visualYOffset !== undefined ? { visualYOffset: actor.visualYOffset } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
  };
};
