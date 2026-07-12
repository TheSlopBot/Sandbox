import type { KaykitManifestEntry, KaykitTextureVariant } from '../../catalog/manifest/kaykitManifest.ts';

export type ViewerAnimHudProps = {
  title: string;
  status: string;
  showTextureVariant?: boolean;
  canSwitchTexture?: boolean;
  textureVariants?: KaykitTextureVariant[];
  textureVariantUrl?: string | null;
  onTextureVariantChange?: (url: string | null) => void;
  canAnimate?: boolean;
  animPackUrl?: string | null;
  compatibleAnimPacks?: KaykitManifestEntry[];
  onAnimPackChange?: (url: string | null) => void;
  clipName?: string | null;
  availableClipNames?: string[];
  onClipChange?: (clip: string | null) => void;
  animPaused?: boolean;
  onPlayPause?: () => void;
  onReset?: () => void;
  showColliders?: boolean;
  onShowCollidersChange?: (show: boolean) => void;
  showBones?: boolean;
  onShowBonesChange?: (show: boolean) => void;
  showAnimControls?: boolean;
};

export const ViewerAnimHud = ({
  title,
  status,
  showTextureVariant = false,
  canSwitchTexture = false,
  textureVariants = [],
  textureVariantUrl = null,
  onTextureVariantChange,
  canAnimate = false,
  animPackUrl = null,
  compatibleAnimPacks = [],
  onAnimPackChange,
  clipName = null,
  availableClipNames = [],
  onClipChange,
  animPaused = false,
  onPlayPause,
  onReset,
  showColliders,
  onShowCollidersChange,
  showBones,
  onShowBonesChange,
  showAnimControls = true,
}: ViewerAnimHudProps) => {
  const playbackEnabled = canAnimate && !!clipName;
  const playPauseLabel = animPaused ? 'Play' : 'Pause';
  const packLabel = (p: KaykitManifestEntry) => p.path.split('/').slice(-1)[0] ?? p.path;
  const sortedAnimPacks = [...compatibleAnimPacks].sort((a, b) =>
    packLabel(a).localeCompare(packLabel(b), undefined, { sensitivity: 'base' }),
  );
  const sortedClipNames = [...availableClipNames].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  const showOverlayToggles = onShowCollidersChange !== undefined || onShowBonesChange !== undefined;

  return (
    <div className="construct-viewerHud">
      <div className="construct-titleRow">
        <div className="construct-title">{title}</div>
        <div className="construct-subtle">{status}</div>
      </div>
      {showTextureVariant ? (
        <div className="selectRow">
          <label>Texture variant</label>
          <select
            disabled={!canSwitchTexture}
            value={textureVariantUrl ?? ''}
            onChange={(e) => onTextureVariantChange?.(e.target.value || null)}
          >
            <option value="">Default</option>
            {textureVariants.map((v) => (
              <option key={v.url} value={v.url}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {canAnimate ? (
        <>
          <div className="selectRow">
            <label>Animation pack</label>
            <select
              value={animPackUrl ?? ''}
              onChange={(e) => onAnimPackChange?.(e.target.value || null)}
            >
              <option value="">(none)</option>
              {sortedAnimPacks.map((p) => (
                <option key={p.path} value={p.url}>
                  {packLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="selectRow">
            <label>Clip</label>
            <select
              disabled={sortedClipNames.length === 0}
              value={clipName ?? ''}
              onChange={(e) => onClipChange?.(e.target.value || null)}
            >
              <option value="">(none)</option>
              {sortedClipNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      {showOverlayToggles ? (
        <div className="construct-hudChecks">
          {onShowCollidersChange !== undefined ? (
            <label className="construct-hudCheck">
              <span>Show colliders</span>
              <input
                type="checkbox"
                checked={!!showColliders}
                onChange={(e) => onShowCollidersChange(e.target.checked)}
              />
            </label>
          ) : null}
          {onShowBonesChange !== undefined ? (
            <label className="construct-hudCheck">
              <span>Show bones</span>
              <input
                type="checkbox"
                checked={!!showBones}
                onChange={(e) => onShowBonesChange(e.target.checked)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {showTextureVariant && !canSwitchTexture ? (
        <div className="mutedNote">Texture variants unavailable for this asset.</div>
      ) : null}
      {showAnimControls ? (
        <div className="construct-hudFooter">
          <div className="construct-hudActions">
            <button
              type="button"
              className="construct-hudIconBtn"
              title={playPauseLabel}
              aria-label={playPauseLabel}
              disabled={!playbackEnabled}
              onClick={onPlayPause}
            >
              {animPaused ? (
                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                  <path fill="currentColor" d="M3.5 2.2v11.6L13.5 8 3.5 2.2Z" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                  <path fill="currentColor" d="M3.5 2.5h3v11h-3v-11Zm6 0h3v11h-3v-11Z" />
                </svg>
              )}
            </button>
            <button type="button" className="construct-hudResetBtn" onClick={onReset}>
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
