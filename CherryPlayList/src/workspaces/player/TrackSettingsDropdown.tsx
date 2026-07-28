import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { ActionAfterTrack } from '@core/types/project';
import { useProjectStore } from '@shared/stores';

interface TrackSettingsDropdownProps {
  trackId: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

export const TrackSettingsDropdown: React.FC<TrackSettingsDropdownProps> = ({
  trackId,
  anchorRect,
  onClose,
}) => {
  const { settings, getTrackSettings, setTrackSettings } = useProjectStore();

  const { defaultPauseBetweenTracks, defaultActionAfterTrack } = settings;
  const currentSettings = getTrackSettings(trackId);

  const [localActionAfterTrack, setLocalActionAfterTrack] = useState<ActionAfterTrack | 'default'>(
    currentSettings.actionAfterTrack || 'default',
  );
  const [localPauseBetweenTracks, setLocalPauseBetweenTracks] = useState<number | ''>(
    currentSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks,
  );

  const panelRef = useRef<HTMLDivElement>(null);

  const effectivePause =
    typeof localPauseBetweenTracks === 'number'
      ? localPauseBetweenTracks
      : defaultPauseBetweenTracks;

  const applyImmediate = useCallback(
    (action: ActionAfterTrack | 'default', pauseSec?: number) => {
      const pause =
        action === 'pauseAndNext' ? (pauseSec ?? effectivePause) : defaultPauseBetweenTracks;
      setTrackSettings(trackId, {
        actionAfterTrack: action === 'default' ? null : action,
        pauseBetweenTracks:
          action === 'pauseAndNext' && pause !== defaultPauseBetweenTracks ? pause : null,
      });
    },
    [trackId, defaultPauseBetweenTracks, effectivePause, setTrackSettings],
  );

  const handleSelect = useCallback(
    (value: ActionAfterTrack | 'default') => {
      setLocalActionAfterTrack(value);
      applyImmediate(value, value === 'pauseAndNext' ? effectivePause : undefined);
      onClose();
    },
    [applyImmediate, effectivePause, onClose],
  );

  const handlePauseSecChange = useCallback(
    (sec: number) => {
      setLocalPauseBetweenTracks(sec);
      applyImmediate('pauseAndNext', sec);
    },
    [applyImmediate],
  );

  const handlePauseInputFocus = useCallback(() => {
    if (localPauseBetweenTracks === defaultPauseBetweenTracks) {
      setLocalPauseBetweenTracks('');
    }
  }, [localPauseBetweenTracks, defaultPauseBetweenTracks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const t = setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(t);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const actions: { value: ActionAfterTrack | 'default'; label: string; title: string }[] = [
    {
      value: 'default',
      label: 'По умолчанию',
      title: `По умолчанию (${defaultActionAfterTrack === 'next' ? 'Без паузы' : defaultActionAfterTrack === 'pauseAndNext' ? 'Интервал' : 'Пауза'})`,
    },
    { value: 'pause', label: 'Пауза в конце трека', title: 'Пауза в конце трека' },
    { value: 'next', label: 'Без паузы', title: 'Сразу следующий трек' },
    { value: 'pauseAndNext', label: 'Интервал', title: 'Интервал между треками' },
  ];

  const gap = 4;
  const estimatedWidth = 280;
  let left = anchorRect.right + gap;
  if (left + estimatedWidth > window.innerWidth) {
    left = anchorRect.left - estimatedWidth - gap;
  }
  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    top: anchorRect.top + anchorRect.height / 2,
    transform: 'translateY(-50%)',
    zIndex: 1001,
    minWidth: 220,
    maxWidth: 280,
  };

  const content = (
    <div
      ref={panelRef}
      className="track-settings-dropdown"
      style={style}
      role="dialog"
      aria-label="Настройки трека"
    >
      <div className="track-settings-dropdown__body">
        <ul className="track-settings-dropdown__list">
          {actions.map(({ value, label, title }) => (
            <li key={value} className="track-settings-dropdown__item">
              {value === 'pauseAndNext' ? (
                <div
                  className={`track-settings-dropdown__row ${localActionAfterTrack === value ? 'track-settings-dropdown__row--active' : ''}`}
                >
                  <button
                    type="button"
                    className="track-settings-dropdown__row-action"
                    title={title}
                    onClick={() => handleSelect(value)}
                  >
                    {label}
                  </button>
                  <input
                    type="number"
                    className="track-settings-dropdown__input"
                    value={localPauseBetweenTracks}
                    onChange={(e) => {
                      e.stopPropagation();
                      const v = e.target.value;
                      if (v === '') {
                        setLocalPauseBetweenTracks('');
                      } else {
                        handlePauseSecChange(Number(v) || 0);
                      }
                    }}
                    onFocus={handlePauseInputFocus}
                    onClick={(e) => e.stopPropagation()}
                    min={0}
                    step={1}
                    title="Секунды паузы"
                  />
                  <span className="track-settings-dropdown__suffix">сек</span>
                </div>
              ) : (
                <button
                  type="button"
                  className={`track-settings-dropdown__row track-settings-dropdown__btn ${localActionAfterTrack === value ? 'track-settings-dropdown__row--active' : ''}`}
                  onClick={() => handleSelect(value)}
                  title={title}
                >
                  {label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
