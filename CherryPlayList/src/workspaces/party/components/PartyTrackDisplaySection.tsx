
import type { PartyTrackDisplaySettings, PartyTrackStripLeadingMode } from '@core/types/project';
import { applyPartyTrackDisplayToTrackName } from '@shared/utils/partyUtils';
import React, { useMemo } from 'react';

import { PartyEditorAccordion } from './PartyEditorAccordion';
import {
  PARTY_TRACK_DELIMITER_PRESET_CUSTOM,
  PARTY_TRACK_DELIMITER_PRESETS,
  partyTrackDelimiterCharFromPreset,
  resolvePartyTrackDelimiterPresetId,
  type PartyTrackDelimiterPresetId,
} from './partyTrackDelimiterPresets';
import './PartyTrackDisplaySection.css';

const PREVIEW_SAMPLE_NAME = '01 — Название трека';

export interface PartyTrackDisplaySectionProps {
  value: PartyTrackDisplaySettings;
  onChange: (next: PartyTrackDisplaySettings) => void;
  defaultExpanded?: boolean;
}

export const PartyTrackDisplaySection: React.FC<PartyTrackDisplaySectionProps> = ({
  value,
  onChange,
  defaultExpanded = false,
}) => {
  const previewName = useMemo(
    () => applyPartyTrackDisplayToTrackName(PREVIEW_SAMPLE_NAME, value),
    [value],
  );

  const mode: PartyTrackStripLeadingMode =
    value.stripLeadingCharsMode === 'untilDelimiter' ? 'untilDelimiter' : 'count';

  const delimiterPresetId = resolvePartyTrackDelimiterPresetId(value.stripLeadingCharsDelimiter);
  const showCustomDelimiterInput = delimiterPresetId === PARTY_TRACK_DELIMITER_PRESET_CUSTOM;

  return (
    <PartyEditorAccordion
      title="Отображение треков"
      defaultExpanded={defaultExpanded}
      className="party-track-display-section"
    >
      <p className="party-track-display-section__hint">
        Учитывается в превью и в именах треков при публикации плейлиста на сервер. Файлы и проект не
        переименовываются.
      </p>
      <div className="party-track-display-section__controls">
        <label className="party-track-display-section__row">
          <input
            type="checkbox"
            checked={value.stripLeadingCharsEnabled}
            onChange={(e) => onChange({ ...value, stripLeadingCharsEnabled: e.target.checked })}
          />
          <span>Скрыть символы с начала имени трека</span>
        </label>

        <fieldset
          className="party-track-display-section__mode-fieldset"
          disabled={!value.stripLeadingCharsEnabled}
        >
          <legend className="party-track-display-section__legend">Способ скрытия</legend>
          <label className="party-track-display-section__row">
            <input
              type="radio"
              name="party-track-strip-mode"
              checked={mode === 'count'}
              onChange={() => onChange({ ...value, stripLeadingCharsMode: 'count' })}
            />
            <span>Число символов</span>
          </label>
          <label className="party-track-display-section__row">
            <input
              type="radio"
              name="party-track-strip-mode"
              checked={mode === 'untilDelimiter'}
              onChange={() => onChange({ ...value, stripLeadingCharsMode: 'untilDelimiter' })}
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
              disabled={!value.stripLeadingCharsEnabled}
              value={value.stripLeadingCharsCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onChange({
                  ...value,
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
                disabled={!value.stripLeadingCharsEnabled}
                value={delimiterPresetId}
                onChange={(e) => {
                  const nextPreset = e.target.value as PartyTrackDelimiterPresetId;
                  const presetChar = partyTrackDelimiterCharFromPreset(nextPreset);
                  if (presetChar != null) {
                    onChange({ ...value, stripLeadingCharsDelimiter: presetChar });
                    return;
                  }
                  const fallback =
                    value.stripLeadingCharsDelimiter.length > 0
                      ? value.stripLeadingCharsDelimiter.slice(0, 1)
                      : ' ';
                  onChange({ ...value, stripLeadingCharsDelimiter: fallback });
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
                  disabled={!value.stripLeadingCharsEnabled}
                  value={value.stripLeadingCharsDelimiter}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next.length === 0) {
                      return;
                    }
                    onChange({
                      ...value,
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
          {mode === 'untilDelimiter' && value.stripLeadingCharsEnabled ? (
            <span className="party-track-display-section__preview-note">
              Разделитель в результат не попадает.
            </span>
          ) : null}
        </div>
      </div>
    </PartyEditorAccordion>
  );
};
