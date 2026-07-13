import { useEffect, useState } from 'react';
import './mainMenuModal.css';
import {
  mergeQualityOverrides,
  readStoredQualityOverrides,
  type RenderQualityChoice,
  type RenderQualityOverrides,
} from '../../catalog/ui/renderQuality.ts';
import {
  createEngineOptimizationFromPreset,
  type EngineOptimizationOptions,
  type RenderQualityPresetId,
} from 'viberanium';

export type MainMenuView = 'root' | 'settings';

export type MainMenuModalProps = {
  view: MainMenuView;
  qualityChoice: RenderQualityChoice;
  recommendedPreset: RenderQualityPresetId;
  optimization: EngineOptimizationOptions;
  onViewChange: (view: MainMenuView) => void;
  onResume: () => void;
  onLoadLevel: () => void;
  onConstruct: () => void;
  onSaveSettings: (choice: RenderQualityChoice, overrides: RenderQualityOverrides) => void;
};

const PRESETS: { id: RenderQualityPresetId; label: string }[] = [
  { id: 'ultra', label: 'Ultra' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const MSAA_OPTIONS = [1, 4] as const;
const SHADOW_OPTIONS = [256, 512, 1024, 2048, 4096] as const;
const DPR_OPTIONS = [0.75, 1, 1.25, 1.5, 2, 3] as const;
const CULL_OPTIONS = [18, 20, 30, 35, 45, 55, 60, 80, 100, 120, 150] as const;
const SKELETON_DIST_OPTIONS = [8, 12, 20, 28, 30, 40, 60, 80, 100, 120, 150, 200] as const;

const withCurrent = (options: readonly number[], current: number) => {
  if (options.includes(current)) return [...options];
  return [...options, current].sort((a, b) => a - b);
};

const sameOverrides = (a: RenderQualityOverrides, b: RenderQualityOverrides) =>
  JSON.stringify(a) === JSON.stringify(b);

export const MainMenuModal = ({
  view,
  qualityChoice,
  recommendedPreset,
  optimization,
  onViewChange,
  onResume,
  onLoadLevel,
  onConstruct,
  onSaveSettings,
}: MainMenuModalProps) => {
  const [draftChoice, setDraftChoice] = useState(qualityChoice);
  const [draftOverrides, setDraftOverrides] = useState<RenderQualityOverrides>(() =>
    readStoredQualityOverrides(),
  );
  const [baselineChoice, setBaselineChoice] = useState(qualityChoice);
  const [baselineOverrides, setBaselineOverrides] = useState<RenderQualityOverrides>(() =>
    readStoredQualityOverrides(),
  );

  useEffect(() => {
    if (view !== 'settings') return;

    const stored = readStoredQualityOverrides();
    setDraftChoice(qualityChoice);
    setDraftOverrides(stored);
    setBaselineChoice(qualityChoice);
    setBaselineOverrides(stored);
  }, [view, qualityChoice, optimization]);

  if (view === 'settings') {
    const draftOptimization = createEngineOptimizationFromPreset(draftChoice, draftOverrides);
    const dirty =
      draftChoice !== baselineChoice || !sameOverrides(draftOverrides, baselineOverrides);

    const patchDraft = (patch: RenderQualityOverrides) => {
      setDraftOverrides((current) => {
        const next = mergeQualityOverrides(current, patch);
        const skip =
          next.skeletonLod?.skipStartDist ?? draftOptimization.skeletonLod.skipStartDist;
        const freeze =
          next.skeletonLod?.freezeDist ?? draftOptimization.skeletonLod.freezeDist;
        if (freeze <= skip) {
          next.skeletonLod = { ...next.skeletonLod, freezeDist: skip + 4 };
        }
        return next;
      });
    };

    return (
      <div className="main-menu-modal-backdrop" role="presentation">
        <div
          className="main-menu-modal main-menu-modal--settings"
          role="dialog"
          aria-modal="true"
          aria-labelledby="main-menu-settings-title"
        >
          <header className="main-menu-modal__header">
            <span id="main-menu-settings-title" className="main-menu-modal__title">
              Settings
            </span>
            <button
              type="button"
              className="main-menu-modal__close"
              onClick={() => onViewChange('root')}
              aria-label="Back"
            >
              &times;
            </button>
          </header>

          <div className="main-menu-modal__sectionTitle">Presets</div>
          <ul className="main-menu-modal__list main-menu-modal__list--presets">
            {PRESETS.map((presetOption) => (
              <li key={presetOption.id}>
                <button
                  type="button"
                  className="main-menu-modal__item"
                  data-active={draftChoice === presetOption.id}
                  onClick={() => {
                    setDraftChoice(presetOption.id);
                    setDraftOverrides({});
                  }}
                >
                  <span className="main-menu-modal__item-name">{presetOption.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="main-menu-modal__sectionTitle">Details</div>
          <div className="main-menu-modal__grid">
            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">MSAA</span>
              <select
                className="main-menu-modal__select"
                value={draftOptimization.msaaSamples}
                onChange={(e) => patchDraft({ msaaSamples: Number(e.target.value) })}
              >
                {withCurrent(MSAA_OPTIONS, draftOptimization.msaaSamples).map((value) => (
                  <option key={value} value={value}>
                    {value}x
                  </option>
                ))}
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Shadow map</span>
              <select
                className="main-menu-modal__select"
                value={draftOptimization.shadowMapSize}
                onChange={(e) => patchDraft({ shadowMapSize: Number(e.target.value) })}
              >
                {withCurrent(SHADOW_OPTIONS, draftOptimization.shadowMapSize).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Max DPR</span>
              <select
                className="main-menu-modal__select"
                value={draftOptimization.maxDpr}
                onChange={(e) => patchDraft({ maxDpr: Number(e.target.value) })}
              >
                {withCurrent(DPR_OPTIONS, draftOptimization.maxDpr).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Tone bloom</span>
              <select
                className="main-menu-modal__select"
                value={draftOptimization.toneBloom ? 'on' : 'off'}
                onChange={(e) => patchDraft({ toneBloom: e.target.value === 'on' })}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Shadow cull</span>
              <select
                className="main-menu-modal__select"
                value={draftOptimization.shadowCullDist}
                onChange={(e) => patchDraft({ shadowCullDist: Number(e.target.value) })}
              >
                {withCurrent(CULL_OPTIONS, draftOptimization.shadowCullDist).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Forward cull</span>
              <select
                className="main-menu-modal__select"
                value={draftOptimization.forwardCullDist}
                onChange={(e) => patchDraft({ forwardCullDist: Number(e.target.value) })}
              >
                {withCurrent(CULL_OPTIONS, draftOptimization.forwardCullDist).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Skeleton LOD start</span>
              <select
                className="main-menu-modal__select"
                value={draftOptimization.skeletonLod.skipStartDist}
                onChange={(e) =>
                  patchDraft({ skeletonLod: { skipStartDist: Number(e.target.value) } })
                }
              >
                {withCurrent(SKELETON_DIST_OPTIONS, draftOptimization.skeletonLod.skipStartDist).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Skeleton LOD freeze</span>
              <select
                className="main-menu-modal__select"
                value={draftOptimization.skeletonLod.freezeDist}
                onChange={(e) =>
                  patchDraft({ skeletonLod: { freezeDist: Number(e.target.value) } })
                }
              >
                {withCurrent(SKELETON_DIST_OPTIONS, draftOptimization.skeletonLod.freezeDist).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <div className="main-menu-modal__footer">
            <button
              type="button"
              className="main-menu-modal__button"
              onClick={() => {
                setDraftChoice(recommendedPreset);
                setDraftOverrides({});
              }}
            >
              Auto-detect
            </button>
            <button
              type="button"
              className="main-menu-modal__button main-menu-modal__button--primary"
              disabled={!dirty}
              onClick={() => onSaveSettings(draftChoice, draftOverrides)}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu-modal-backdrop" role="presentation">
      <div
        className="main-menu-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="main-menu-title"
      >
        <header className="main-menu-modal__header">
          <span id="main-menu-title" className="main-menu-modal__title">
            Menu
          </span>
        </header>

        <ul className="main-menu-modal__list">
          <li>
            <button type="button" className="main-menu-modal__item" onClick={onResume}>
              <span className="main-menu-modal__item-name">Resume</span>
            </button>
          </li>
          <li>
            <button type="button" className="main-menu-modal__item" onClick={onLoadLevel}>
              <span className="main-menu-modal__item-name">Load Level</span>
            </button>
          </li>
          <li>
            <button type="button" className="main-menu-modal__item" onClick={onConstruct}>
              <span className="main-menu-modal__item-name">Construct</span>
            </button>
          </li>
          <li>
            <button type="button" className="main-menu-modal__item" onClick={() => onViewChange('settings')}>
              <span className="main-menu-modal__item-name">Settings</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};
