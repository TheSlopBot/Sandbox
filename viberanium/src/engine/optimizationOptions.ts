export type SkeletonLodOptions = {
  skipStartDist: number;
  freezeDist: number;
};

export type EngineOptimizationOptions = {
  shadowCullDist: number;
  forwardCullDist: number;
  skeletonLod: SkeletonLodOptions;
  msaaSamples: number;
  shadowMapSize: number;
  maxDpr: number;
  toneBloom: boolean;
};

export type RenderQualityPresetId = 'low' | 'medium' | 'high' | 'ultra';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export const DEFAULT_ENGINE_OPTIMIZATION: EngineOptimizationOptions = {
  shadowCullDist: 60,
  forwardCullDist: 100,
  skeletonLod: { skipStartDist: 20, freezeDist: 100 },
  msaaSamples: 4,
  shadowMapSize: 2048,
  maxDpr: 2,
  toneBloom: true,
};

export const RENDER_QUALITY_PRESETS: Record<RenderQualityPresetId, DeepPartial<EngineOptimizationOptions>> = {
  ultra: {
    shadowCullDist: 100,
    forwardCullDist: 150,
    skeletonLod: { skipStartDist: 60, freezeDist: 200 },
    msaaSamples: 4,
    shadowMapSize: 4096,
    maxDpr: 3,
    toneBloom: true,
  },
  high: {
    shadowCullDist: 60,
    forwardCullDist: 100,
    skeletonLod: { skipStartDist: 40, freezeDist: 150 },
    msaaSamples: 4,
    shadowMapSize: 2048,
    maxDpr: 2,
    toneBloom: true,
  },
  medium: {
    shadowCullDist: 45,
    forwardCullDist: 80,
    skeletonLod: { skipStartDist: 20, freezeDist: 80 },
    msaaSamples: 1,
    shadowMapSize: 1024,
    maxDpr: 1.25,
    toneBloom: false,
  },
  low: {
    shadowCullDist: 18,
    forwardCullDist: 35,
    skeletonLod: { skipStartDist: 8, freezeDist: 28 },
    msaaSamples: 1,
    shadowMapSize: 256,
    maxDpr: 0.75,
    toneBloom: false,
  },
};

const validateOptimization = (options: EngineOptimizationOptions) => {
  if (options.shadowCullDist < 0) throw new Error('shadowCullDist must be >= 0');
  if (options.forwardCullDist < 0) throw new Error('forwardCullDist must be >= 0');
  if (options.msaaSamples !== 1 && options.msaaSamples !== 4) {
    throw new Error('msaaSamples must be 1 or 4');
  }
  if (options.shadowMapSize < 256) throw new Error('shadowMapSize must be >= 256');
  if (!(options.maxDpr > 0)) throw new Error('maxDpr must be > 0');

  const { skipStartDist, freezeDist } = options.skeletonLod;
  if (skipStartDist < 0) throw new Error('skeletonLod.skipStartDist must be >= 0');
  if (freezeDist <= skipStartDist) throw new Error('skeletonLod.freezeDist must be > skeletonLod.skipStartDist');
};

export const createEngineOptimizationOptions = (
  overrides?: DeepPartial<EngineOptimizationOptions>,
): EngineOptimizationOptions => {
  const skeletonLodOverrides = overrides?.skeletonLod;
  const rawMsaa = overrides?.msaaSamples ?? DEFAULT_ENGINE_OPTIMIZATION.msaaSamples;
  const options: EngineOptimizationOptions = {
    shadowCullDist: overrides?.shadowCullDist ?? DEFAULT_ENGINE_OPTIMIZATION.shadowCullDist,
    forwardCullDist: overrides?.forwardCullDist ?? DEFAULT_ENGINE_OPTIMIZATION.forwardCullDist,
    skeletonLod: {
      skipStartDist:
        skeletonLodOverrides?.skipStartDist ?? DEFAULT_ENGINE_OPTIMIZATION.skeletonLod.skipStartDist,
      freezeDist: skeletonLodOverrides?.freezeDist ?? DEFAULT_ENGINE_OPTIMIZATION.skeletonLod.freezeDist,
    },
    msaaSamples: rawMsaa >= 4 ? 4 : 1,
    shadowMapSize: overrides?.shadowMapSize ?? DEFAULT_ENGINE_OPTIMIZATION.shadowMapSize,
    maxDpr: overrides?.maxDpr ?? DEFAULT_ENGINE_OPTIMIZATION.maxDpr,
    toneBloom: overrides?.toneBloom ?? DEFAULT_ENGINE_OPTIMIZATION.toneBloom,
  };

  validateOptimization(options);
  return options;
};

