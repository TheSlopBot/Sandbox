export type SkeletonLodOptions = {
  skipStartDist: number;
  freezeDist: number;
  baseRate: number;
};

export type EngineOptimizationOptions = {
  shadowCullDist: number;
  forwardCullDist: number;
  skeletonLod: SkeletonLodOptions;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export const DEFAULT_ENGINE_OPTIMIZATION: EngineOptimizationOptions = {
  shadowCullDist: 60,
  forwardCullDist: 100,
  skeletonLod: { skipStartDist: 20, freezeDist: 100, baseRate: 0 },
};

const validateOptimization = (options: EngineOptimizationOptions) => {
  if (options.shadowCullDist < 0) throw new Error('shadowCullDist must be >= 0');
  if (options.forwardCullDist < 0) throw new Error('forwardCullDist must be >= 0');

  const { skipStartDist, freezeDist, baseRate } = options.skeletonLod;
  if (skipStartDist < 0) throw new Error('skeletonLod.skipStartDist must be >= 0');
  if (freezeDist <= skipStartDist) throw new Error('skeletonLod.freezeDist must be > skeletonLod.skipStartDist');
  if (baseRate < 0 || baseRate > 1) throw new Error('skeletonLod.baseRate must be in [0, 1]');
};

export const createEngineOptimizationOptions = (
  overrides?: DeepPartial<EngineOptimizationOptions>,
): EngineOptimizationOptions => {
  const skeletonLodOverrides = overrides?.skeletonLod;
  const options: EngineOptimizationOptions = {
    shadowCullDist: overrides?.shadowCullDist ?? DEFAULT_ENGINE_OPTIMIZATION.shadowCullDist,
    forwardCullDist: overrides?.forwardCullDist ?? DEFAULT_ENGINE_OPTIMIZATION.forwardCullDist,
    skeletonLod: {
      skipStartDist: skeletonLodOverrides?.skipStartDist ?? DEFAULT_ENGINE_OPTIMIZATION.skeletonLod.skipStartDist,
      freezeDist: skeletonLodOverrides?.freezeDist ?? DEFAULT_ENGINE_OPTIMIZATION.skeletonLod.freezeDist,
      baseRate: skeletonLodOverrides?.baseRate ?? DEFAULT_ENGINE_OPTIMIZATION.skeletonLod.baseRate,
    },
  };

  validateOptimization(options);
  return options;
};

export const skeletonSkipChanceForDist = (dist: number, lod: SkeletonLodOptions): number => {
  if (dist <= lod.skipStartDist) return lod.baseRate;
  if (dist >= lod.freezeDist) return 1;

  const t = (dist - lod.skipStartDist) / (lod.freezeDist - lod.skipStartDist);
  return lod.baseRate + t * (1 - lod.baseRate);
};
