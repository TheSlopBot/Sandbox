export type PropPartLocal = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type PropAssetPart = PropPartLocal & {
  id: string;
  kind: 'asset';
  url: string;
  materialPrefix: string;
  textureVariantUrl?: string | null;
  tags: string[];
};

export type PropColliderPart = PropPartLocal & {
  id: string;
  kind: 'collider';
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule';
  halfExtents?: [number, number, number];
  radius?: number;
  halfHeight?: number;
};

export type PropDefinition = {
  id: string;
  displayName: string;
  parts: Array<PropAssetPart | PropColliderPart>;
};

export const identityPartLocal = (): PropPartLocal => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});