export const createEngineOptimizationFromPreset = (
  preset: RenderQualityPresetId,
  overrides?: DeepPartial<EngineOptimizationOptions>,
): EngineOptimizationOptions =>
  createEngineOptimizationOptions({
    ...RENDER_QUALITY_PRESETS[preset],
    ...overrides,
    skeletonLod: {
      ...DEFAULT_ENGINE_OPTIMIZATION.skeletonLod,
      ...RENDER_QUALITY_PRESETS[preset]?.skeletonLod,
      ...overrides?.skeletonLod,
    },
  });

const adapterInfoText = (adapter?: GPUAdapter | null): string => {
  const info = adapter && 'info' in adapter ? (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info : undefined;
  return [
    info?.vendor,
    info?.architecture,
    info?.device,
    info?.description,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .toLowerCase();
};

const isFallbackAdapter = (adapter?: GPUAdapter | null): boolean =>
  !!adapter && 'isFallbackAdapter' in adapter && !!(adapter as GPUAdapter & { isFallbackAdapter?: boolean }).isFallbackAdapter;

export const detectPreferredQualityPreset = (adapter?: GPUAdapter | null): RenderQualityPresetId => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);
  const isMac = /Mac/i.test(ua);
  const text = adapterInfoText(adapter);

  if (isFallbackAdapter(adapter)) return 'low';

  const appleGpu =
    /apple|metal/.test(text) ||
    (isSafari && isMac);

  if (appleGpu) return 'medium';

  const discrete =
    /nvidia|geforce|rtx|gtx|quadro|tesla/.test(text) ||
    /radeon\s*rx|radeon\s*pro|radeon\s*vega\s*(?:56|64)|radeon\s*vii|firepro|instinct/.test(text) ||
    /arc\s*(?:a|b)\d|intel\s*arc/.test(text) ||
    /adreno\s*(?:7|8)\d{2}/.test(text);

  if (discrete) {
    const highEnd =
      /rtx\s*(?:30|40|50)\d{2}|rtx\s*a\d|gtx\s*16\d{2}|gtx\s*1080/.test(text) ||
      /radeon\s*rx\s*(?:6|7|8|9)\d{3}|radeon\s*pro\s*w\d/.test(text) ||
      /arc\s*(?:a7|a770|b\d)/.test(text);
    return highEnd ? 'ultra' : 'high';
  }

  const integrated =
    /intel/.test(text) ||
    /uhd|iris|hd graphics/.test(text) ||
    /radeon\s*graphics|radeon\s*\d{3}m|radeon\s*vega\s*(?:3|8|11)|graphics.*radeon/.test(text) ||
    /mali|xclipse|adreno/.test(text);

  if (integrated) return 'medium';

  if (isSafari || /android/i.test(ua) || /mobile/i.test(ua)) return 'medium';

  return 'high';
};

export const skeletonLodUpdateInterval = (dist: number, lod: SkeletonLodOptions): number => {
  if (dist <= lod.skipStartDist) return 1;
  if (dist >= lod.freezeDist) return 0;

  const t = (dist - lod.skipStartDist) / (lod.freezeDist - lod.skipStartDist);
  const maxInterval = 12;
  return Math.max(1, Math.round(1 + t * (maxInterval - 1)));
};
