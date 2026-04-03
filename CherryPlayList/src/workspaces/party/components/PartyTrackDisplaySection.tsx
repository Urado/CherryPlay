import React from 'react';

import type { PartyTrackDisplaySettings } from '@core/types/project';

import './PartyTrackDisplaySection.css';

export interface PartyTrackDisplaySectionProps {
  value: PartyTrackDisplaySettings;
  onChange: (next: PartyTrackDisplaySettings) => void;
}

/**
 * Настройки отображения имён треков для страницы вечеринки (проект + стор, не API customization).
 * Сюда же можно добавлять будущие опции отображения.
 */
export const PartyTrackDisplaySection: React.FC<PartyTrackDisplaySectionProps> = ({
  value,
  onChange,
}) => {
  return (
    <section className="party-track-display-section" aria-labelledby="party-track-display-heading">
      <h3 id="party-track-display-heading" className="party-track-display-section__title">
        Отображение треков
      </h3>
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
      </div>
    </section>
  );
};
