import CloseIcon from '@mui/icons-material/Close';
import React, { useId } from 'react';

export interface WorkspaceDeleteConfirmDialogProps {
  open: boolean;
  workspaceName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const WorkspaceDeleteConfirmDialog: React.FC<WorkspaceDeleteConfirmDialogProps> = ({
  open,
  workspaceName,
  onClose,
  onConfirm,
}) => {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleOverlayKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Закрыть диалог"
    >
      <div
        className="modal-content workspace-delete-dialog"
        role="alertdialog"
        aria-modal
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>
            Удалить рабочее пространство?
          </h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <p className="workspace-delete-dialog__message" id={descriptionId}>
            Рабочее пространство «{workspaceName}» будет удалено без возможности восстановления.
          </p>
        </div>

        <div className="modal-footer">
          <button className="modal-button secondary" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="modal-button danger" type="button" onClick={onConfirm}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
};
