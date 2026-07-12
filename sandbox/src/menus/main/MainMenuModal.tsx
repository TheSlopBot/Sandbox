import './mainMenuModal.css';
import {
  type RenderQualityChoice,
  type RenderQualityOverrides,
} from '../../catalog/ui/renderQuality.ts';
import { type EngineOptimizationOptions, type RenderQualityPresetId } from 'viberanium';

export type MainMenuView = 'root' | 'settings';

export type MainMenuModalProps = {
  view: MainMenuView;
  qualityChoice: RenderQualityChoice;
  resolvedPreset: RenderQualityPresetId;
  optimization: EngineOptimizationOptions;
  onViewChange: (view: MainMenuView) => void;
  onResume: () => void;
  onLoadLevel: () => void;
  onConstruct: () => void;
  onQualityChange: (choice: RenderQualityChoice) => void;
  onOptimizationPatch: (patch: RenderQualityOverrides) => void;
};

const PRESETS: { id: RenderQualityChoice; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const MSAA_OPTIONS = [1, 4] as const;
const SHADOW_OPTIONS = [256, 512, 1024, 2048] as const;
const DPR_OPTIONS = [1, 1.25, 1.5, 2] as const;
const CULL_OPTIONS = [18, 20, 30, 35, 45, 55, 60, 80, 100] as const;
const SKELETON_DIST_OPTIONS = [8, 12, 20, 28, 30, 40, 60, 80, 100, 120, 150] as const;

const withCurrent = (options: readonly number[], current: number) => {
  if (options.includes(current)) return [...options];
  return [...options, current].sort((a, b) => a - b);
};

export const MainMenuModal = ({
  view,
  qualityChoice,
  resolvedPreset,
  optimization,
  onViewChange,
  onResume,
  onLoadLevel,
  onConstruct,
  onQualityChange,
  onOptimizationPatch,
}: MainMenuModalProps) => {
  if (view === 'settings') {
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

          <p className="main-menu-modal__hint">
            Changing quality reloads the session.
            {qualityChoice === 'auto' ? ` Auto resolved to ${resolvedPreset}.` : null}
          </p>

          <div className="main-menu-modal__sectionTitle">Presets</div>
          <ul className="main-menu-modal__list main-menu-modal__list--presets">
            {PRESETS.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  className="main-menu-modal__item"
                  data-active={qualityChoice === preset.id}
                  onClick={() => onQualityChange(preset.id)}
                >
                  <span className="main-menu-modal__item-name">{preset.label}</span>
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
                value={optimization.msaaSamples}
                onChange={(e) => onOptimizationPatch({ msaaSamples: Number(e.target.value) })}
              >
                {withCurrent(MSAA_OPTIONS, optimization.msaaSamples).map((value) => (
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
                value={optimization.shadowMapSize}
                onChange={(e) => onOptimizationPatch({ shadowMapSize: Number(e.target.value) })}
              >
                {withCurrent(SHADOW_OPTIONS, optimization.shadowMapSize).map((value) => (
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
                value={optimization.maxDpr}
                onChange={(e) => onOptimizationPatch({ maxDpr: Number(e.target.value) })}
              >
                {withCurrent(DPR_OPTIONS, optimization.maxDpr).map((value) => (
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
                value={optimization.toneBloom ? 'on' : 'off'}
                onChange={(e) => onOptimizationPatch({ toneBloom: e.target.value === 'on' })}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Shadow cull</span>
              <select
                className="main-menu-modal__select"
                value={optimization.shadowCullDist}
                onChange={(e) => onOptimizationPatch({ shadowCullDist: Number(e.target.value) })}
              >
                {withCurrent(CULL_OPTIONS, optimization.shadowCullDist).map((value) => (
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
                value={optimization.forwardCullDist}
                onChange={(e) => onOptimizationPatch({ forwardCullDist: Number(e.target.value) })}
              >
                {withCurrent(CULL_OPTIONS, optimization.forwardCullDist).map((value) => (
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
                value={optimization.skeletonLod.skipStartDist}
                onChange={(e) =>
                  onOptimizationPatch({ skeletonLod: { skipStartDist: Number(e.target.value) } })
                }
              >
                {withCurrent(SKELETON_DIST_OPTIONS, optimization.skeletonLod.skipStartDist).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="main-menu-modal__field">
              <span className="main-menu-modal__fieldLabel">Skeleton LOD freeze</span>
              <select
                className="main-menu-modal__select"
                value={optimization.skeletonLod.freezeDist}
                onChange={(e) =>
                  onOptimizationPatch({ skeletonLod: { freezeDist: Number(e.target.value) } })
                }
              >
                {withCurrent(SKELETON_DIST_OPTIONS, optimization.skeletonLod.freezeDist).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <footer className="main-menu-modal__footer">
            <button type="button" className="main-menu-modal__button" onClick={() => onViewChange('root')}>
              Back
            </button>
          </footer>
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
