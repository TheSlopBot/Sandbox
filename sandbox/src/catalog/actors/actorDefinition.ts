export type ActorAiPackage = 'none' | 'testAi';

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

export type ActorDefinition = {
  id: string;
  displayName: string;
  tags: string[];
  aiPackage: ActorAiPackage;
  character: ActorCharacterDef;
  attachments: ActorAttachmentDef[];
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
