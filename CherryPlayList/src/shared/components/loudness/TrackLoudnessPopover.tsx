import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Track, TrackLoudness } from '@core/types/track';
import { getEffectiveGainDb } from '@shared/audio/loudnessGain';
import {
  getEffectiveCompressionStrength,
  resolveAutoCompressionStrength,
  resolveQuietPassageLufs,
} from '@shared/audio/playback/compressionStrength';
import { MAX_TRACK_GAIN_DB, MIN_TRACK_GAIN_DB } from '@shared/audio/playback/effects';
import { useSettingsStore } from '@shared/stores/settingsStore';
import {
  ANCHOR_PANEL_Z_INDEX,
  resolveAnchorPanelCenterY,
  resolveAnchorPanelLeft,
} from '@shared/utils/anchorPanelLayout';
import { formatGainDb } from '@shared/utils/formatGainDb';

export type TrackLoudnessVisualState = 'ok' | 'pending' | 'unscanned' | 'error';

export const LOUDNESS_METRIC_LABEL_GAIN = 'G';
export const LOUDNESS_METRIC_LABEL_COMPRESSION = 'CR';

export const LOUDNESS_POPOVER_LABEL_GAIN = 'Gain';
export const LOUDNESS_POPOVER_LABEL_COMPRESSION = 'Compression ratio';

export const LOUDNESS_POPOVER_WIDTH = 320;

export const MANUAL_GAIN_DB_MIN = MIN_TRACK_GAIN_DB;
export const MANUAL_GAIN_DB_MAX = MAX_TRACK_GAIN_DB;
export const MANUAL_GAIN_DB_STEP = 0.5;

export const MANUAL_COMPRESSION_MIN = 0;
export const MANUAL_COMPRESSION_MAX = 100;
export const MANUAL_COMPRESSION_STEP = 1;

const HINT_GAIN = [
  'Насколько громче или тише играет трек при воспроизведении (не меняет сам файл).',
  '0 dB — без дополнительного усиления от нормализации; отрицательные значения приглушают, положительные усиливают.',
  '«Авто» ниже — расчёт по скану под целевой LUFS из настроек; слайдером можно переопределить для этого трека.',
  'Изменения применяются сразу, пока трек играет.',
].join(' ');

function hintIntegratedLufs(targetLufs: number): string {
  return [
    'Средняя громкость всего трека по стандарту EBU R128 (измеряется при скане FFmpeg).',
    `Чем ниже значение, тем тише трек в среднем; цель нормализации — ${targetLufs} LUFS (настраивается в параметрах приложения).`,
    'Разница между этим числом и целью определяет, насколько сильно трек нужно поднять или опустить.',
  ].join(' ');
}

const HINT_TRUE_PEAK = [
  'Максимальный пик громкости в файле (dBTP — true peak, с учётом межсэмпловых пиков).',
  'Авто-усиление ограничивается так, чтобы после нормализации пик не превысил −1 dBTP (запас от клиппинга).',
  'Если пик уже близок к 0 dB, трек могут сделать тише, а не громче — даже при низкой integrated LUFS.',
].join(' ');

const HINT_LRA = [
  'LRA (Loudness Range) — насколько сильно внутри трека отличаются тихие и громкие фрагменты, в LU.',
  'Маленький LRA: ровный трек (например, уже сжатый мастерингом). Большой LRA: выраженные тихие и громкие части.',
  'Используется для оценки «тихих участков», если отдельное значение LRA low недоступно.',
].join(' ');

function hintQuietPassages(hasLraLow: boolean): string {
  if (hasLraLow) {
    return [
      'Громкость самых тихих ~10% фрагмента трека (LRA low из ebur128).',
      'Это не средняя по треку, а «дно» динамики — тихие куплеты, паузы, затухания.',
      'Чем ниже относительно целевого LUFS, тем сильнее может включиться адаптивная компрессия (если она включена в настройках).',
    ].join(' ');
  }
  return [
    'Оценка громкости тихих участков, когда в метаданных нет LRA low (старый скан).',
    'Считается по integrated LUFS и LRA или по фиксированному смещению от средней.',
    'После перескана трека значение станет точнее.',
  ].join(' ');
}

