export type ActorAttachmentDef = {
  id: string;
  name: string;
  boneName: string;
  url: string;
  materialPrefix: string;
  textureVariantUrl?: string | null;
  tags: string[];
  placeholder: boolean;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type ActorCharacterDef = {
  url: string;
  materialPrefix: string;
  textureVariantUrl?: string | null;
};

export type ActorColliderShape = 'box' | 'cylinder' | 'sphere' | 'capsule';

export type ActorColliderParent =
  | { kind: 'bone'; boneName: string }
  | { kind: 'attachment'; attachmentId: string };

export type ActorColliderDef = {
  id: string;
  name: string;
  shape: ActorColliderShape;
  halfExtents?: [number, number, number];
  radius?: number;
  halfHeight?: number;
  collision: boolean;
  hitbox: boolean;
  parent: ActorColliderParent;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type ActorDefinition = {
  id: string;
  displayName: string;
  tags: string[];
  character: ActorCharacterDef;
  attachments: ActorAttachmentDef[];
  colliders: ActorColliderDef[];
  animPack: { generalGlb: string; movementGlb: string };
  clips: {
    idle: string;
    run: string;
    jumpStart: string;
    jumpIdle: string;
    jumpLand: string;
  };
  baseColorTextureUrl?: string;
  visualYOffset?: number;
};

export const identityAttachmentLocal = (): Pick<
  ActorAttachmentDef,
  'position' | 'rotation' | 'scale'
> => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

const isGltfUrl = (url: string) => {
  const lower = url.toLowerCase();
  return lower.endsWith('.gltf') || lower.endsWith('.glb');
};

export const collectUrlsFromActor = (actor: ActorDefinition): string[] => {
  const urls = new Set<string>([
    actor.character.url,
    actor.animPack.generalGlb,
    actor.animPack.movementGlb,
  ]);

  for (const attachment of actor.attachments) {
    if (!attachment.placeholder) urls.add(attachment.url);
  }

  return [...urls].filter(isGltfUrl);
};
