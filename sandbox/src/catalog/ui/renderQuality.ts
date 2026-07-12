import {
  createEngineOptimizationFromPreset,
  detectPreferredQualityPreset,
  type EngineOptimizationOptions,
  type RenderQualityPresetId,
} from 'viberanium';

export type RenderQualityChoice = 'auto' | RenderQualityPresetId;

export type RenderQualityOverrides = Partial<{
  msaaSamples: number;
  shadowMapSize: number;
  maxDpr: number;
  toneBloom: boolean;
  shadowCullDist: number;
  forwardCullDist: number;
  skeletonLod: Partial<{
    skipStartDist: number;
    freezeDist: number;
  }>;
}>;

const CHOICE_KEY = 'sandbox.renderQuality';
const OVERRIDES_KEY = 'sandbox.renderQualityOverrides';

export const readStoredQualityChoice = (): RenderQualityChoice => {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    if (raw === 'auto' || raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  } catch {
  }
  return 'auto';
};

export const writeStoredQualityChoice = (choice: RenderQualityChoice) => {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
  } catch {
  }
};

export const readStoredQualityOverrides = (): RenderQualityOverrides => {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as RenderQualityOverrides;
  } catch {
    return {};
  }
};

export const writeStoredQualityOverrides = (overrides: RenderQualityOverrides) => {
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(OVERRIDES_KEY);
      return;
    }
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
  }
};

export const mergeQualityOverrides = (
  current: RenderQualityOverrides,
  patch: RenderQualityOverrides,
): RenderQualityOverrides => ({
  ...current,
  ...patch,
  skeletonLod:
    current.skeletonLod || patch.skeletonLod
      ? { ...current.skeletonLod, ...patch.skeletonLod }
      : undefined,
});

export const resolveQualityPreset = (
  choice: RenderQualityChoice,
  adapter?: GPUAdapter | null,
): RenderQualityPresetId => {
  if (choice === 'auto') return detectPreferredQualityPreset(adapter);
  return choice;
};

export const createOptimizationForQualityChoice = (
  choice: RenderQualityChoice,
  adapter?: GPUAdapter | null,
  overrides: RenderQualityOverrides = {},
): {
  choice: RenderQualityChoice;
  preset: RenderQualityPresetId;
  optimization: EngineOptimizationOptions;
  overrides: RenderQualityOverrides;
} => {
  const preset = resolveQualityPreset(choice, adapter);
  return {
    choice,
    preset,
    overrides,
    optimization: createEngineOptimizationFromPreset(preset, overrides),
  };
};
