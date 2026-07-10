import { useEffect, useState } from 'react';
import {
  type PropDocumentPart,
  partTypeLabel,
} from '../../catalog/props/propDocument.ts';
import type { KaykitTextureVariant } from '../../catalog/manifest/kaykitManifest.ts';
import { createEulerQuat, quatToEulerDegrees } from './euler.ts';

export type PropDetailsProps = {
  part: PropDocumentPart | null;
  textureVariants: KaykitTextureVariant[];
  textureVariantUrl: string | null;
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

export const PropDetails = ({
  part,
  textureVariants,
  textureVariantUrl,
  onRename,
  onCommitLocal,
  onTextureVariantChange,
  onDelete,
}: PropDetailsProps) => {
  const [nameDraft, setNameDraft] = useState(part?.name ?? '');

  useEffect(() => {
    setNameDraft(part?.name ?? '');
  }, [part?.id, part?.name]);

  if (!part) {
    return (
      <div className="construct-inspector">
        <div className="construct-inspectorHeader">
          <span>Details</span>
        </div>
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
      <div className="construct-inspectorHeader">
        <span>Details</span>
        <span className="construct-subtle">{part.kind}</span>
      </div>
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
