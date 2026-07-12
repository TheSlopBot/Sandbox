import { useRef, useState } from 'react';
import { type LevelLocalStoreEntry } from '../../storage/levelLocalStore.ts';
import './levelSelectModal.css';

export type LevelSelectModalProps = {
  entries: LevelLocalStoreEntry[];
  currentLevelId: string | null;
  switching: boolean;
  onSelect: (levelId: string) => void;
  onImportFiles: (files: FileList) => Promise<{ imported: string[]; errors: string[] }>;
  onClose: () => void;
};

export const LevelSelectModal = ({
  entries,
  currentLevelId,
  switching,
  onSelect,
  onImportFiles,
  onClose,
}: LevelSelectModalProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const handleImportFiles = (files: FileList) => {
    setImportErrors([]);
    void onImportFiles(files).then((result) => {
      if (result.errors.length > 0) setImportErrors(result.errors);
    });
  };

  return (
    <div className="level-select-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="level-select-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-select-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="level-select-modal__header">
          <span id="level-select-modal-title" className="level-select-modal__title">
            Select Level
          </span>
          <button type="button" className="level-select-modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>

        {entries.length === 0 ? (
          <p className="level-select-modal__empty">No levels available.</p>
        ) : (
          <ul className="level-select-modal__list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="level-select-modal__item"
                  data-active={entry.id === currentLevelId}
                  disabled={switching}
                  onClick={() => onSelect(entry.id)}
                >
                  <span className="level-select-modal__item-name">{entry.displayName}</span>
                  <span className="level-select-modal__item-id">{entry.id}.level</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {importErrors.length > 0 ? (
          <ul className="level-select-modal__errors">
            {importErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}

        <footer className="level-select-modal__footer">
          <button type="button" className="level-select-modal__button" onClick={() => fileInputRef.current?.click()}>
            Import .level files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".level,application/json"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files;
              e.target.value = '';
              if (files && files.length > 0) handleImportFiles(files);
            }}
          />
        </footer>
      </div>
    </div>
  );
};
