import { type LoadedGltf } from './loader.ts';
import { type Material } from '../../render/types.ts';
import { TextureCache } from '../../render/gl/texture.ts';

export const buildGltfMaterials = (
  loaded: LoadedGltf,
  prefix: string,
  textures: TextureCache,
): Material[] => {
  const mats: Material[] = [];
  const gltfMats = loaded.gltf.materials ?? [];

  for (let i = 0; i < gltfMats.length; i++) {
    const gm = gltfMats[i];
    const pbr = gm.pbrMetallicRoughness;
    const baseFactor = pbr?.baseColorFactor ?? [1, 1, 1, 1];
    const texIndex = pbr?.baseColorTexture?.index;
    let baseTex: WebGLTexture | null = null;

    if (texIndex !== undefined && texIndex >= 0) {
      const tex = loaded.gltf.textures?.[texIndex];
      const src = tex?.source ?? -1;
      if (src >= 0 && loaded.images[src]) {
        baseTex = textures.getOrCreate(loaded.resolvedImageUris[src], loaded.images[src]);
      }
    }

    mats.push({
      name: `${prefix}_${gm.name ?? i}`,
      baseColorTex: baseTex,
      baseColorFactor: [baseFactor[0], baseFactor[1], baseFactor[2], baseFactor[3]],
      alphaMode: (gm.alphaMode ?? 'OPAQUE') === 'BLEND' ? 'BLEND' : 'OPAQUE',
    });
  }

  if (mats.length === 0) {
    const fallbackTex = loaded.images[0]
      ? textures.getOrCreate(loaded.resolvedImageUris[0], loaded.images[0])
      : null;
    mats.push({ name: `${prefix}_default`, baseColorTex: fallbackTex, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' });
  }

  return mats;
};
