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

export type RenderQualityPresetId = 'low' | 'medium' | 'high';

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
    maxDpr: 1,
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
  const options: EngineOptimizationOptions = {
    shadowCullDist: overrides?.shadowCullDist ?? DEFAULT_ENGINE_OPTIMIZATION.shadowCullDist,
    forwardCullDist: overrides?.forwardCullDist ?? DEFAULT_ENGINE_OPTIMIZATION.forwardCullDist,
    skeletonLod: {
      skipStartDist:
        skeletonLodOverrides?.skipStartDist ?? DEFAULT_ENGINE_OPTIMIZATION.skeletonLod.skipStartDist,
      freezeDist: skeletonLodOverrides?.freezeDist ?? DEFAULT_ENGINE_OPTIMIZATION.skeletonLod.freezeDist,
    },
    msaaSamples: overrides?.msaaSamples ?? DEFAULT_ENGINE_OPTIMIZATION.msaaSamples,
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

export const detectPreferredQualityPreset = (adapter?: GPUAdapter | null): RenderQualityPresetId => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);
  const isMac = /Mac/i.test(ua);

  const info = adapter && 'info' in adapter ? (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info : undefined;
  const architecture = (info?.architecture ?? '').toLowerCase();
  const description = (info?.description ?? '').toLowerCase();
  const vendor = (info?.vendor ?? '').toLowerCase();
  const appleGpu =
    architecture.includes('apple') ||
    description.includes('apple') ||
    vendor.includes('apple') ||
    /metal/i.test(description);

  if (appleGpu || (isSafari && isMac)) return 'medium';
  return 'high';
};

export const skeletonLodUpdateInterval = (dist: number, lod: SkeletonLodOptions): number => {
  if (dist <= lod.skipStartDist) return 1;
  if (dist >= lod.freezeDist) return 0;

  const t = (dist - lod.skipStartDist) / (lod.freezeDist - lod.skipStartDist);
  const maxInterval = 12;
  return Math.max(1, Math.round(1 + t * (maxInterval - 1)));
};
