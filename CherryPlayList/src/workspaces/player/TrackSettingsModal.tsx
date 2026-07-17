import { Button, IconButton } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { ActionAfterTrack } from '@core/types/project';
import { useModalKeyboard } from '@shared/hooks';
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

  const handleSave = useCallback(() => {
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
  }, [
    addNotification,
    closeModal,
    defaultActionAfterTrack,
    defaultPauseBetweenTracks,
    effectivePause,
    groupId,
    isGlobal,
    localActionAfterTrack,
    localPlannedEndTime,
    setDefaultActionAfterTrack,
    setDefaultPauseBetweenTracks,
    setGroupSettings,
    setPlannedEndTime,
    setTrackSettings,
    trackId,
  ]);

  const handleCancel = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: modal === 'trackSettings',
    onCancel: handleCancel,
    onPrimary: handleSave,
  });

  if (modal !== 'trackSettings') {
    return null;
  }

  const handlePauseInputFocus = () => {
    if (localPauseBetweenTracks === defaultPauseBetweenTracks) {
      setLocalPauseBetweenTracks('');
    }
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  const getTitle = () => {
    if (isGlobal) return 'Настройки по умолчанию';
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
          <IconButton
            className="modal-close"
            type="button"
            onClick={handleCancel}
            aria-label="Закрыть"
            icon={<CloseIcon />}
            variant="ghost"
            size="md"
          />
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
                  ? 'Без паузы'
                  : defaultActionAfterTrack === 'pauseAndNext'
                    ? 'Интервал между треками'
                    : 'Остановка после трека'}
                )
              </option>
              <option value="pause">Остановка после трека</option>
              <option value="next">Без паузы</option>
              <option value="pauseAndNext">Интервал между треками</option>
            </select>
          </div>

          {showPauseInput && (
            <div className="settings-group">
              <label className="settings-label" htmlFor="track-settings-pause">
                Интервал между треками (секунды)
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
              <label
                className="settings-label"
                htmlFor="track-settings-planned-end-time"
                title="Красная отметка на таймлайне плейлиста"
              >
                Плановое окончание
              </label>
              <div className="settings-planned-end-row">
                <input
                  type="time"
                  className="settings-input settings-input--planned-end"
                  value={localPlannedEndTime}
                  onChange={(e) => setLocalPlannedEndTime(e.target.value)}
                  id="track-settings-planned-end-time"
                />
                <Button
                  type="button"
                  className="modal-button settings-planned-end-clear"
                  onClick={() => {
                    setLocalPlannedEndTime('');
                    setPlannedEndTime(null);
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Очистить
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button className="modal-button" onClick={handleCancel} variant="secondary" size="sm">
            Отмена
          </Button>
          <Button className="modal-button" onClick={handleSave} variant="primary" size="sm">
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
};
