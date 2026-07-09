import { useEffect, useState } from 'react';
import { type EngineOptimizationOptions } from 'viberanium';
import './performanceMenu.css';

export type PerformanceMenuProps = {
  visible: boolean;
  bootError: string | null;
  optimization: EngineOptimizationOptions | null;
  asciiEnabled: boolean;
  onAsciiEnabledChange: (enabled: boolean) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const PerformanceMenu = ({
  visible,
  bootError,
  optimization,
  asciiEnabled,
  onAsciiEnabledChange,
}: PerformanceMenuProps) => {
  const [shadowCull, setShadowCull] = useState(60);
  const [forwardCull, setForwardCull] = useState(100);
  const [skeletonFreeze, setSkeletonFreeze] = useState(80);

  useEffect(() => {
    if (!optimization) return;

    setShadowCull(optimization.shadowCullDist);
    setForwardCull(optimization.forwardCullDist);
    setSkeletonFreeze(optimization.skeletonLod.freezeDist);
  }, [optimization]);

  const applyShadowCull = (value: number) => {
    const next = clamp(value, 0, 200);
    setShadowCull(next);
    if (optimization) optimization.shadowCullDist = next;
  };

  const applyForwardCull = (value: number) => {
    const next = clamp(value, 0, 300);
    setForwardCull(next);
    if (optimization) optimization.forwardCullDist = next;
  };

  const applySkeletonFreeze = (value: number) => {
    const next = clamp(value, 1, 200);
    setSkeletonFreeze(next);
    if (!optimization) return;

    optimization.skeletonLod.freezeDist = next;
    if (optimization.skeletonLod.skipStartDist >= next) {
      optimization.skeletonLod.skipStartDist = Math.max(0, next - 1);
    }
  };

  return (
    <aside
      id="performance-menu"
      className="performance-menu"
      data-visible={visible}
      aria-hidden={!visible}
      aria-label="Performance"
    >
      {bootError ? (
        <p className="performance-menu__error">Boot error: {bootError}</p>
      ) : (
        <>
          <header className="performance-menu__header">
            <span className="performance-menu__title">Performance</span>
            <span className="performance-menu__fps">
              <span className="performance-menu__fps-label">FPS</span>
              <span id="fps" className="performance-menu__fps-value">
                ...
              </span>
            </span>
          </header>

          <div className="performance-menu__section">
            <label className="performance-menu__row">
              <span className="performance-menu__label">Shadow cull</span>
              <input
                className="performance-menu__range"
                type="range"
                min={0}
                max={200}
                step={5}
                value={shadowCull}
                disabled={!optimization}
                onChange={(event) => applyShadowCull(Number(event.target.value))}
              />
              <span className="performance-menu__value">{shadowCull}m</span>
            </label>

            <label className="performance-menu__row">
              <span className="performance-menu__label">Forward cull</span>
              <input
                className="performance-menu__range"
                type="range"
                min={0}
                max={300}
                step={5}
                value={forwardCull}
                disabled={!optimization}
                onChange={(event) => applyForwardCull(Number(event.target.value))}
              />
              <span className="performance-menu__value">{forwardCull}m</span>
            </label>

            <label className="performance-menu__row">
              <span className="performance-menu__label">Skeleton LOD</span>
              <input
                className="performance-menu__range"
                type="range"
                min={1}
                max={200}
                step={5}
                value={skeletonFreeze}
                disabled={!optimization}
                onChange={(event) => applySkeletonFreeze(Number(event.target.value))}
              />
              <span className="performance-menu__value">{skeletonFreeze}m</span>
            </label>
          </div>

          <label className="performance-menu__toggle">
            <input
              type="checkbox"
              checked={asciiEnabled}
              disabled={!optimization}
              onChange={(event) => onAsciiEnabledChange(event.target.checked)}
            />
            <span>ASCII post-process</span>
          </label>
        </>
      )}
    </aside>
  );
};
