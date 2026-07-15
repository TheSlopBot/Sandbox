import { useState } from 'react';
import type { EquipmentLocalStoreEntry } from '../../storage/equipmentLocalStore.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

export type LoadEquipmentModalProps = {
  entries: EquipmentLocalStoreEntry[];
  onCancel: () => void;
  onSelect: (entry: EquipmentLocalStoreEntry) => void;
  onDelete: (entry: EquipmentLocalStoreEntry) => void;
};

export const LoadEquipmentModal = ({
  entries,
  onCancel,
  onSelect,
  onDelete,
}: LoadEquipmentModalProps) => {
  const [pendingDelete, setPendingDelete] = useState<EquipmentLocalStoreEntry | null>(null);

  return (
    <>
      <div className="construct-modalBackdrop" role="presentation" onMouseDown={onCancel}>
        <div
          className="construct-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="construct-load-equipment-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="construct-modalTitle" id="construct-load-equipment-title">
            Load equipment
          </div>
          {entries.length === 0 ? (
            <div className="mutedNote">No equipment saved in local storage.</div>
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
                    <span className="construct-subtle">{entry.id}.equipment</span>
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
          title="Delete equipment"
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
