import type { KaykitManifestEntry, KaykitTextureVariant } from '../../catalog/manifest/kaykitManifest.ts';

export type ViewerAnimHudProps = {
  title: string;
  status: string;
  showTextureVariant?: boolean;
  canSwitchTexture?: boolean;
  textureVariants?: KaykitTextureVariant[];
  textureVariantUrl?: string | null;
  onTextureVariantChange?: (url: string | null) => void;
  canAnimate: boolean;
  animPackUrl: string | null;
  compatibleAnimPacks: KaykitManifestEntry[];
  onAnimPackChange: (url: string | null) => void;
  clipName: string | null;
  availableClipNames: string[];
  onClipChange: (clip: string | null) => void;
  onReset: () => void;
};

export const ViewerAnimHud = ({
  title,
  status,
  showTextureVariant = false,
  canSwitchTexture = false,
  textureVariants = [],
  textureVariantUrl = null,
  onTextureVariantChange,
  canAnimate,
  animPackUrl,
  compatibleAnimPacks,
  onAnimPackChange,
  clipName,
  availableClipNames,
  onClipChange,
  onReset,
}: ViewerAnimHudProps) => (
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
    <div className="selectRow">
      <label>Animation pack</label>
      <select
        disabled={!canAnimate}
        value={animPackUrl ?? ''}
        onChange={(e) => onAnimPackChange(e.target.value || null)}
      >
        <option value="">(none)</option>
        {compatibleAnimPacks.map((p) => (
          <option key={p.path} value={p.url}>
            {p.path.split('/').slice(-1)[0] ?? p.path}
          </option>
        ))}
      </select>
    </div>
    <div className="selectRow">
      <label>Clip</label>
      <select
        disabled={!canAnimate || availableClipNames.length === 0}
        value={clipName ?? ''}
        onChange={(e) => onClipChange(e.target.value || null)}
      >
        <option value="">(none)</option>
        {availableClipNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
    {showTextureVariant && !canSwitchTexture ? (
      <div className="mutedNote">Texture variants unavailable for this asset.</div>
    ) : null}
    <div className="construct-hudFooter">
      <div className="mutedNote">
        {canAnimate ? null : 'Animation selector disabled (no bones/skin).'}
      </div>
      <button type="button" className="construct-hudResetBtn" onClick={onReset}>
        Reset
      </button>
    </div>
  </div>
);
