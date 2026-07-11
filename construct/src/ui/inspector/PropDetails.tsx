import { useEffect, useState } from 'react';
import {
  type PropDocumentPart,
  partTypeLabel,
} from '../../catalog/props/propDocument.ts';
import type { KaykitTextureVariant } from '../../catalog/manifest/kaykitManifest.ts';
import { createEulerQuat, quatToEulerDegrees } from './euler.ts';
import { TagList } from './TagList.tsx';
import { AxisRow, DetailsHeader } from './shared.tsx';

export type PropDetailsProps = {
  part: PropDocumentPart | null;
  propDisplayName: string;
  documentTags: readonly string[];
  textureVariants: KaykitTextureVariant[];
  textureVariantUrl: string | null;
  onRenameProp: () => void;
  onRename: (partId: string, name: string) => void;
  onCommitLocal: (
    partId: string,
    patch: {
      position?: [number, number, number];
      scale?: [number, number, number];
      rotation?: [number, number, number, number];
    },
  ) => void;
  onTextureVariantChange: (partId: string, url: string | null) => void;
  onTagsChange: (partId: string, tags: string[]) => void;
  onDelete: (partId: string) => void;
};

const PropNameHeader = ({
  propDisplayName,
  onRenameProp,
}: {
  propDisplayName: string;
  onRenameProp: () => void;
}) => (
  <DetailsHeader displayName={propDisplayName} renameLabel="Rename prop" onRename={onRenameProp} />
);

export const PropDetails = ({
  part,
  propDisplayName,
  documentTags,
  textureVariants,
  textureVariantUrl,
  onRenameProp,
  onRename,
  onCommitLocal,
  onTextureVariantChange,
  onTagsChange,
  onDelete,
}: PropDetailsProps) => {
  const [nameDraft, setNameDraft] = useState(part?.name ?? '');

  useEffect(() => {
    setNameDraft(part?.name ?? '');
  }, [part?.id, part?.name]);

  if (!part) {
    return (
      <div className="construct-inspector">
        <PropNameHeader propDisplayName={propDisplayName} onRenameProp={onRenameProp} />
        <div className="construct-inspectorBody">
          <div className="mutedNote">Select an element to edit details.</div>
        </div>
      </div>
    );
  }

  const euler = quatToEulerDegrees(part.rotation);
  const canSwitchTexture = part.kind === 'asset' && textureVariants.length > 0;
  const activeVariantUrl =
    part.kind === 'asset' ? (textureVariantUrl ?? part.textureVariantUrl ?? null) : null;

  const commitName = () => {
    const next = nameDraft.trim();
    if (!next || next === part.name) {
      setNameDraft(part.name);
      return;
    }
    onRename(part.id, next);
  };

  return (
    <div className="construct-inspector">
      <PropNameHeader
        propDisplayName={propDisplayName}
        onRenameProp={onRenameProp}
      />
      <div className="construct-inspectorBody construct-detailsBody">
        <label className="construct-detailsField">
          <span>Name</span>
          <input
            className="construct-detailsInput"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
        <div className="construct-detailsField">
          <span>Type</span>
          <span className="construct-detailsReadonly">{partTypeLabel(part)}</span>
        </div>
        <AxisRow
          label="Position"
          values={part.position}
          onCommit={(position) => onCommitLocal(part.id, { position })}
        />
        <AxisRow
          label="Scale"
          values={part.scale}
          onCommit={(scale) => onCommitLocal(part.id, { scale })}
        />
        <AxisRow
          label="Rotation"
          values={euler}
          onCommit={(degrees) => {
            const q = createEulerQuat(degrees);
            onCommitLocal(part.id, {
              rotation: [q[0]!, q[1]!, q[2]!, q[3]!],
            });
          }}
        />
        {part.kind === 'asset' ? (
          <>
            <div className="construct-detailsSection">
              <div className="construct-detailsSectionTitle">Variant</div>
              <select
                className="construct-detailsSelect"
                disabled={!canSwitchTexture}
                value={activeVariantUrl ?? ''}
                onChange={(e) => onTextureVariantChange(part.id, e.target.value || null)}
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
            <TagList
              tags={part.tags}
              documentTags={documentTags}
              onChange={(tags) => onTagsChange(part.id, tags)}
            />
          </>
        ) : null}
        <div className="construct-detailsFooter">
          <button
            type="button"
            className="construct-detailsDelete"
            onClick={() => onDelete(part.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
