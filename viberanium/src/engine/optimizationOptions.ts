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

const isSoftwareAdapter = (text: string): boolean =>
  /swiftshader|llvmpipe|softpipe|lavapipe|microsoft basic render/.test(text);

const isAppleGpu = (text: string, isSafari: boolean, isMac: boolean): boolean =>
  /apple|metal/.test(text) || (isSafari && isMac);

const isDiscreteGpu = (text: string): boolean =>
  /nvidia|geforce|rtx|gtx|quadro|tesla|titan/.test(text) ||
  /radeon\s*rx|radeon\s*pro|radeon\s*vega\s*(?:56|64)|radeon\s*vii|firepro|instinct/.test(text) ||
  /arc\s*(?:a|b)\d{2,}|intel\s*arc\s*(?:a|b)\d/.test(text);

const isHighResourceDiscrete = (text: string): boolean => {
  if (/rtx\s*(?:2050|2060|3050|4050)/.test(text)) return false;
  if (/rtx\s*(?:30|40|50)\d{2}/.test(text)) return true;
  if (/rtx\s*a\d{4}/.test(text)) return true;
  if (/gtx\s*(?:1080|1070)\s*ti|gtx\s*1080\b/.test(text)) return true;
  if (/radeon\s*rx\s*(?:6[7-9]\d{2}|7[6-9]\d{2}|7[89]00|9\d{3})/.test(text)) return true;
  if (/radeon\s*pro\s*w\d{4}|radeon\s*vii|vega\s*(?:56|64)/.test(text)) return true;
  if (/arc\s*(?:a7\d{2}|b\d{2,})/.test(text)) return true;
  if (/quadro\s*(?:rtx|gv100)|tesla|titan\s*(?:rtx|v|xp)/.test(text)) return true;
  return false;
};

const isCapableIntegrated = (text: string): boolean =>
  /iris|xe\s*graphics|arc\s*graphics/.test(text) ||
  /uhd\s*(?:graphics\s*)?(?:7\d{2}|[89]\d{2})\b/.test(text) ||
  /radeon\s*(?:6[89]0m|7[3468]0m|8[0469]0m)/.test(text) ||
  /gfx1[01]\d{2}|rdna[2-4]/.test(text) ||
  /adreno\s*(?:[6-9]\d{2}|1\d{3})/.test(text) ||
  /mali[- ]?g[7-9]|mali[- ]?g1\d|xclipse/.test(text);

const isLowSkewIntegrated = (text: string): boolean => {
  if (isCapableIntegrated(text)) return false;
  return (
    /hd graphics/.test(text) ||
    /uhd graphics|uhd\s*\d{3}/.test(text) ||
    /radeon\s*vega\s*(?:3|6|8|11)\b/.test(text) ||
    /mali[- ]?[t4-6]|mali[- ]?g[3-5]|adreno\s*[3-5]\d{2}/.test(text) ||
    /powervr|videocore/.test(text)
  );
};

const isIntegratedGpu = (text: string): boolean =>
  isCapableIntegrated(text) ||
  isLowSkewIntegrated(text) ||
  /intel/.test(text) ||
  /uhd|iris|hd graphics|xe\s*graphics|arc\s*graphics/.test(text) ||
  /radeon\s*graphics|radeon\s*\d{3}m|radeon\s*vega\s*(?:3|8|11)|graphics.*radeon/.test(text) ||
  /mali|xclipse|adreno|powervr/.test(text);

export const detectPreferredQualityPreset = (adapter?: GPUAdapter | null): RenderQualityPresetId => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);
  const isMac = /Mac/i.test(ua);
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  const text = adapterInfoText(adapter);

  if (isFallbackAdapter(adapter) || isSoftwareAdapter(text)) return 'low';

  if (isAppleGpu(text, isSafari, isMac)) return 'medium';

  if (isDiscreteGpu(text)) {
    return isHighResourceDiscrete(text) ? 'ultra' : 'high';
  }

  if (isLowSkewIntegrated(text)) return 'low';

  if (isCapableIntegrated(text) || isIntegratedGpu(text)) return 'medium';

  if (isSafari || isMobile) return 'medium';

  return 'high';
};

export const skeletonLodUpdateInterval = (dist: number, lod: SkeletonLodOptions): number => {
  if (dist <= lod.skipStartDist) return 1;
  if (dist >= lod.freezeDist) return 0;

  const t = (dist - lod.skipStartDist) / (lod.freezeDist - lod.skipStartDist);
  const maxInterval = 12;
  return Math.max(1, Math.round(1 + t * (maxInterval - 1)));
};
