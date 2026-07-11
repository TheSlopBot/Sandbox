import { type LoadedGltf } from './loader.ts';
import { type Material } from '../../render/types.ts';
import { type TextureCache } from '../../render/gl/texture.ts';

type MaterialCacheEntry = {
  textures: TextureCache;
  byKey: Map<string, Material[]>;
};

const materialCache = new WeakMap<LoadedGltf, MaterialCacheEntry>();

export const buildGltfMaterials = (
  loaded: LoadedGltf,
  prefix: string,
  textures: TextureCache,
  baseColorOverride: WebGLTexture | null = null,
): Material[] => {
  const mats: Material[] = [];
  const gltfMats = loaded.gltf.materials ?? [];

  for (let i = 0; i < gltfMats.length; i++) {
    const gm = gltfMats[i];
    const pbr = gm.pbrMetallicRoughness;
    const baseFactor = pbr?.baseColorFactor ?? [1, 1, 1, 1];
    const texIndex = pbr?.baseColorTexture?.index;
    let baseTex: WebGLTexture | null = baseColorOverride;

    if (!baseTex && texIndex !== undefined && texIndex >= 0) {
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
      doubleSided: gm.doubleSided === true,
    });
  }

  if (mats.length === 0) {
    const fallbackTex = baseColorOverride
      ?? (loaded.images[0]
        ? textures.getOrCreate(loaded.resolvedImageUris[0], loaded.images[0])
        : null);
    mats.push({ name: `${prefix}_default`, baseColorTex: fallbackTex, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' });
  }

  return mats;
};

export const getOrBuildGltfMaterials = (
  loaded: LoadedGltf,
  prefix: string,
  textures: TextureCache,
  baseColorOverride: WebGLTexture | null = null,
): Material[] => {
  if (baseColorOverride) return buildGltfMaterials(loaded, prefix, textures, baseColorOverride);

  let entry = materialCache.get(loaded);
  if (!entry || entry.textures !== textures) {
    entry = { textures, byKey: new Map() };
    materialCache.set(loaded, entry);
  }

  const cached = entry.byKey.get(prefix);
  if (cached) return cached;

  const mats = buildGltfMaterials(loaded, prefix, textures, null);
  entry.byKey.set(prefix, mats);
  return mats;
};
