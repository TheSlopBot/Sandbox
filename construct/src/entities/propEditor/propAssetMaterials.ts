import type { Material } from 'viberanium';

export type ConstructPropAssetMaterials = {
  materials: Material[];
  defaultBaseColorTex: WebGLTexture | null;
  textureVariantUrl: string | null;
};

export const createConstructPropAssetMaterials = (
  materials: Material[],
  defaultBaseColorTex: WebGLTexture | null,
  textureVariantUrl: string | null = null,
): ConstructPropAssetMaterials => ({
  materials,
  defaultBaseColorTex,
  textureVariantUrl,
});
