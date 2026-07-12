import { useState } from 'react';
import type { LevelLocalStoreEntry } from '../../storage/levelLocalStore.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

export type LoadLevelModalProps = {
  entries: LevelLocalStoreEntry[];
  onCancel: () => void;
  onSelect: (entry: LevelLocalStoreEntry) => void;
  onDelete: (entry: LevelLocalStoreEntry) => void;
};

export const LoadLevelModal = ({ entries, onCancel, onSelect, onDelete }: LoadLevelModalProps) => {
  const [pendingDelete, setPendingDelete] = useState<LevelLocalStoreEntry | null>(null);

  return (
    <>
      <div className="construct-modalBackdrop" role="presentation" onMouseDown={onCancel}>
        <div
          className="construct-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="construct-load-level-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="construct-modalTitle" id="construct-load-level-title">
            Load level
          </div>
          {entries.length === 0 ? (
            <div className="mutedNote">No levels saved in local storage.</div>
          ) : (
            <div className="construct-modalList">
              {entries.map((entry) => (
                <div key={entry.id} className="construct-modalListRow">
                  <button
                    type="button"
                    className="construct-modalListItem"
                    onClick={() => onSelect(entry)}
                  >
                    <span className="construct-modalListName">{entry.displayName}</span>
                    <span className="construct-subtle">{entry.id}.level</span>
                  </button>
                  <button
                    type="button"
                    className="construct-modalListDelete"
                    title={`Delete ${entry.displayName}`}
                    aria-label={`Delete ${entry.displayName}`}
                    onClick={() => setPendingDelete(entry)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="construct-modalActions">
            <button type="button" className="construct-modalBtn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {pendingDelete ? (
        <ConfirmModal
          title="Delete level"
          message={`Delete "${pendingDelete.displayName}" from local storage? This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const entry = pendingDelete;
            setPendingDelete(null);
            onDelete(entry);
          }}
        />
      ) : null}
    </>
  );
};
