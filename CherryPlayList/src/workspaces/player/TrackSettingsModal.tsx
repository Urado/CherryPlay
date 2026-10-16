import { Button, IconButton, FormInput, InfoIcon } from '@cherryplay/components';
import { ActionAfterTrack, isProjectGroup } from '@core/types/project';
import CloseIcon from '@mui/icons-material/Close';
import {
  clampLoudnessQuietGapRangeLu,
  clampLoudnessTargetLufs,
  LOUDNESS_QUIET_GAP_PRESETS,
  MAX_LOUDNESS_QUIET_GAP_RANGE_LU,
  MAX_TARGET_LUFS,
  MIN_LOUDNESS_QUIET_GAP_RANGE_LU,
  MIN_TARGET_LUFS,
  resolveQuietGapRangePercent,
} from '@shared/contracts/loudness';
import { useModalKeyboard } from '@shared/hooks';
import { usePlatformCapabilities } from '@shared/platform';
import { getItemPathRecursive, useProjectStore, useSettingsStore, useUIStore } from '@shared/stores';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export const TrackSettingsModal: React.FC = () => {
  const { closeModal, modal, trackSettingsContext } = useUIStore();
  const {
    items,
    settings,
    findItemById,
    setDefaultPauseBetweenTracks,
    setDefaultActionAfterTrack,
    getTrackSettings,
    setTrackSettings,
    getGroupSettings,
    setGroupSettings,
    setPlannedEndTime,
  } = useProjectStore();
  const {
    loudnessNormalizationEnabled,
    setLoudnessNormalizationEnabled,
    loudnessTargetLufs,
    setLoudnessTargetLufs,
    loudnessCompressionEnabled,
    setLoudnessCompressionEnabled,
    loudnessQuietGapRangeLu,
    setLoudnessQuietGapRangeLu,
  } = useSettingsStore();
  const { supportsLoudnessAnalysis } = usePlatformCapabilities();

  const { defaultPauseBetweenTracks, defaultActionAfterTrack, plannedEndTime } = settings;

  const trackId = trackSettingsContext.trackId;
  const groupId = trackSettingsContext.groupId;
  const isGlobal = trackSettingsContext.isGlobal;
  const itemPath = useMemo(
    () =>
      (groupId ? getItemPathRecursive(items, groupId) : trackId ? getItemPathRecursive(items, trackId) : null) ?? [],
    [groupId, items, trackId],
  );
  const ancestorGroupIds = useMemo(
    () =>
      itemPath
        .slice(0, -1)
        .filter((itemId) => {
          const item = findItemById(itemId);
          return item !== null && isProjectGroup(item);
        })
        .reverse(),
    [findItemById, itemPath],
  );

  const getInheritedGroupSettings = useCallback(() => {
    for (const ancestorId of ancestorGroupIds) {
      const ancestorSettings = getGroupSettings(ancestorId);
      if (ancestorSettings.actionAfterTrack !== null && ancestorSettings.actionAfterTrack !== undefined) {
        return {
          actionAfterTrack: ancestorSettings.actionAfterTrack,
          pauseBetweenTracks:
            ancestorSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks,
          hasInheritedGroupAction: true,
        };
      }
    }
    return {
      actionAfterTrack: defaultActionAfterTrack,
      pauseBetweenTracks: defaultPauseBetweenTracks,
      hasInheritedGroupAction: false,
    };
  }, [ancestorGroupIds, defaultActionAfterTrack, defaultPauseBetweenTracks, getGroupSettings]);

  const getResolvedSettings = useCallback(
    () => {
      if (isGlobal) {
        return {
          pauseBetweenTracks: defaultPauseBetweenTracks,
          actionAfterTrack: defaultActionAfterTrack,
        };
      }
      if (groupId) {
        const groupSettings = getGroupSettings(groupId);
        const inherited = getInheritedGroupSettings();
        return {
          actionAfterTrack: groupSettings.actionAfterTrack,
          pauseBetweenTracks:
            groupSettings.actionAfterTrack !== null && groupSettings.actionAfterTrack !== undefined
              ? groupSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks
              : inherited.pauseBetweenTracks,
        };
      }
      if (trackId) {
        const trackSettings = getTrackSettings(trackId);
        const hasTrackAction =
          trackSettings.actionAfterTrack !== null && trackSettings.actionAfterTrack !== undefined;
        const inherited = getInheritedGroupSettings();
        return {
          actionAfterTrack: trackSettings.actionAfterTrack,
          pauseBetweenTracks: hasTrackAction
            ? trackSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks
            : inherited.hasInheritedGroupAction
              ? inherited.pauseBetweenTracks
              : trackSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks,
        };
      }
      return {};
    },
    [
      isGlobal,
      groupId,
      trackId,
      defaultPauseBetweenTracks,
      defaultActionAfterTrack,
      getInheritedGroupSettings,
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

  const [localLoudnessNormalizationEnabled, setLocalLoudnessNormalizationEnabled] = useState(
    loudnessNormalizationEnabled,
  );
  const [localLoudnessTargetLufs, setLocalLoudnessTargetLufs] = useState(loudnessTargetLufs);
  const [localLoudnessCompressionEnabled, setLocalLoudnessCompressionEnabled] = useState(
    loudnessCompressionEnabled,
  );
  const [localLoudnessQuietGapRangeLu, setLocalLoudnessQuietGapRangeLu] =
    useState(loudnessQuietGapRangeLu);

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
    const isOpening = modal === 'trackSettings' && prevModalRef.current !== 'trackSettings';
    prevModalRef.current = modal;
    if (!isOpening) {
      return;
    }
    const resolved = getResolvedSettings();
    setLocalActionAfterTrack(resolved.actionAfterTrack || 'default');
    setLocalPauseBetweenTracks(resolved.pauseBetweenTracks ?? defaultPauseBetweenTracks);
    if (isGlobal) {
      setLocalPlannedEndTime(timestampToTimeString(plannedEndTime));
      setLocalLoudnessNormalizationEnabled(loudnessNormalizationEnabled);
      setLocalLoudnessTargetLufs(loudnessTargetLufs);
      setLocalLoudnessCompressionEnabled(loudnessCompressionEnabled);
      setLocalLoudnessQuietGapRangeLu(loudnessQuietGapRangeLu);
    }
  }, [
    modal,
    isGlobal,
    trackId,
    groupId,
    defaultPauseBetweenTracks,
    getResolvedSettings,
    plannedEndTime,
    loudnessNormalizationEnabled,
    loudnessTargetLufs,
    loudnessCompressionEnabled,
    loudnessQuietGapRangeLu,
  ]);

  const handleSave = useCallback(() => {
    if (isGlobal) {
      setDefaultActionAfterTrack(
        localActionAfterTrack === 'default' ? defaultActionAfterTrack : localActionAfterTrack,
      );
      setDefaultPauseBetweenTracks(effectivePause);
      setPlannedEndTime(timeStringToTimestamp(localPlannedEndTime));
      setLoudnessNormalizationEnabled(localLoudnessNormalizationEnabled);
      setLoudnessTargetLufs(clampLoudnessTargetLufs(localLoudnessTargetLufs));
      setLoudnessCompressionEnabled(
        localLoudnessNormalizationEnabled ? localLoudnessCompressionEnabled : false,
      );
      setLoudnessQuietGapRangeLu(clampLoudnessQuietGapRangeLu(localLoudnessQuietGapRangeLu));
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

    closeModal();
  }, [
    closeModal,
    defaultActionAfterTrack,
    defaultPauseBetweenTracks,
    effectivePause,
    groupId,
    isGlobal,
    localActionAfterTrack,
    localLoudnessCompressionEnabled,
    localLoudnessNormalizationEnabled,
    localLoudnessQuietGapRangeLu,
    localLoudnessTargetLufs,
    localPlannedEndTime,
    setDefaultActionAfterTrack,
    setDefaultPauseBetweenTracks,
    setGroupSettings,
    setLoudnessCompressionEnabled,
    setLoudnessNormalizationEnabled,
    setLoudnessQuietGapRangeLu,
    setLoudnessTargetLufs,
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

  const inheritedGroupSettings = getInheritedGroupSettings();
  const inheritedActionAfterTrack = inheritedGroupSettings.actionAfterTrack;
  const inheritedActionLabel =
    inheritedActionAfterTrack === 'next'
      ? 'Без паузы'
      : inheritedActionAfterTrack === 'pauseAndNext'
        ? 'Интервал между треками'
        : 'Пауза в конце трека';

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
          {!isGlobal && (
            <div className="settings-description">
              {groupId
                ? `Пустые настройки наследуют действие и интервал ближайшей родительской группы, которая задаёт действие, или глобальные значения. Сейчас: ${inheritedActionLabel}, ${inheritedGroupSettings.pauseBetweenTracks} сек. Индивидуальные настройки трека внутри группы имеют приоритет.`
                : 'Настройки этого трека имеют приоритет над настройками его группы и значениями по умолчанию.'}
            </div>
          )}
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
                {groupId ? 'Наследовать' : 'По умолчанию'} ({inheritedActionLabel})
              </option>
              <option value="pause">Пауза в конце трека</option>
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
            <>
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

              <div
                className="settings-section-title"
                style={{ marginTop: 8, marginBottom: 8, fontWeight: 600, fontSize: '0.95rem' }}
              >
                Нормализация громкости
              </div>

              <div className="settings-group">
                <div className="settings-checkbox-group">
                  <input
                    type="checkbox"
                    className="settings-checkbox"
                    checked={localLoudnessNormalizationEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setLocalLoudnessNormalizationEnabled(next);
                      if (!next) {
                        setLocalLoudnessCompressionEnabled(false);
                      }
                    }}
                    id="track-settings-loudness-normalization"
                    disabled={!supportsLoudnessAnalysis}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label
                      className="settings-checkbox-label"
                      htmlFor="track-settings-loudness-normalization"
                    >
                      Включить нормализацию
                    </label>
                    <InfoIcon
                      className="settings-info-icon"
                      title="Пересчитывает gain под текущую цель LUFS (не меняет файлы)."
                    />
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <FormInput
                  label="Целевая громкость (LUFS)"
                  id="track-settings-loudness-target"
                  className="settings-input--no-spinner"
                  type="number"
                  disabled={!localLoudnessNormalizationEnabled || !supportsLoudnessAnalysis}
                  min={MIN_TARGET_LUFS}
                  max={MAX_TARGET_LUFS}
                  step={0.5}
                  value={localLoudnessTargetLufs}
                  onChange={(e) => {
                    const next = e.target.valueAsNumber;
                    if (Number.isFinite(next)) {
                      setLocalLoudnessTargetLufs(clampLoudnessTargetLufs(next));
                    }
                  }}
                  hint={`Диапазон: ${MIN_TARGET_LUFS}…${MAX_TARGET_LUFS}`}
                />
              </div>

              <div className="settings-group">
                <div className="settings-checkbox-group">
                  <input
                    type="checkbox"
                    className="settings-checkbox"
                    checked={localLoudnessCompressionEnabled}
                    onChange={(e) => setLocalLoudnessCompressionEnabled(e.target.checked)}
                    id="track-settings-loudness-compression"
                    disabled={!localLoudnessNormalizationEnabled || !supportsLoudnessAnalysis}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label
                      className="settings-checkbox-label"
                      htmlFor="track-settings-loudness-compression"
                    >
                      Адаптивная компрессия
                    </label>
                    <InfoIcon
                      className="settings-info-icon"
                      title="Опциональная адаптивная компрессия по LRA и тихим участкам."
                    />
                  </div>
                </div>
                <div
                  className="settings-description"
                  style={{
                    marginTop: 4,
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary, #9e9e9e)',
                  }}
                >
                  Сила компрессии зависит от LRA и тихих участков трека.
                </div>
              </div>

              <div className="settings-group">
                <div className="settings-quiet-gap__header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label
                      className="settings-label"
                      htmlFor="track-settings-loudness-quiet-gap"
                      style={{ marginBottom: 0 }}
                    >
                      Терпимость к провалам громкости
                    </label>
                    <InfoIcon
                      className="settings-info-icon"
                      title="Порог (LU), при котором адаптивная компрессия достигает полной силы по тихим участкам. Меньше — агрессивнее; больше — мягче. Не меняет файлы."
                    />
                  </div>
                  <span className="settings-quiet-gap__value">
                    {localLoudnessQuietGapRangeLu.toFixed(0)} LU
                  </span>
                </div>
                <input
                  id="track-settings-loudness-quiet-gap"
                  type="range"
                  className="settings-quiet-gap__slider"
                  min={MIN_LOUDNESS_QUIET_GAP_RANGE_LU}
                  max={MAX_LOUDNESS_QUIET_GAP_RANGE_LU}
                  step={1}
                  value={localLoudnessQuietGapRangeLu}
                  disabled={
                    !localLoudnessNormalizationEnabled ||
                    !localLoudnessCompressionEnabled ||
                    !supportsLoudnessAnalysis
                  }
                  onChange={(e) => {
                    setLocalLoudnessQuietGapRangeLu(
                      clampLoudnessQuietGapRangeLu(Number(e.target.value)),
                    );
                  }}
                />
                <div className="settings-quiet-gap__scale">
                  <div className="settings-quiet-gap__scale-end">
                    <span className="settings-quiet-gap__scale-value">
                      {MIN_LOUDNESS_QUIET_GAP_RANGE_LU} LU
                    </span>
                    <span className="settings-quiet-gap__scale-hint">агрессивнее</span>
                  </div>
                  <div className="settings-quiet-gap__scale-end settings-quiet-gap__scale-end--right">
                    <span className="settings-quiet-gap__scale-value">
                      {MAX_LOUDNESS_QUIET_GAP_RANGE_LU} LU
                    </span>
                    <span className="settings-quiet-gap__scale-hint">мягче</span>
                  </div>
                </div>
                <div className="settings-quiet-gap__presets">
                  {LOUDNESS_QUIET_GAP_PRESETS.map((preset) => {
                    const leftPercent = resolveQuietGapRangePercent(preset.value);
                    const isActive = localLoudnessQuietGapRangeLu === preset.value;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`settings-quiet-gap__preset${
                          isActive ? ' settings-quiet-gap__preset--active' : ''
                        }`}
                        style={{ left: `${leftPercent}%` }}
                        disabled={
                          !localLoudnessNormalizationEnabled ||
                          !localLoudnessCompressionEnabled ||
                          !supportsLoudnessAnalysis
                        }
                        onClick={() => setLocalLoudnessQuietGapRangeLu(preset.value)}
                      >
                        <span className="settings-quiet-gap__preset-tick" />
                        <span className="settings-quiet-gap__preset-label">{preset.label}</span>
                        <span className="settings-quiet-gap__preset-value">{preset.value} LU</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
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