function hintCalculatedGain(targetLufs: number): string {
  return [
    `Усиление, которое приложение рассчитало при скане, чтобы подвести трек к ${targetLufs} LUFS.`,
    'Учитывается запас по true peak (−1 dBTP): итоговое авто-усиление — минимум из «подгонки по LUFS» и «лимита по пику».',
    'Слайдер «Gain» выше заменяет это значение; «Выставить авто» под слайдером подставляет расчётное значение.',
  ].join(' ');
}

const HINT_COMPRESSION = [
  'Сила адаптивной компрессии для этого трека (0–100%), если компрессия включена в настройках.',
  'Растёт, когда авто-усиление большое и тихие участки заметно ниже целевого уровня — после подъёма gain они могут звучать слишком контрастно.',
  '0% — компрессор в обходе; 100% — максимальное сглаживание пиков при сохранении общей громкости.',
  'Слайдер заменяет авто-расчёт для этого трека; «Выставить авто» под слайдером подставляет текущее расчётное значение.',
].join(' ');

export function getTrackLoudnessVisualState(
  loudness: TrackLoudness | undefined,
): TrackLoudnessVisualState {
  if (!loudness) {
    return 'unscanned';
  }
  if (loudness.status === 'pending') {
    return 'pending';
  }
  if (loudness.status === 'ok') {
    return 'ok';
  }
  return 'error';
}

type FieldInfoIconProps = {
  hint: string;
  label?: string;
};

