import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type TagModalProps = {
  existingTags: readonly string[];
  currentTags: readonly string[];
  onCancel: () => void;
  onPick: (tag: string) => void;
};

export const TagModal = ({
  existingTags,
  currentTags,
  onCancel,
  onPick,
}: TagModalProps) => {
  const [draft, setDraft] = useState('');
  const current = new Set(currentTags);
  const available = existingTags.filter((t) => !current.has(t));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const trimmed = draft.trim();
  const canCreate = trimmed.length > 0 && !current.has(trimmed);

  return createPortal(
    <div className="construct-modalBackdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="construct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="construct-tag-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="construct-modalTitle" id="construct-tag-title">
          Add tag
        </div>
        {available.length > 0 ? (
          <div className="construct-modalList">
            {available.map((tag) => (
              <button
                key={tag}
                type="button"
                className="construct-modalListItem"
                onClick={() => onPick(tag)}
              >
                <span className="construct-modalListName">{tag}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mutedNote">No unused tags on this document yet.</div>
        )}
        <label className="construct-modalField">
          <span>New tag</span>
          <input
            className="construct-detailsInput"
            value={draft}
            placeholder="weapon"
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) onPick(trimmed);
            }}
          />
        </label>
        <div className="construct-modalActions">
          <button type="button" className="construct-modalBtn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="construct-modalBtn construct-modalBtnPrimary"
            disabled={!canCreate}
            onClick={() => {
              if (canCreate) onPick(trimmed);
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
