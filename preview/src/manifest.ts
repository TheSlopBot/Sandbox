import { type KaykitManifest } from './types.ts';

export const loadKaykitManifest = async (): Promise<KaykitManifest> => {
  const url = `${import.meta.env.BASE_URL}assets/kaykit/manifest.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load manifest: ${url}`);

  const json = (await res.json()) as unknown;
  return json as KaykitManifest;
};

