import CloseIcon from '@mui/icons-material/Close';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { ActionAfterTrack } from '@core/types/project';
import { useProjectStore, useUIStore } from '@shared/stores';

export const TrackSettingsModal: React.FC = () => {
  const { closeModal, addNotification, modal, trackSettingsContext } = useUIStore();
  const {
    settings,
    setDefaultPauseBetweenTracks,
    setDefaultActionAfterTrack,
    getTrackSettings,
    setTrackSettings,
    getGroupSettings,
    setGroupSettings,
    setPlannedEndTime,
  } = useProjectStore();

  const { defaultPauseBetweenTracks, defaultActionAfterTrack, plannedEndTime } = settings;

  const trackId = trackSettingsContext.trackId;
  const groupId = trackSettingsContext.groupId;
  const isGlobal = trackSettingsContext.isGlobal;

  const getResolvedSettings = useCallback(
    () =>
      isGlobal
        ? {
            pauseBetweenTracks: defaultPauseBetweenTracks,
            actionAfterTrack: defaultActionAfterTrack,
          }
        : groupId
          ? getGroupSettings(groupId)
          : trackId
            ? getTrackSettings(trackId)
            : {},
    [
      isGlobal,
      groupId,
      trackId,
      defaultPauseBetweenTracks,
      defaultActionAfterTrack,
      getGroupSettings,
      getTrackSettings,
    ],
  );

  const [localActionAfterTrack, setLocalActionAfterTrack] = useState<ActionAfterTrack | 'default'>(
    () => getResolvedSettings().actionAfterTrack || 'default',
  );
  const [localPauseBetweenTracks, setLocalPauseBetweenTracks] = useState<number | ''>(
    () => getResolvedSettings().pauseBetweenTracks ?? defaultPauseBetweenTracks,
  );

  const effectivePause =
    typeof localPauseBetweenTracks === 'number'
      ? localPauseBetweenTracks
      : defaultPauseBetweenTracks;

  const timestampToTimeString = (timestamp: number | null): string => {
    if (timestamp === null) return '';
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const timeStringToTimestamp = (timeString: string): number | null => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    const today = new Date();
    today.setHours(hours, minutes, 0, 0);
    return today.getTime();
  };

  const [localPlannedEndTime, setLocalPlannedEndTime] = useState<string>(
    timestampToTimeString(plannedEndTime),
  );

  const prevModalRef = useRef<string | null>(null);

  useEffect(() => {
    if (modal === 'trackSettings' && prevModalRef.current !== 'trackSettings') {
      const timeoutId = setTimeout(() => {
        const resolved = getResolvedSettings();
        setLocalActionAfterTrack(resolved.actionAfterTrack || 'default');
        setLocalPauseBetweenTracks(resolved.pauseBetweenTracks ?? defaultPauseBetweenTracks);
        if (isGlobal) {
          setLocalPlannedEndTime(timestampToTimeString(plannedEndTime));
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    prevModalRef.current = modal;
  }, [
    modal,
    isGlobal,
    trackId,
    groupId,
    defaultPauseBetweenTracks,
    getResolvedSettings,
    plannedEndTime,
  ]);

  if (modal !== 'trackSettings') {
    return null;
  }

  const handleSave = () => {
    if (isGlobal) {
      setDefaultActionAfterTrack(
        localActionAfterTrack === 'default' ? defaultActionAfterTrack : localActionAfterTrack,
      );
      setDefaultPauseBetweenTracks(effectivePause);
      setPlannedEndTime(timeStringToTimestamp(localPlannedEndTime));
    } else if (groupId) {
      setGroupSettings(groupId, {
        actionAfterTrack: localActionAfterTrack === 'default' ? null : localActionAfterTrack,
        pauseBetweenTracks: effectivePause === defaultPauseBetweenTracks ? null : effectivePause,
      });
    } else if (trackId) {
      setTrackSettings(trackId, {
        actionAfterTrack: localActionAfterTrack === 'default' ? null : localActionAfterTrack,
        pauseBetweenTracks: effectivePause === defaultPauseBetweenTracks ? null : effectivePause,
      });
    }

    addNotification({ type: 'success', message: 'Настройки сохранены' });
    closeModal();
  };

  const handlePauseInputFocus = () => {
    if (localPauseBetweenTracks === defaultPauseBetweenTracks) {
      setLocalPauseBetweenTracks('');
    }
  };

  const handleCancel = () => {
    closeModal();
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  const handleOverlayKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  };

  const getTitle = () => {
    if (isGlobal) return 'Глобальные настройки';
    if (groupId) return 'Настройки группы';
    return 'Настройки трека';
  };

  const showPauseInput = localActionAfterTrack === 'pauseAndNext';

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close track settings modal"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">{getTitle()}</h2>
          <button className="modal-close" onClick={handleCancel}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-group">
            <label className="settings-label" htmlFor="track-settings-action">
              Действие после трека
            </label>
            <select
              className="settings-select"
              value={localActionAfterTrack}
              onChange={(e) =>
                setLocalActionAfterTrack(e.target.value as ActionAfterTrack | 'default')
              }
              id="track-settings-action"
            >
              <option value="default">
                По умолчанию (
                {defaultActionAfterTrack === 'next'
                  ? 'Сплошное воспроизведение'
                  : defaultActionAfterTrack === 'pauseAndNext'
                    ? 'Пауза между треками'
                    : 'Пауза после трека'}
                )
              </option>
              <option value="pause">Пауза после трека</option>
              <option value="next">Сплошное воспроизведение</option>
              <option value="pauseAndNext">Пауза между треками</option>
            </select>
          </div>

          {showPauseInput && (
            <div className="settings-group">
              <label className="settings-label" htmlFor="track-settings-pause">
                Пауза между треками (секунды)
              </label>
              <input
                type="number"
                className="settings-input settings-input--no-spinner"
                value={localPauseBetweenTracks}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setLocalPauseBetweenTracks('');
                  } else {
                    setLocalPauseBetweenTracks(Number(v) || 0);
                  }
                }}
                onFocus={handlePauseInputFocus}
                id="track-settings-pause"
                min="0"
                step="1"
              />
            </div>
          )}

          {isGlobal && (
            <div className="settings-group">
              <label className="settings-label" htmlFor="track-settings-planned-end-time">
                Плановое время окончания
              </label>
              <div className="settings-planned-end-row">
                <input
                  type="time"
                  className="settings-input settings-input--planned-end"
                  value={localPlannedEndTime}
                  onChange={(e) => setLocalPlannedEndTime(e.target.value)}
                  id="track-settings-planned-end-time"
                />
                <button
                  type="button"
                  className="modal-button secondary settings-planned-end-clear"
                  onClick={() => {
                    setLocalPlannedEndTime('');
                    setPlannedEndTime(null);
                  }}
                >
                  Очистить
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-button secondary" onClick={handleCancel}>
            Отмена
          </button>
          <button className="modal-button primary" onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
