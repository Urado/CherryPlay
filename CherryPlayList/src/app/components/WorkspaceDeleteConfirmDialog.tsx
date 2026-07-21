import { Button, IconButton } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import React, { useId } from 'react';

import { useModalKeyboard } from '@shared/hooks';

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

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: open,
    onCancel: onClose,
    onPrimary: onConfirm,
  });

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
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
          <IconButton
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            icon={<CloseIcon />}
            variant="ghost"
            size="md"
          />
        </div>

        <div className="modal-body">
          <p className="workspace-delete-dialog__message" id={descriptionId}>
            Рабочее пространство «{workspaceName}» будет удалено без возможности восстановления.
          </p>
        </div>

        <div className="modal-footer">
          <Button
            className="modal-button"
            type="button"
            onClick={onClose}
            variant="secondary"
            size="sm"
          >
            Отмена
          </Button>
          <Button
            className="modal-button"
            type="button"
            onClick={onConfirm}
            variant="danger"
            size="sm"
          >
            Удалить
          </Button>
        </div>
      </div>
    </div>
  );
};
