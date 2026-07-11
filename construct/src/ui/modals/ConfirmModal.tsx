export type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ConfirmModal = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
}: ConfirmModalProps) => (
  <div className="construct-modalBackdrop" role="presentation" onMouseDown={onCancel}>
    <div
      className="construct-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="construct-confirm-title"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="construct-modalTitle" id="construct-confirm-title">
        {title}
      </div>
      <div className="construct-modalMessage">{message}</div>
      <div className="construct-modalActions">
        <button type="button" className="construct-modalBtn" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className="construct-modalBtn construct-modalBtnPrimary"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
