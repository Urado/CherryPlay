import { ActionAfterTrack } from '@core/types/project';
import { useProjectStore, getItemPathRecursive } from '@shared/stores';
import { buildAnchorPanelStyle } from '@shared/utils/anchorPanelLayout';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export const TRACK_SETTINGS_DROPDOWN_WIDTH = 280;

interface TrackSettingsDropdownProps {
  itemId: string;
  isGroup: boolean;
  anchorRect: DOMRect;
  getEffectiveTrackSettings: (trackId: string) => {
    actionAfterTrack: ActionAfterTrack;
    pauseBetweenTracks: number;
  };
  onClose: () => void;
}

export const TrackSettingsDropdown: React.FC<TrackSettingsDropdownProps> = ({
  itemId,
  isGroup,
  anchorRect,
  getEffectiveTrackSettings,
  onClose,
}) => {
  const {
    items,
    settings,
    getTrackSettings,
    setTrackSettings,
    getGroupSettings,
    setGroupSettings,
  } = useProjectStore();

  const { defaultPauseBetweenTracks } = settings;
  const itemSettings = isGroup ? getGroupSettings(itemId) : getTrackSettings(itemId);
  const itemPath = getItemPathRecursive(items, itemId) ?? [];
  const ancestorGroupIds = itemPath.slice(0, -1).reverse();
  let inheritedPauseBetweenTracks = defaultPauseBetweenTracks;

  for (const ancestorGroupId of ancestorGroupIds) {
    const ancestorSettings = getGroupSettings(ancestorGroupId);
    if (
      ancestorSettings.actionAfterTrack !== null &&
      ancestorSettings.actionAfterTrack !== undefined
    ) {
      inheritedPauseBetweenTracks =
        ancestorSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks;
      break;
    }
  }

  const hasItemAction =
    itemSettings.actionAfterTrack !== null && itemSettings.actionAfterTrack !== undefined;
  const effectiveTrackSettings = isGroup ? null : getEffectiveTrackSettings(itemId);
  const resolvedPause = hasItemAction
    ? (itemSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks)
    : isGroup
      ? inheritedPauseBetweenTracks
      : (effectiveTrackSettings?.pauseBetweenTracks ??
        itemSettings.pauseBetweenTracks ??
        defaultPauseBetweenTracks);

  const [localActionAfterTrack, setLocalActionAfterTrack] = useState<ActionAfterTrack | 'default'>(
    itemSettings.actionAfterTrack || 'default',
  );
  const [localPauseBetweenTracks, setLocalPauseBetweenTracks] = useState<number | ''>(
    resolvedPause,
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
      const nextSettings = {
        actionAfterTrack: action === 'default' ? null : action,
        pauseBetweenTracks:
          action === 'pauseAndNext' && pause !== defaultPauseBetweenTracks ? pause : null,
      };

      if (isGroup) {
        setGroupSettings(itemId, nextSettings);
      } else {
        setTrackSettings(itemId, nextSettings);
      }
    },
    [
      defaultPauseBetweenTracks,
      effectivePause,
      isGroup,
      itemId,
      setGroupSettings,
      setTrackSettings,
    ],
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
      setLocalActionAfterTrack('pauseAndNext');
      setLocalPauseBetweenTracks(sec);
      applyImmediate('pauseAndNext', sec);
    },
    [applyImmediate],
  );

  const handlePauseInputFocus = useCallback(() => {
    if (resolvedPause === defaultPauseBetweenTracks && localPauseBetweenTracks === resolvedPause) {
      setLocalPauseBetweenTracks('');
    }
  }, [defaultPauseBetweenTracks, localPauseBetweenTracks, resolvedPause]);

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
      title: 'По умолчанию',
    },
    { value: 'pause', label: 'Пауза в конце трека', title: 'Пауза в конце трека' },
    { value: 'next', label: 'Без паузы', title: 'Сразу следующий трек' },
    { value: 'pauseAndNext', label: 'Интервал', title: 'Интервал между треками' },
  ];

  const style = buildAnchorPanelStyle({
    anchorRect,
    panelWidth: TRACK_SETTINGS_DROPDOWN_WIDTH,
  });

  const content = (
    <div
      ref={panelRef}
      className="track-settings-dropdown"
      style={style}
      role="dialog"
      aria-label="Настройки тайминга"
    >
      <div className="track-settings-dropdown__body">
        {isGroup && (
          <div
            className="track-settings-dropdown__description"
            style={{
              marginBottom: 8,
              fontSize: '0.82rem',
              lineHeight: 1.35,
              color: 'var(--text-secondary, #9e9e9e)',
            }}
          >
            Действие применяется ко всем трекам группы. Индивидуальные настройки треков имеют
            приоритет.
          </div>
        )}
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
