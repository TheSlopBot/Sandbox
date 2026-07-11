import { type Material } from 'viberanium';

export const applyTextureToMaterials = (
  materials: Material[],
  tex: WebGLTexture | null,
  defaultTex: WebGLTexture | null,
) => {
  const next = tex ?? defaultTex;

  for (const mat of materials) {
    if (next) mat.baseColorTex = next;
  }
};
