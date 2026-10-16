import {
  DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  type PartyTrackDisplaySettings,
  type PartyTrackStripLeadingMode,
} from '@core/types/project';
import {
  applyPartyTrackDisplayToTrackName,
  normalizePartyTrackDisplaySettings,
} from '@shared/utils/partyUtils';
import React, { useMemo } from 'react';

import {
  PARTY_TRACK_DELIMITER_PRESET_CUSTOM,
  PARTY_TRACK_DELIMITER_PRESETS,
  partyTrackDelimiterCharFromPreset,
  resolvePartyTrackDelimiterPresetId,
  type PartyTrackDelimiterPresetId,
} from './partyTrackDelimiterPresets';
import './PartyTrackDisplaySection.css';

const PREVIEW_SAMPLE_NAME = '01 — Название трека';

const resolveDisplaySettings = (
  value: PartyTrackDisplaySettings | Partial<PartyTrackDisplaySettings> | undefined,
): PartyTrackDisplaySettings =>
  normalizePartyTrackDisplaySettings({
    stripLeadingCharsEnabled:
      value?.stripLeadingCharsEnabled ??
      DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS.stripLeadingCharsEnabled,
    stripLeadingCharsMode:
      value?.stripLeadingCharsMode ?? DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS.stripLeadingCharsMode,
    stripLeadingCharsCount:
      value?.stripLeadingCharsCount ?? DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS.stripLeadingCharsCount,
    stripLeadingCharsDelimiter:
      value?.stripLeadingCharsDelimiter ??
      DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS.stripLeadingCharsDelimiter,
  });

export interface PartyTrackDisplaySectionProps {
  value: PartyTrackDisplaySettings | Partial<PartyTrackDisplaySettings> | undefined;
  onChange: (next: PartyTrackDisplaySettings) => void;
}

export const PartyTrackDisplaySection: React.FC<PartyTrackDisplaySectionProps> = ({
  value,
  onChange,
}) => {
  const display = resolveDisplaySettings(value);
  const previewName = useMemo(
    () => applyPartyTrackDisplayToTrackName(PREVIEW_SAMPLE_NAME, display),
    [display],
  );

  const mode: PartyTrackStripLeadingMode =
    display.stripLeadingCharsMode === 'untilDelimiter' ? 'untilDelimiter' : 'count';

  const delimiterPresetId = resolvePartyTrackDelimiterPresetId(display.stripLeadingCharsDelimiter);
  const showCustomDelimiterInput = delimiterPresetId === PARTY_TRACK_DELIMITER_PRESET_CUSTOM;

  return (
    <section className="party-track-display-section">
      <p className="party-track-display-section__hint">
        Учитывается в превью и в именах треков при публикации плейлиста на сервер. Файлы и проект не
        переименовываются.
      </p>
      <div className="party-track-display-section__controls">
        <label className="party-track-display-section__row">
          <input
            type="checkbox"
            checked={display.stripLeadingCharsEnabled}
            onChange={(e) =>
              onChange({ ...display, stripLeadingCharsEnabled: e.target.checked })
            }
          />
          <span>Скрыть символы с начала имени трека</span>
        </label>

        <fieldset
          className="party-track-display-section__mode-fieldset"
          disabled={!display.stripLeadingCharsEnabled}
        >
          <legend className="party-track-display-section__legend">Способ скрытия</legend>
          <label className="party-track-display-section__row">
            <input
              type="radio"
              name="party-track-strip-mode"
              checked={mode === 'count'}
              onChange={() => onChange({ ...display, stripLeadingCharsMode: 'count' })}
            />
            <span>Число символов</span>
          </label>
          <label className="party-track-display-section__row">
            <input
              type="radio"
              name="party-track-strip-mode"
              checked={mode === 'untilDelimiter'}
              onChange={() => onChange({ ...display, stripLeadingCharsMode: 'untilDelimiter' })}
            />
            <span>До символа</span>
          </label>
        </fieldset>

        {mode === 'count' ? (
          <label className="party-track-display-section__row party-track-display-section__row--number">
            <span className="party-track-display-section__label">Символов с начала</span>
            <input
              type="number"
              className="party-track-display-section__input"
              min={0}
              max={10_000}
              step={1}
              disabled={!display.stripLeadingCharsEnabled}
              value={display.stripLeadingCharsCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onChange({
                  ...display,
                  stripLeadingCharsCount: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
                });
              }}
            />
          </label>
        ) : (
          <>
            <div className="party-track-display-section__row party-track-display-section__row--number">
              <label
                className="party-track-display-section__label"
                htmlFor="party-track-strip-delimiter-preset"
              >
                Разделитель
              </label>
              <select
                id="party-track-strip-delimiter-preset"
                className="party-track-display-section__select"
                disabled={!display.stripLeadingCharsEnabled}
                value={delimiterPresetId}
                onChange={(e) => {
                  const nextPreset = e.target.value as PartyTrackDelimiterPresetId;
                  const presetChar = partyTrackDelimiterCharFromPreset(nextPreset);
                  if (presetChar != null) {
                    onChange({ ...display, stripLeadingCharsDelimiter: presetChar });
                    return;
                  }
                  const fallback =
                    display.stripLeadingCharsDelimiter.length > 0
                      ? display.stripLeadingCharsDelimiter.slice(0, 1)
                      : DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS.stripLeadingCharsDelimiter;
                  onChange({ ...display, stripLeadingCharsDelimiter: fallback });
                }}
              >
                {PARTY_TRACK_DELIMITER_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
                <option value={PARTY_TRACK_DELIMITER_PRESET_CUSTOM}>Другой символ</option>
              </select>
            </div>
            {showCustomDelimiterInput ? (
              <label className="party-track-display-section__row party-track-display-section__row--number">
                <span className="party-track-display-section__label">Свой символ</span>
                <input
                  type="text"
                  className="party-track-display-section__input party-track-display-section__input--delimiter"
                  maxLength={1}
                  disabled={!display.stripLeadingCharsEnabled}
                  value={display.stripLeadingCharsDelimiter}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next.length === 0) {
                      return;
                    }
                    onChange({
                      ...display,
                      stripLeadingCharsDelimiter: next.slice(0, 1),
                    });
                  }}
                />
              </label>
            ) : null}
          </>
        )}

        <div className="party-track-display-section__preview" aria-live="polite">
          <span className="party-track-display-section__preview-label">Пример:</span>
          <span className="party-track-display-section__preview-sample">{PREVIEW_SAMPLE_NAME}</span>
          <span className="party-track-display-section__preview-arrow" aria-hidden>
            →
          </span>
          <span className="party-track-display-section__preview-result">{previewName}</span>
          {mode === 'untilDelimiter' && display.stripLeadingCharsEnabled ? (
            <span className="party-track-display-section__preview-note">
              Разделитель в результат не попадает.
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
};
