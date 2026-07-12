import { useEffect, useRef, useState } from 'react';
import { type LevelDocumentGroup } from '../../catalog/levels/levelDocument.ts';

export type GroupModalProps = {
  groups: LevelDocumentGroup[];
  selectedCount: number;
  showExistingGroups: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
  onAssign: (groupId: string) => void;
  onUngroup: () => void;
};

export const GroupModal = ({
  groups,
  selectedCount,
  showExistingGroups,
  onCancel,
  onCreate,
  onAssign,
  onUngroup,
}: GroupModalProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('Group');
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const canCreate = name.trim().length > 0;
  const canAssign = showExistingGroups && groupId.length > 0;

  return (
    <div className="construct-modalBackdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="construct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="construct-group-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="construct-modalTitle" id="construct-group-title">
          Group
        </div>
        <div className="mutedNote">{selectedCount} element(s) selected.</div>
        <label className="construct-modalField">
          <span>New group name</span>
          <input
            ref={inputRef}
            className="construct-detailsInput"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) onCreate(name.trim());
              if (e.key === 'Escape') onCancel();
            }}
          />
        </label>
        {showExistingGroups && groups.length > 0 ? (
          <label className="construct-modalField">
            <span>Add to existing group</span>
            <select
              className="construct-detailsSelect"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="construct-modalActions">
          <button type="button" className="construct-modalBtn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="construct-modalBtn" onClick={onUngroup}>
            Ungroup
          </button>
          {showExistingGroups && groups.length > 0 ? (
            <button
              type="button"
              className="construct-modalBtn"
              disabled={!canAssign}
              onClick={() => onAssign(groupId)}
            >
              Add
            </button>
          ) : null}
          <button
            type="button"
            className="construct-modalBtn construct-modalBtnPrimary"
            disabled={!canCreate}
            onClick={() => onCreate(name.trim())}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
