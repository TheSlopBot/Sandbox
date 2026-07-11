import { loadGltf, type LoadedGltf } from './loader.ts';

export type GltfCache = {
  getOrLoad: (url: string) => Promise<LoadedGltf>;
  preload: (urls: readonly string[]) => Promise<void>;
  has: (url: string) => boolean;
  clear: () => void;
};

export const createGltfCache = (): GltfCache => {
  const entries = new Map<string, Promise<LoadedGltf>>();

  const getOrLoad = (url: string): Promise<LoadedGltf> => {
    const existing = entries.get(url);
    if (existing) return existing;

    const pending = loadGltf(url);
    entries.set(url, pending);
    return pending;
  };

  return {
    getOrLoad,
    preload: async (urls) => { await Promise.all(urls.map(getOrLoad)); },
    has: (url) => entries.has(url),
    clear: () => {
      entries.clear();
    },
  };
};
