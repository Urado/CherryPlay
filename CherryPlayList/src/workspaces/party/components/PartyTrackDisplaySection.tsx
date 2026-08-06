import React, { useMemo } from 'react';

import type { PartyTrackDisplaySettings, PartyTrackStripLeadingMode } from '@core/types/project';
import { applyPartyTrackDisplayToTrackName } from '@shared/utils/partyUtils';

import { PartyEditorAccordion } from './PartyEditorAccordion';
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
          <label className="party-track-display-section__row party-track-display-section__row--number">
            <span className="party-track-display-section__label">Символ-разделитель</span>
            <input
              type="text"
              className="party-track-display-section__input party-track-display-section__input--delimiter"
              maxLength={1}
              disabled={!value.stripLeadingCharsEnabled}
              value={value.stripLeadingCharsDelimiter}
              title="По умолчанию пробел; можно указать, например, дефис"
              onChange={(e) => {
                const next = e.target.value;
                onChange({
                  ...value,
                  stripLeadingCharsDelimiter:
                    next.length > 0 ? next.slice(0, 1) : value.stripLeadingCharsDelimiter,
                });
              }}
            />
          </label>
        )}

        <div className="party-track-display-section__preview" aria-live="polite">
          <span className="party-track-display-section__preview-label">Пример:</span>
          <span className="party-track-display-section__preview-sample">{PREVIEW_SAMPLE_NAME}</span>
          <span className="party-track-display-section__preview-arrow" aria-hidden>
            →
          </span>
          <span className="party-track-display-section__preview-result">{previewName}</span>
        </div>
      </div>
    </PartyEditorAccordion>
  );
};
