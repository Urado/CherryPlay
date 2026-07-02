import { getPopularTimeZones, getDefaultTimeZone } from '@cherryplay/components';
import React, { useEffect, useRef, useState } from 'react';

import {
  MAX_SHORT_DESCRIPTION_LENGTH,
  MAX_DANCE_TAGS,
  MAX_DANCE_TAG_LENGTH,
  MAX_EXTERNAL_LINK_URL_LENGTH,
  MAX_EXTERNAL_LINK_TEXT_LENGTH,
  PREDEFINED_DANCE_TAGS,
} from '@shared/services/partyService';

import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

interface DanceTagsFieldProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  predefinedOptions: string[];
  maxTags: number;
  maxTagLength: number;
  readOnly?: boolean;
}

const DanceTagsField: React.FC<DanceTagsFieldProps> = ({
  tags,
  onChange,
  predefinedOptions,
  maxTags,
  maxTagLength,
  readOnly = false,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const customBlockRef = useRef<HTMLDivElement>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    },
    [],
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim().slice(0, maxTagLength);
    if (!trimmed || tags.includes(trimmed) || tags.length >= maxTags) return;
    onChange([...tags, trimmed]);
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(customInput);
      setCustomInput('');
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
        collapseTimeoutRef.current = null;
      }
      setShowCustomInput(false);
    }
  };

  return (
    <div className="party-editor-section">
      <label className="party-editor-label">Танцевальные теги (макс. {maxTags})</label>
      <div className="party-editor-tags-predefined">
        {predefinedOptions.map((option) => (
          <button
            key={option}
            type="button"
            className={`party-editor-tag-button ${tags.includes(option) ? 'party-editor-tag-button--selected' : ''}`}
            onClick={() => {
              if (tags.includes(option)) {
                removeTag(tags.indexOf(option));
              } else if (tags.length < maxTags) {
                addTag(option);
              }
            }}
            disabled={readOnly || (!tags.includes(option) && tags.length >= maxTags)}
          >
            {option}
          </button>
        ))}
        {!readOnly && !showCustomInput ? (
          <button
            type="button"
            className="party-editor-tag-button"
            onClick={() => {
              if (collapseTimeoutRef.current) {
                clearTimeout(collapseTimeoutRef.current);
                collapseTimeoutRef.current = null;
              }
              setShowCustomInput(true);
            }}
            disabled={tags.length >= maxTags}
            aria-label="Ввести другой танец"
          >
            Другой танец
          </button>
        ) : !readOnly ? (
          <div
            ref={customBlockRef}
            className="party-editor-tags-custom party-editor-tags-custom--inline"
          >
            <input
              type="text"
              className="party-editor-input party-editor-tag-input"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value.slice(0, maxTagLength))}
              onKeyDown={handleCustomKeyDown}
              onBlur={(e) => {
                if (e.relatedTarget && customBlockRef.current?.contains(e.relatedTarget as Node))
                  return;
                collapseTimeoutRef.current = setTimeout(() => setShowCustomInput(false), 150);
              }}
              placeholder="Другой танец (Enter или запятая)"
              maxLength={maxTagLength}
              disabled={tags.length >= maxTags}
              aria-label="Поле для ввода другого танца"
            />
            <button
              type="button"
              className="party-editor-button party-editor-button-secondary party-editor-tag-add"
              onClick={() => {
                addTag(customInput);
                setCustomInput('');
                if (collapseTimeoutRef.current) {
                  clearTimeout(collapseTimeoutRef.current);
                  collapseTimeoutRef.current = null;
                }
                setShowCustomInput(false);
              }}
              disabled={tags.length >= maxTags || !customInput.trim()}
            >
              Добавить
            </button>
          </div>
        ) : null}
      </div>
      {tags.length > 0 && (
        <div className="party-editor-tags-list">
          {tags.map((tag, index) => (
            <span key={`${tag}-${index}`} className="party-editor-tag-chip">
              {tag}
              {!readOnly && (
                <button
                  type="button"
                  className="party-editor-tag-remove"
                  onClick={() => removeTag(index)}
                  aria-label={`Удалить тег ${tag}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

function formatEventDateSummary(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildExtendedFieldsSummary(values: {
  eventDateTime: string;
  city: string;
  place: string;
  danceTags: string[];
}): { text: string; filledCount: number; totalCount: number } {
  const parts: string[] = [];
  let filledCount = 0;
  const totalCount = 3;
  const dateLabel = formatEventDateSummary(values.eventDateTime);
  if (dateLabel) {
    parts.push(dateLabel);
    filledCount += 1;
  }
  if (values.city.trim()) {
    parts.push(values.city.trim());
    filledCount += 1;
  } else if (values.place.trim()) {
    parts.push(values.place.trim());
    filledCount += 1;
  }
  if (values.danceTags.length > 0) {
    parts.push(`${values.danceTags.length} тег.`);
    filledCount += 1;
  }
  return {
    text: parts.length > 0 ? parts.join(' · ') : 'Не заполнено',
    filledCount,
    totalCount,
  };
}

export interface PartyExtendedFieldsSectionProps {
  eventDateTime: string;
  eventEndDateTime: string;
  description: string;
  place: string;
  city: string;
  schedule: string;
  timeZone: string;
  shortDescription: string;
  externalLinkUrl: string;
  externalLinkText: string;
  danceTags: string[];
  readOnly?: boolean;
  defaultExpanded?: boolean;
  onEventDateTimeChange: (dateTime: string) => void;
  onEventEndDateTimeChange?: (dateTime: string) => void;
  onDescriptionChange?: (description: string) => void;
  onPlaceChange?: (place: string) => void;
  onCityChange?: (city: string) => void;
  onScheduleChange?: (schedule: string) => void;
  onShortDescriptionChange?: (value: string) => void;
  onExternalLinkUrlChange?: (value: string) => void;
  onExternalLinkTextChange?: (value: string) => void;
  onDanceTagsChange?: (tags: string[]) => void;
  onTimeZoneChange?: (timeZone: string) => void;
}

export const PartyExtendedFieldsSection: React.FC<PartyExtendedFieldsSectionProps> = ({
  eventDateTime,
  eventEndDateTime,
  description,
  place,
  city,
  schedule,
  timeZone,
  shortDescription,
  externalLinkUrl,
  externalLinkText,
  danceTags,
  readOnly = false,
  defaultExpanded = false,
  onEventDateTimeChange,
  onEventEndDateTimeChange,
  onDescriptionChange,
  onPlaceChange,
  onCityChange,
  onScheduleChange,
  onShortDescriptionChange,
  onExternalLinkUrlChange,
  onExternalLinkTextChange,
  onDanceTagsChange,
  onTimeZoneChange,
}) => {
  const summary = buildExtendedFieldsSummary({ eventDateTime, city, place, danceTags });
  const isCompleted = summary.filledCount === summary.totalCount;
  const statusLabel = isCompleted ? 'Заполнено' : `${summary.filledCount}/${summary.totalCount}`;

  return (
    <PartyEditorAccordion
      title="Дополнительные данные"
      defaultExpanded={defaultExpanded}
      summary={
        <span className="party-editor-extended-summary">
          <span className="party-editor-extended-summary__text">{summary.text}</span>
          <span
            className={`party-editor-extended-summary__badge ${
              isCompleted
                ? 'party-editor-extended-summary__badge--complete'
                : 'party-editor-extended-summary__badge--partial'
            }`}
          >
            {statusLabel}
          </span>
        </span>
      }
    >
      <div className="party-editor-fields-group">
        <h4 className="party-editor-fields-group__title">Дата и время</h4>
        <div className="party-editor-fields-group__fields">
          {onTimeZoneChange && (
            <div className="party-editor-section">
              <label className="party-editor-label">
                Таймзона
                <select
                  className="party-editor-input"
                  value={timeZone || getDefaultTimeZone()}
                  onChange={(e) => onTimeZoneChange(e.target.value)}
                  disabled={readOnly}
                >
                  {getPopularTimeZones().map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="party-editor-section">
            <label className="party-editor-label">
              Дата и время мероприятия
              <input
                type="datetime-local"
                className="party-editor-input"
                value={eventDateTime}
                onChange={(e) => onEventDateTimeChange(e.target.value)}
                readOnly={readOnly}
                disabled={readOnly}
              />
            </label>
          </div>
          {onEventEndDateTimeChange && (
            <div className="party-editor-section">
              <label className="party-editor-label">
                Время окончания
                <input
                  type="datetime-local"
                  className="party-editor-input"
                  value={eventEndDateTime}
                  onChange={(e) => onEventEndDateTimeChange(e.target.value)}
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {onPlaceChange && onCityChange && (
        <div className="party-editor-fields-group">
          <h4 className="party-editor-fields-group__title">Место проведения</h4>
          <div className="party-editor-fields-group__fields">
            <div className="party-editor-section">
              <label className="party-editor-label">
                Город
                <input
                  type="text"
                  className="party-editor-input"
                  value={city}
                  onChange={(e) => onCityChange(e.target.value)}
                  placeholder="Город"
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </label>
            </div>
            <div className="party-editor-section">
              <label className="party-editor-label">
                Место
                <input
                  type="text"
                  className="party-editor-input"
                  value={place}
                  onChange={(e) => onPlaceChange(e.target.value)}
                  placeholder="Место проведения"
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {onDescriptionChange && onShortDescriptionChange && onScheduleChange && (
        <div className="party-editor-fields-group">
          <h4 className="party-editor-fields-group__title">Описание и программа</h4>
          <div className="party-editor-fields-group__fields">
            <div className="party-editor-section">
              <label className="party-editor-label">
                Описание
                <textarea
                  className="party-editor-input"
                  value={description}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  placeholder="Описание вечеринки"
                  rows={3}
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </label>
            </div>
            <div className="party-editor-section">
              <label className="party-editor-label">
                Краткое описание (для карточки)
                <textarea
                  className="party-editor-input"
                  value={shortDescription}
                  onChange={(e) =>
                    onShortDescriptionChange(e.target.value.slice(0, MAX_SHORT_DESCRIPTION_LENGTH))
                  }
                  placeholder="Краткое описание до 200 символов"
                  rows={2}
                  maxLength={MAX_SHORT_DESCRIPTION_LENGTH}
                  readOnly={readOnly}
                  disabled={readOnly}
                />
                <span className="party-editor-char-count">
                  {shortDescription.length}/{MAX_SHORT_DESCRIPTION_LENGTH}
                </span>
              </label>
            </div>
            <div className="party-editor-section">
              <label className="party-editor-label">
                Расписание
                <textarea
                  className="party-editor-input"
                  value={schedule}
                  onChange={(e) => onScheduleChange(e.target.value)}
                  placeholder="Расписание мероприятия"
                  rows={3}
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {(onExternalLinkUrlChange && onExternalLinkTextChange) || onDanceTagsChange ? (
        <div className="party-editor-fields-group">
          <h4 className="party-editor-fields-group__title">Ссылки и теги</h4>
          <div className="party-editor-fields-group__fields">
            {onExternalLinkUrlChange && onExternalLinkTextChange && (
              <div className="party-editor-section">
                <label className="party-editor-label">
                  Внешняя ссылка (URL)
                  <input
                    type="url"
                    className="party-editor-input"
                    value={externalLinkUrl}
                    onChange={(e) =>
                      onExternalLinkUrlChange(e.target.value.slice(0, MAX_EXTERNAL_LINK_URL_LENGTH))
                    }
                    placeholder="https://..."
                    maxLength={MAX_EXTERNAL_LINK_URL_LENGTH}
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </label>
                <label className="party-editor-label">
                  Текст ссылки (подпись)
                  <input
                    type="text"
                    className="party-editor-input"
                    value={externalLinkText}
                    onChange={(e) =>
                      onExternalLinkTextChange(
                        e.target.value.slice(0, MAX_EXTERNAL_LINK_TEXT_LENGTH),
                      )
                    }
                    placeholder="Например: Сайт мероприятия"
                    maxLength={MAX_EXTERNAL_LINK_TEXT_LENGTH}
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </label>
              </div>
            )}
            {onDanceTagsChange && (
              <DanceTagsField
                tags={danceTags}
                onChange={onDanceTagsChange}
                predefinedOptions={[...PREDEFINED_DANCE_TAGS]}
                maxTags={MAX_DANCE_TAGS}
                maxTagLength={MAX_DANCE_TAG_LENGTH}
                readOnly={readOnly}
              />
            )}
          </div>
        </div>
      ) : null}
    </PartyEditorAccordion>
  );
};
