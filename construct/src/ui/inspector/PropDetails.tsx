import { useEffect, useState } from 'react';
import {
  type PropDocumentPart,
  partTypeLabel,
} from '../../catalog/props/propDocument.ts';
import type { KaykitTextureVariant } from '../../catalog/manifest/kaykitManifest.ts';
import { createEulerQuat, quatToEulerDegrees } from './euler.ts';
import { TagList } from './TagList.tsx';

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

const formatNum = (n: number) => {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
};

const parseNum = (raw: string, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const AxisRow = ({
  label,
  values,
  onCommit,
}: {
  label: string;
  values: [number, number, number];
  onCommit: (next: [number, number, number]) => void;
}) => {
  const [draft, setDraft] = useState<[string, string, string]>([
    formatNum(values[0]),
    formatNum(values[1]),
    formatNum(values[2]),
  ]);

  useEffect(() => {
    setDraft([formatNum(values[0]), formatNum(values[1]), formatNum(values[2])]);
  }, [values[0], values[1], values[2]]);

  const commitAxis = (index: 0 | 1 | 2) => {
    const next: [number, number, number] = [
      parseNum(draft[0], values[0]),
      parseNum(draft[1], values[1]),
      parseNum(draft[2], values[2]),
    ];
    next[index] = parseNum(draft[index], values[index]);
    setDraft([formatNum(next[0]), formatNum(next[1]), formatNum(next[2])]);
    onCommit(next);
  };

  return (
    <div className="construct-detailsSection">
      <div className="construct-detailsSectionTitle">{label}</div>
      <div className="construct-xyzRow">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <label key={axis} className="construct-xyzField">
            <span>{axis}</span>
            <input
              className="construct-detailsInput"
              value={draft[i]!}
              onChange={(e) => {
                const next: [string, string, string] = [...draft];
                next[i] = e.target.value;
                setDraft(next);
              }}
              onBlur={() => commitAxis(i as 0 | 1 | 2)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
};

const PropNameHeader = ({
  propDisplayName,
  onRenameProp,
}: {
  propDisplayName: string;
  onRenameProp: () => void;
}) => (
  <div className="construct-inspectorHeader">
    <span>Details</span>
    <span className="construct-propNameRow">
      <span className="construct-subtle construct-propNameText" title={propDisplayName}>
        {propDisplayName}
      </span>
      <button
        type="button"
        className="construct-iconBtn"
        title="Rename prop"
        aria-label="Rename prop"
        onClick={onRenameProp}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M11.7 1.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-8.5 8.5-3.2.8a.5.5 0 0 1-.6-.6l.8-3.2 8.5-8.5ZM3.4 11.1l-.4 1.5 1.5-.4 7.4-7.4-1.1-1.1-7.4 7.4Z"
          />
        </svg>
      </button>
    </span>
  </div>
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
