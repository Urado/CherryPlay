import { Button, IconButton } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import React from 'react';

export interface LoudnessScanProgressModalProps {
  open: boolean;
  title: string;
  completed: number;
  total: number;
  currentTrackName: string | null;
  errorMessage?: string | null;
  onCancel: () => void;
}

export const LoudnessScanProgressModal: React.FC<LoudnessScanProgressModalProps> = ({
  open,
  title,
  completed,
  total,
  currentTrackName,
  errorMessage,
  onCancel,
}) => {
  if (!open) {
    return null;
  }

  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="modal-overlay loudness-scan-modal-overlay" role="presentation">
      <div className="modal-content loudness-scan-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <IconButton
            type="button"
            className="modal-close"
            onClick={onCancel}
            aria-label="Отмена"
            icon={<CloseIcon />}
            variant="ghost"
            size="md"
          />
        </div>

        <div className="modal-body">
          <p className="loudness-scan-modal__progress-text">
            {completed} / {total} ({progressPercent}%)
          </p>
          {currentTrackName && (
            <p className="loudness-scan-modal__track-name" title={currentTrackName}>
              {currentTrackName}
            </p>
          )}
          <div className="loudness-scan-modal__bar" aria-hidden="true">
            <div
              className="loudness-scan-modal__bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {errorMessage && <p className="loudness-scan-modal__error">{errorMessage}</p>}
        </div>

        <div className="modal-footer">
          <Button
            type="button"
            className="modal-button"
            onClick={onCancel}
            variant="secondary"
            size="sm"
          >
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
};
