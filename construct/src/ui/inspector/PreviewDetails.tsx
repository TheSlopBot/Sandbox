import type { KaykitManifestEntry, KaykitTextureVariant } from '../../catalog/manifest/kaykitManifest.ts';

export type PreviewDetailsProps = {
  entry: KaykitManifestEntry | null;
  textureVariants: KaykitTextureVariant[];
  textureVariantUrl: string | null;
  onTextureVariantChange: (url: string | null) => void;
};

export const PreviewDetails = ({
  entry,
  textureVariants,
  textureVariantUrl,
  onTextureVariantChange,
}: PreviewDetailsProps) => {
  if (!entry) {
    return (
      <div className="construct-inspector construct-info">
        <div className="construct-inspectorHeader">
          <span>Details</span>
        </div>
        <div className="construct-inspectorBody">
          <div className="mutedNote">Select a file to see details.</div>
        </div>
      </div>
    );
  }

  const canSwitchTexture = textureVariants.length > 0;

  return (
    <div className="construct-inspector construct-info">
      <div className="construct-inspectorHeader">
        <span>Details</span>
        <span className="construct-subtle">{entry.kind}</span>
      </div>
      <div className="construct-inspectorBody construct-detailsBody">
        <div className="fieldGrid">
          <div className="fieldLabel">Kind</div>
          <div className="fieldValue">{entry.kind}</div>
          <div className="fieldLabel">Path</div>
          <div className="fieldValue">{entry.path}</div>
        </div>
        <div className="construct-detailsSection">
          <div className="construct-detailsSectionTitle">Variant</div>
          <select
            className="construct-detailsSelect"
            disabled={!canSwitchTexture}
            value={textureVariantUrl ?? ''}
            onChange={(e) => onTextureVariantChange(e.target.value || null)}
          >
            <option value="">Default</option>
            {textureVariants.map((v) => (
              <option key={v.url} value={v.url}>
                {v.label}
              </option>
            ))}
          </select>
          {!canSwitchTexture ? (
            <div className="mutedNote">Texture variants unavailable for this asset.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
