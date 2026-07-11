import { type Material, type TextureHandle } from 'viberanium';

export type ConstructPropAssetMaterials = {
  materials: Material[];
  defaultBaseColorTex: TextureHandle | null;
  textureVariantUrl: string | null;
};

export const createConstructPropAssetMaterials = (
  materials: Material[],
  defaultBaseColorTex: TextureHandle | null,
  textureVariantUrl: string | null = null,
): ConstructPropAssetMaterials => ({
  materials,
  defaultBaseColorTex,
  textureVariantUrl,
});