function FieldInfoIcon({ hint, label = 'Справка' }: FieldInfoIconProps) {
  return (
    <button
      type="button"
      className="track-loudness-popover__info"
      title={hint}
      aria-label={`${label}: ${hint}`}
    >
      <InfoOutlinedIcon className="track-loudness-popover__info-icon" aria-hidden />
    </button>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
  hint: string;
};

function DetailRow({ label, value, hint }: DetailRowProps) {
  return (
    <div className="track-loudness-popover__detail">
      <div className="track-loudness-popover__detail-row">
        <dt className="track-loudness-popover__detail-label">
          <span>{label}</span>
          <FieldInfoIcon hint={hint} label={label} />
        </dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

interface TrackLoudnessPopoverProps {
  track: Track;
  anchorRect: DOMRect;
  anchorRef: React.RefObject<HTMLElement | null>;
  canScan: boolean;
  onClose: () => void;
  onScan: () => void;
  onManualGainChange: (manualGainDb: number | undefined) => void;
  onManualCompressionChange: (manualCompressionStrength: number | undefined) => void;
}

export const TrackLoudnessPopover: React.FC<TrackLoudnessPopoverProps> = ({
  track,
  anchorRect,
  anchorRef,
  canScan,
  onClose,
  onScan,
  onManualGainChange,
  onManualCompressionChange,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const detailsPanelId = useId();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [pinnedTop, setPinnedTop] = useState<number | null>(null);
  const loudnessSettings = useSettingsStore((state) => ({
    loudnessNormalizationEnabled: state.loudnessNormalizationEnabled,
    loudnessTargetLufs: state.loudnessTargetLufs,
    loudnessCompressionEnabled: state.loudnessCompressionEnabled,
  }));
  const loudness = track.loudness;
  const visualState = getTrackLoudnessVisualState(loudness);
  const effectiveGainDb = getEffectiveGainDb(track);
  const autoGainDb = loudness?.status === 'ok' ? loudness.trackGainDb : undefined;
  const sliderGainDb = effectiveGainDb ?? autoGainDb ?? 0;
  const autoCompressionStrength =
    loudness?.status === 'ok' ? resolveAutoCompressionStrength(track, loudnessSettings) : 0;
  const effectiveCompressionStrength =
    loudness?.status === 'ok' ? getEffectiveCompressionStrength(track, loudnessSettings) : 0;
  const sliderCompressionPercent = Math.round(effectiveCompressionStrength * 100);
  const quietPassageLufs =
    loudness?.status === 'ok' ? resolveQuietPassageLufs(loudness) : undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const target = event.target as Node;
      if (panel.contains(target)) {
        return;
      }
      if (anchorRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [anchorRef, onClose]);

  const commitManualGain = (value: number) => {
    const clamped = Math.min(MANUAL_GAIN_DB_MAX, Math.max(MANUAL_GAIN_DB_MIN, value));

    if (autoGainDb !== undefined && Math.abs(clamped - autoGainDb) < 0.05) {
      onManualGainChange(undefined);
      return;
    }

    onManualGainChange(clamped);
  };

  const commitManualCompression = (percent: number) => {
    const clamped = Math.min(
      MANUAL_COMPRESSION_MAX,
      Math.max(MANUAL_COMPRESSION_MIN, Math.round(percent)),
    );
    const strength = clamped / 100;

    if (Math.abs(strength - autoCompressionStrength) < 0.005) {
      onManualCompressionChange(undefined);
      return;
    }

    onManualCompressionChange(strength);
  };

  const applyAutoGain = () => {
    if (autoGainDb === undefined) {
      return;
    }
    onManualGainChange(autoGainDb);
  };

  const applyAutoCompression = () => {
    onManualCompressionChange(autoCompressionStrength);
  };

  const anchorCenterY = resolveAnchorPanelCenterY(anchorRect);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || pinnedTop !== null) {
      return;
    }

    setPinnedTop(anchorCenterY - panel.offsetHeight / 2);
  }, [anchorCenterY, pinnedTop]);

  const style: React.CSSProperties = {
    position: 'fixed',
    left: resolveAnchorPanelLeft(anchorRect, LOUDNESS_POPOVER_WIDTH),
    top: pinnedTop ?? anchorCenterY,
    transform: pinnedTop === null ? 'translateY(-50%)' : undefined,
    zIndex: ANCHOR_PANEL_Z_INDEX,
    width: LOUDNESS_POPOVER_WIDTH,
    boxSizing: 'border-box',
  };

  const canAdjustGain = visualState === 'ok' || effectiveGainDb !== undefined;
  const canAdjustCompression = loudnessSettings.loudnessCompressionEnabled && visualState === 'ok';
  const targetLufs = loudnessSettings.loudnessTargetLufs;
  const showTechnicalDetails = visualState === 'ok' && loudness;

  const content = (
    <div
      ref={panelRef}
      className="track-loudness-popover"
      style={style}
      role="dialog"
      aria-label="Громкость трека"
    >
      <div className="track-loudness-popover__header">
        <span className="track-loudness-popover__title">Нормализация громкости</span>
        <div className="track-loudness-popover__header-actions">
          <span
            className={`track-loudness-popover__state track-loudness-popover__state--${visualState}`}
          >
            {visualState === 'ok'
              ? 'Готово'
              : visualState === 'pending'
                ? 'Сканирование…'
                : visualState === 'error'
                  ? 'Ошибка'
                  : 'Не сканирован'}
          </span>
          <button
            type="button"
            className="track-loudness-popover__close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <CloseIcon style={{ fontSize: '18px' }} />
          </button>
        </div>
      </div>

      <div className="track-loudness-popover__body">
        {canAdjustGain && (
          <div className="track-loudness-popover__manual">
            <div className="track-loudness-popover__manual-header">
              <div className="track-loudness-popover__label-with-info">
                <label htmlFor={`track-gain-${track.id}`}>{LOUDNESS_POPOVER_LABEL_GAIN}</label>
                <FieldInfoIcon label={LOUDNESS_POPOVER_LABEL_GAIN} hint={HINT_GAIN} />
              </div>
              <span className="track-loudness-popover__manual-value">
                {formatGainDb(sliderGainDb)} dB
              </span>
            </div>
            <input
              id={`track-gain-${track.id}`}
              type="range"
              className="track-loudness-popover__slider"
              min={MANUAL_GAIN_DB_MIN}
              max={MANUAL_GAIN_DB_MAX}
              step={MANUAL_GAIN_DB_STEP}
              value={sliderGainDb}
              onChange={(event) => commitManualGain(Number(event.target.value))}
            />
            {autoGainDb !== undefined && (
              <button
                type="button"
                className="track-loudness-popover__auto-set"
                onClick={applyAutoGain}
              >
                Выставить авто ({formatGainDb(autoGainDb)} dB)
              </button>
            )}
          </div>
        )}

        {canAdjustCompression && (
          <div className="track-loudness-popover__manual">
            <div className="track-loudness-popover__manual-header">
              <div className="track-loudness-popover__label-with-info">
                <label htmlFor={`track-compression-${track.id}`}>
                  {LOUDNESS_POPOVER_LABEL_COMPRESSION}
                </label>
                <FieldInfoIcon label={LOUDNESS_POPOVER_LABEL_COMPRESSION} hint={HINT_COMPRESSION} />
              </div>
              <span className="track-loudness-popover__manual-value">
                {sliderCompressionPercent}%
              </span>
            </div>
            <input
              id={`track-compression-${track.id}`}
              type="range"
              className="track-loudness-popover__slider"
              min={MANUAL_COMPRESSION_MIN}
              max={MANUAL_COMPRESSION_MAX}
              step={MANUAL_COMPRESSION_STEP}
              value={sliderCompressionPercent}
              onChange={(event) => commitManualCompression(Number(event.target.value))}
            />
            <button
              type="button"
              className="track-loudness-popover__auto-set"
              onClick={applyAutoCompression}
            >
              Выставить авто ({Math.round(autoCompressionStrength * 100)}%)
            </button>
          </div>
        )}

        {showTechnicalDetails ? (
          <div className="track-loudness-popover__accordion">
            <button
              type="button"
              className="track-loudness-popover__accordion-toggle"
              aria-expanded={detailsExpanded}
              aria-controls={detailsPanelId}
              onClick={() => setDetailsExpanded((expanded) => !expanded)}
            >
              <span>Технические данные</span>
              {detailsExpanded ? (
                <ExpandLessIcon className="track-loudness-popover__accordion-icon" aria-hidden />
              ) : (
                <ExpandMoreIcon className="track-loudness-popover__accordion-icon" aria-hidden />
              )}
            </button>
            {detailsExpanded && (
              <dl className="track-loudness-popover__details" id={detailsPanelId}>
                <DetailRow
                  label="Интегрированная громкость"
                  value={`${loudness.integratedLufs?.toFixed(1) ?? '—'} LUFS`}
                  hint={hintIntegratedLufs(targetLufs)}
                />
                <DetailRow
                  label="Истинный пик"
                  value={`${loudness.truePeakDb?.toFixed(1) ?? '—'} dBTP`}
                  hint={HINT_TRUE_PEAK}
                />
                {loudness.lraLu !== undefined && (
                  <DetailRow
                    label="Диапазон громкости (LRA)"
                    value={`${loudness.lraLu.toFixed(1)} LU`}
                    hint={HINT_LRA}
                  />
                )}
                {quietPassageLufs !== undefined && (
                  <DetailRow
                    label="Тихие участки"
                    value={`${quietPassageLufs.toFixed(1)} LUFS`}
                    hint={hintQuietPassages(loudness.lraLowLufs !== undefined)}
                  />
                )}
                {autoGainDb !== undefined && (
                  <DetailRow
                    label="Расчётное усиление"
                    value={`${formatGainDb(autoGainDb)} dB`}
                    hint={hintCalculatedGain(targetLufs)}
                  />
                )}
                {loudnessSettings.loudnessCompressionEnabled &&
                  effectiveCompressionStrength > 0 && (
                    <DetailRow
                      label={LOUDNESS_POPOVER_LABEL_COMPRESSION}
                      value={`${Math.round(effectiveCompressionStrength * 100)}%`}
                      hint={HINT_COMPRESSION}
                    />
                  )}
              </dl>
            )}
          </div>
        ) : visualState === 'error' && loudness?.errorMessage ? (
          <p className="track-loudness-popover__error">{loudness.errorMessage}</p>
        ) : visualState === 'pending' ? (
          <p className="track-loudness-popover__hint">Идёт анализ громкости…</p>
        ) : (
          !canAdjustGain && (
            <p className="track-loudness-popover__hint">
              Трек ещё не проанализирован. Нажмите «Сканировать», чтобы рассчитать нормализацию.
            </p>
          )
        )}
      </div>

      {canScan && visualState !== 'pending' && (
        <div className="track-loudness-popover__footer">
          <button type="button" className="modal-button secondary" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="modal-button primary" onClick={onScan}>
            Сканировать
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};
