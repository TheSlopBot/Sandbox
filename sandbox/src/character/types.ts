import { type AnimClip } from 'viberanium';

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
  animPack: { generalGlb: string; movementGlb: string };
  clips: {
    idle: AnimClipRef;
    run: AnimClipRef;
    jumpStart: AnimClipRef;
    jumpIdle: AnimClipRef;
    jumpLand: AnimClipRef;
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

  for (const attachment of def.attachments ?? []) urls.add(attachment.gltfUrl);

  return [...urls];
};

export const pickClip = (clips: AnimClip[], name: string): AnimClip => {
  const exact = clips.find((clip) => clip.name === name);
  if (exact) return exact;

  const partial = clips.find((clip) => clip.name.toLowerCase().includes(name.toLowerCase()));
  if (partial) return partial;

  if (clips[0]) return clips[0];

  throw new Error(`No clip found matching '${name}'`);
};
