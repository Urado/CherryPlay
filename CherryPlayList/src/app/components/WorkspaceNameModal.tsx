import { Button, IconButton } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import React, { useId, useState, useCallback } from 'react';

import { useModalKeyboard } from '@shared/hooks';

export type WorkspaceNameModalMode = 'save-as' | 'rename';

export interface WorkspaceNameModalProps {
  open: boolean;
  mode: WorkspaceNameModalMode;
  initialName: string;
  existingNames: readonly string[];
  excludeName?: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

export const WorkspaceNameModal: React.FC<WorkspaceNameModalProps> = ({
  open,
  mode,
  initialName,
  existingNames,
  excludeName,
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const errorId = useId();

  const validate = useCallback(
    (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Введите название';
      }
      const isDuplicate =
        existingNames.some((existing) => existing === trimmed) && trimmed !== excludeName;
      if (isDuplicate) {
        return 'Рабочее пространство с таким именем уже существует';
      }
      return null;
    },
    [existingNames, excludeName],
  );

  const handleSubmit = useCallback(() => {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    onConfirm(name.trim());
  }, [name, onConfirm, validate]);

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: open,
    onCancel: onClose,
    onPrimary: handleSubmit,
  });

  if (!open) {
    return null;
  }

  const title = mode === 'save-as' ? 'Сохранить рабочее пространство как…' : 'Переименовать';

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
        className="modal-content workspace-name-modal"
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>
            {title}
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
          <label className="workspace-name-modal__field">
            <span className="workspace-name-modal__field-label">Название</span>
            <input
              type="text"
              className="workspace-name-modal__text-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) {
                  setError(validate(e.target.value));
                }
              }}
              placeholder="Введите название"
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? (
              <span className="workspace-name-modal__error" id={errorId} role="alert">
                {error}
              </span>
            ) : null}
          </label>
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
            onClick={handleSubmit}
            variant="primary"
            size="sm"
          >
            {mode === 'save-as' ? 'Сохранить' : 'Переименовать'}
          </Button>
        </div>
      </div>
    </div>
  );
};
