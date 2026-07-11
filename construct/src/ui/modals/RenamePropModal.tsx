import { useEffect, useRef, useState } from 'react';

export type RenamePropModalProps = {
  initialName: string;
  title?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

export const RenamePropModal = ({
  initialName,
  title = 'Name prop',
  confirmLabel = 'Save',
  onCancel,
  onConfirm,
}: RenamePropModalProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(initialName === 'Untitled Prop' ? '' : initialName);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const trimmed = name.trim();
  const canConfirm = trimmed.length > 0;

  const submit = () => {
    if (!canConfirm) return;
    onConfirm(trimmed);
  };

  return (
    <div className="construct-modalBackdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="construct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="construct-rename-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="construct-modalTitle" id="construct-rename-title">
          {title}
        </div>
        <label className="construct-modalField">
          <span>Name</span>
          <input
            ref={inputRef}
            className="construct-detailsInput"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onCancel();
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
            disabled={!canConfirm}
            onClick={submit}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
