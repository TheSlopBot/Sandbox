import { type KaykitManifestEntry, type KaykitTextureVariant } from './kaykitManifest.ts';

export const resolveManifestEntryForAssetUrl = (
  assetUrl: string,
  entriesByPath: Map<string, KaykitManifestEntry>,
): KaykitManifestEntry | null => {
  const prefix = import.meta.env.BASE_URL;
  const relative = assetUrl.startsWith(prefix) ? assetUrl.slice(prefix.length) : assetUrl;

  for (const entry of entriesByPath.values()) {
    if (entry.url === relative) return entry;
  }

  return null;
};

export const mapTextureVariants = (entry: KaykitManifestEntry | null): KaykitTextureVariant[] => {
  if (!entry) return [];

  return (entry.textureVariants ?? [])
    .filter((v) => !/^default$/i.test(v.label))
    .map((v) => ({
      label: v.label,
      url: `${import.meta.env.BASE_URL}${v.url}`,
    }));
};
