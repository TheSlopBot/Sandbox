import { type Material, type TextureHandle } from 'viberanium';

export const applyTextureToMaterials = (
  materials: Material[],
  tex: TextureHandle | null,
  defaultTex: TextureHandle | null,
) => {
  const next = tex ?? defaultTex;

  for (const mat of materials) {
    if (next) mat.baseColorTex = next;
  }
};
