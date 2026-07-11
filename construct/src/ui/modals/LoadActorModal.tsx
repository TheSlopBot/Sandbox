import { useState } from 'react';
import type { ActorLocalStoreEntry } from '../../storage/actorLocalStore.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

export type LoadActorModalProps = {
  entries: ActorLocalStoreEntry[];
  onCancel: () => void;
  onSelect: (entry: ActorLocalStoreEntry) => void;
  onDelete: (entry: ActorLocalStoreEntry) => void;
};

export const LoadActorModal = ({
  entries,
  onCancel,
  onSelect,
  onDelete,
}: LoadActorModalProps) => {
  const [pendingDelete, setPendingDelete] = useState<ActorLocalStoreEntry | null>(null);

  return (
    <>
      <div className="construct-modalBackdrop" role="presentation" onMouseDown={onCancel}>
        <div
          className="construct-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="construct-load-actor-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="construct-modalTitle" id="construct-load-actor-title">
            Load actor
          </div>
          {entries.length === 0 ? (
            <div className="mutedNote">No actors saved in local storage.</div>
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
                    <span className="construct-subtle">{entry.id}.actor</span>
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
          title="Delete actor"
          message={`Delete “${pendingDelete.displayName}” from local storage? This cannot be undone.`}
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
