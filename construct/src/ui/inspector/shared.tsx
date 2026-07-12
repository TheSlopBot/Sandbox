import { useEffect, useState } from 'react';

export const formatNum = (n: number) => {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
};

export const parseNum = (raw: string, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export type AxisKey = 'x' | 'y' | 'z';

export type AxisRowProps = {
  label: string;
  values: [number, number, number];
  onCommit: (next: [number, number, number]) => void;
  disabledAxes?: readonly AxisKey[];
};

const AXIS_KEYS: readonly AxisKey[] = ['x', 'y', 'z'];

export const AxisRow = ({ label, values, onCommit, disabledAxes }: AxisRowProps) => {
  const [draft, setDraft] = useState<[string, string, string]>([
    formatNum(values[0]),
    formatNum(values[1]),
    formatNum(values[2]),
  ]);

  useEffect(() => {
    setDraft([formatNum(values[0]), formatNum(values[1]), formatNum(values[2])]);
  }, [values[0], values[1], values[2]]);

  const isDisabled = (index: 0 | 1 | 2) => !!disabledAxes?.includes(AXIS_KEYS[index]!);

  const commitAxis = (index: 0 | 1 | 2) => {
    if (isDisabled(index)) {
      setDraft([formatNum(values[0]), formatNum(values[1]), formatNum(values[2])]);
      return;
    }

    const next: [number, number, number] = [
      isDisabled(0) ? values[0] : parseNum(draft[0], values[0]),
      isDisabled(1) ? values[1] : parseNum(draft[1], values[1]),
      isDisabled(2) ? values[2] : parseNum(draft[2], values[2]),
    ];
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
              disabled={isDisabled(i as 0 | 1 | 2)}
              onChange={(e) => {
                const next: [string, string, string] = [...draft];
                next[i] = e.target.value;
                setDraft(next);
              }}
              onBlur={() => commitAxis(i as 0 | 1 | 2)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
};

export type DetailsHeaderProps = {
  displayName: string;
  renameLabel: string;
  onRename: () => void;
};

export const DetailsHeader = ({ displayName, renameLabel, onRename }: DetailsHeaderProps) => (
  <div className="construct-inspectorHeader">
    <span>Details</span>
    <span className="construct-propNameRow">
      <span className="construct-subtle construct-propNameText" title={displayName}>
        {displayName}
      </span>
      <button
        type="button"
        className="construct-iconBtn"
        title={renameLabel}
        aria-label={renameLabel}
        onClick={onRename}
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
