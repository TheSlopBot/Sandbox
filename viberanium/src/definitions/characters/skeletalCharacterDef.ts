export type AnimClipRef = string;

export type BoneAttachmentDef = {
  id: string;
  gltfUrl: string;
  materialPrefix: string;
  boneName: string;
  offsetT?: [number, number, number];
  offsetR?: [number, number, number, number];
  offsetS?: [number, number, number];
  spawnEquipped?: boolean;
};

export type SkeletalCharacterDef = {
  bodyGlb: string;
  materialPrefix: string;
  baseColorTextureUrl?: string;
  visualYOffset?: number;
  animPack: {
    generalGlb: string;
    movementGlb: string;
    movementAdvancedGlb?: string;
  };
  clips: {
    idle: AnimClipRef;
    run: AnimClipRef;
    walkBack?: AnimClipRef;
    jumpStart: AnimClipRef;
    jumpIdle: AnimClipRef;
    jumpLand: AnimClipRef;
    hit: AnimClipRef;
    death: AnimClipRef;
    deathPose: AnimClipRef;
  };
  attachments?: BoneAttachmentDef[];
};

export type SkeletalCharacterClipNames = keyof SkeletalCharacterDef['clips'];

export const collectUrlsFromDef = (def: SkeletalCharacterDef): string[] => {
  const urls = new Set<string>([
    def.bodyGlb,
    def.animPack.generalGlb,
    def.animPack.movementGlb,
  ]);

  if (def.animPack.movementAdvancedGlb) urls.add(def.animPack.movementAdvancedGlb);

  for (const attachment of def.attachments ?? []) urls.add(attachment.gltfUrl);

  return [...urls];
};
