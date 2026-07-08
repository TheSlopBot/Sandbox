export type KaykitEntryKind = 'StaticProp' | 'CharacterModel' | 'AnimationSet' | 'Unknown';

export type KaykitRigKind = 'Large' | 'Medium' | null;

export type KaykitImageRef = {
  name: string | null;
  uri: string | null;
};

export type KaykitTextureVariant = {
  label: string;
  url: string;
};

export type KaykitManifestEntry = {
  path: string;
  url: string;
  kind: KaykitEntryKind;
  rigKind: KaykitRigKind;
  boneCount: number;
  boneNames: string[];
  clipNames: string[];
  images: KaykitImageRef[];
  bufferUris: string[];
  generator: string | null;
  textureVariants: KaykitTextureVariant[];
};

export type KaykitTreeNode =
  | { type: 'dir'; name: string; path: string; children: KaykitTreeNode[] }
  | { type: 'file'; name: string; path: string };

export type KaykitManifest = {
  version: number;
  generatedAt: string;
  rootUrlPrefix: string;
  tree: KaykitTreeNode;
  entries: KaykitManifestEntry[];
};
