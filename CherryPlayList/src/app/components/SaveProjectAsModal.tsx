import CloseIcon from '@mui/icons-material/Close';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import React, { useId, useState, useCallback } from 'react';

import { useModalKeyboard } from '@shared/hooks';

export interface SaveProjectAsModalProps {
  open: boolean;
  isSaving: boolean;
  initialProjectName: string;
  initialDirectory: string;
  onRequestDirectory: (currentDirectory: string) => Promise<string | null>;
  onClose: () => void;
  onConfirm: (payload: {
    portable: boolean;
    projectName: string;
    targetDirectory: string;
  }) => void | Promise<void>;
}

/**
 * Диалог «Сохранить как…»: имя проекта, папка назначения и вариант переносимого пакета.
 */
export const SaveProjectAsModal: React.FC<SaveProjectAsModalProps> = ({
  open,
  isSaving,
  initialProjectName,
  initialDirectory,
  onRequestDirectory,
  onClose,
  onConfirm,
}) => {
  const [portable, setPortable] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [projectName, setProjectName] = useState(initialProjectName);
  const [targetDirectory, setTargetDirectory] = useState(initialDirectory);
  const titleId = useId();
  const infoButtonId = useId();
  const infoPanelId = useId();

  const handleConfirm = useCallback(() => {
    void onConfirm({
      portable,
      projectName: projectName.trim(),
      targetDirectory: targetDirectory.trim(),
    });
  }, [onConfirm, portable, projectName, targetDirectory]);

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: open && !isSaving,
    onCancel: onClose,
    onPrimary: handleConfirm,
    primaryDisabled: isSaving,
  });

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isSaving) {
      onClose();
    }
  };

  const handlePickDirectory = async () => {
    const selected = await onRequestDirectory(targetDirectory);
    if (selected) {
      setTargetDirectory(selected);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Закрыть диалог сохранения"
    >
      <div
        className="modal-content save-project-as-modal"
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>
            Сохранить проект как…
          </h2>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <label className="save-project-as-modal__field">
            <span className="save-project-as-modal__field-label">Имя проекта</span>
            <input
              type="text"
              className="save-project-as-modal__text-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isSaving}
              placeholder="Введите имя проекта"
            />
          </label>

          <label className="save-project-as-modal__field">
            <span className="save-project-as-modal__field-label">Папка назначения</span>
            <div className="save-project-as-modal__path-row">
              <input
                type="text"
                className="save-project-as-modal__text-input save-project-as-modal__path-input"
                value={targetDirectory}
                onChange={(e) => setTargetDirectory(e.target.value)}
                disabled={isSaving}
                placeholder="Выберите или введите путь к папке"
              />
              <button
                type="button"
                className="save-project-as-modal__browse"
                onClick={() => {
                  void handlePickDirectory();
                }}
                disabled={isSaving}
                title="Выбрать папку"
              >
                <FolderOpenIcon style={{ fontSize: 20 }} />
              </button>
            </div>
          </label>

          <label className="save-project-as-modal__portable-label">
            <input
              type="checkbox"
              checked={portable}
              onChange={(e) => setPortable(e.target.checked)}
              disabled={isSaving}
            />
            <span>Переносимый проект</span>
            <button
              type="button"
              id={infoButtonId}
              className="save-project-as-modal__info"
              onClick={() => setInfoExpanded((v) => !v)}
              disabled={isSaving}
              aria-expanded={infoExpanded}
              aria-controls={infoPanelId}
              title="Что это значит"
            >
              <InfoOutlinedIcon className="save-project-as-modal__info-icon" aria-hidden />
              <span className="visually-hidden">Справка о переносимом проекте</span>
            </button>
          </label>

          {infoExpanded && (
            <div
              className="save-project-as-modal__info-panel"
              id={infoPanelId}
              role="region"
              aria-labelledby={infoButtonId}
            >
              <p className="save-project-as-modal__info-lead">
                Копия всех аудиофайлов рядом с файлом проекта, пути в .cherry становятся
                относительными — можно переносить всю папку.
              </p>
              <ul className="save-project-as-modal__info-list">
                <li>создаётся папка с именем проекта (как в заголовке);</li>
                <li>внутри — файл .cherry и вложенная папка tracks с копиями треков;</li>
                <li>коллекции отражаются в структуре подпапок в tracks;</li>
                <li>при любой ошибке копирования операция прерывается, успех не показывается.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="modal-button secondary"
            type="button"
            onClick={onClose}
            disabled={isSaving}
          >
            Отмена
          </button>
          <button
            className="modal-button primary"
            type="button"
            disabled={isSaving}
            onClick={handleConfirm}
          >
            {isSaving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};
