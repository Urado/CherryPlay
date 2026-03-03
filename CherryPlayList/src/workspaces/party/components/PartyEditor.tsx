import {
  partyThemes,
  type PartyThemeId,
  getThemeMetadata,
  getPartyTheme,
} from '@cherryplay/components';
import { getPopularTimeZones, getDefaultTimeZone } from '@cherryplay/components';
import React, { useState, useRef, useEffect } from 'react';

import {
  MAX_SHORT_DESCRIPTION_LENGTH,
  MAX_DANCE_TAGS,
  MAX_DANCE_TAG_LENGTH,
  MAX_EXTERNAL_LINK_URL_LENGTH,
  MAX_EXTERNAL_LINK_TEXT_LENGTH,
  PREDEFINED_DANCE_TAGS,
} from '@shared/services/partyService';
import './PartyEditor.css';

interface DanceTagsFieldProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  predefinedOptions: string[];
  maxTags: number;
  maxTagLength: number;
}

const DanceTagsField: React.FC<DanceTagsFieldProps> = ({
  tags,
  onChange,
  predefinedOptions,
  maxTags,
  maxTagLength,
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
            disabled={!tags.includes(option) && tags.length >= maxTags}
          >
            {option}
          </button>
        ))}
        {!showCustomInput ? (
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
        ) : (
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
              autoFocus
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
        )}
      </div>
      {tags.length > 0 && (
        <div className="party-editor-tags-list">
          {tags.map((tag, index) => (
            <span key={`${tag}-${index}`} className="party-editor-tag-chip">
              {tag}
              <button
                type="button"
                className="party-editor-tag-remove"
                onClick={() => removeTag(index)}
                aria-label={`Удалить тег ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

interface PartyEditorProps {
  partyName: string;
  partyTitle?: string;
  partySubtitle?: string;
  themeId: PartyThemeId;
  customizationSettings: Record<string, string | number>;
  eventDateTime: string;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
  shortDescription?: string;
  externalLinkUrl?: string;
  externalLinkText?: string;
  danceTags?: string[];
  onPartyNameChange: (name: string) => void;
  onPartyTitleChange?: (title: string) => void;
  onPartySubtitleChange?: (subtitle: string) => void;
  onThemeIdChange: (themeId: PartyThemeId) => void;
  onCustomizationSettingsChange: (settings: Record<string, string | number>) => void;
  onEventDateTimeChange: (dateTime: string) => void;
  onDescriptionChange?: (description: string) => void;
  onPlaceChange?: (place: string) => void;
  onCityChange?: (city: string) => void;
  onScheduleChange?: (schedule: string) => void;
  onShortDescriptionChange?: (value: string) => void;
  onExternalLinkUrlChange?: (value: string) => void;
  onExternalLinkTextChange?: (value: string) => void;
  onDanceTagsChange?: (tags: string[]) => void;
  onTimeZoneChange?: (timeZone: string) => void;
  onCreateParty: () => void;
  onPublish?: () => void;
  isCreating: boolean;
  isPublishing?: boolean;
  isAuthenticated?: boolean;
  linkedParty?: { id: string; shortCode: string; url?: string } | null;
  serverError: string | null;
  isCheckingParty: boolean;
  onCopyUrl: () => void;
  onRetry?: () => void;
  onOpenLinkParty?: () => void;
}

const PARTY_THEME_PREVIEWS: Record<PartyThemeId, string> = {
  cyberpunk: '💚 Неоновое свечение, темный фон, футуристический стиль',
  sakura: '🌸 Розовые оттенки, мягкие переходы, элегантный дизайн',
  'art-deco': '✨ Золотые акценты, геометрические паттерны, роскошный вид',
  basic: '📋 Простой дизайн, темный фон, синий акцент',
};

const AVAILABLE_STYLES = partyThemes.map((theme) => ({
  id: theme.id,
  name: theme.name,
  description: theme.description,
  preview: PARTY_THEME_PREVIEWS[theme.id] || theme.description,
}));

export const PartyEditor: React.FC<PartyEditorProps> = ({
  partyName,
  partyTitle = '',
  partySubtitle = '',
  themeId,
  customizationSettings,
  eventDateTime,
  description = '',
  place = '',
  city = '',
  schedule = '',
  timeZone = '',
  shortDescription = '',
  externalLinkUrl = '',
  externalLinkText = '',
  danceTags: danceTagsProp = [],
  onPartyNameChange,
  onPartyTitleChange,
  onPartySubtitleChange,
  onThemeIdChange,
  onCustomizationSettingsChange,
  onEventDateTimeChange,
  onDescriptionChange,
  onPlaceChange,
  onCityChange,
  onScheduleChange,
  onShortDescriptionChange,
  onExternalLinkUrlChange,
  onExternalLinkTextChange,
  onDanceTagsChange,
  onTimeZoneChange,
  onCreateParty,
  onPublish,
  isCreating,
  isPublishing = false,
  isAuthenticated = true,
  linkedParty,
  serverError,
  isCheckingParty,
  onCopyUrl,
  onRetry,
  onOpenLinkParty,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const selectedStyle = AVAILABLE_STYLES.find((s) => s.id === themeId) || AVAILABLE_STYLES[0];

  const handleCustomizationChange = (key: string, value: string | number) => {
    onCustomizationSettingsChange({
      ...customizationSettings,
      [key]: value,
    });
  };

  const renderCustomizationOptions = () => {
    const metadata = getThemeMetadata(themeId);
    const theme = getPartyTheme(themeId);
    if (!metadata || metadata.customizationOptions.length === 0) {
      return null;
    }

    return (
      <div className="party-editor-section">
        <label className="party-editor-label">Настройки {theme?.name || themeId}</label>
        <div className="party-editor-customization">
          {metadata.customizationOptions.map((option) => {
            const currentValue = customizationSettings[option.key] ?? option.defaultValue;

            return (
              <label key={option.key} className="party-editor-customization-item">
                {option.label}
                {option.type === 'color' && (
                  <input
                    type="color"
                    value={String(currentValue)}
                    onChange={(e) => handleCustomizationChange(option.key, e.target.value)}
                  />
                )}
                {option.type === 'number' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      min={option.min ?? 0}
                      max={option.max ?? 100}
                      step={option.step ?? 1}
                      value={Number(currentValue)}
                      onInput={(e) => {
                        const value = parseInt((e.target as HTMLInputElement).value, 10);
                        handleCustomizationChange(option.key, value);
                      }}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        handleCustomizationChange(option.key, value);
                      }}
                      style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        minWidth: '40px',
                        textAlign: 'right',
                        fontSize: '14px',
                        color: 'var(--text-secondary, #666666)',
                        fontWeight: '500',
                      }}
                    >
                      {currentValue}
                    </span>
                  </div>
                )}
                {option.type === 'select' && option.options && (
                  <select
                    value={String(currentValue)}
                    onChange={(e) => handleCustomizationChange(option.key, e.target.value)}
                  >
                    {option.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {option.type === 'text' && (
                  <input
                    type="text"
                    value={String(currentValue)}
                    onChange={(e) => handleCustomizationChange(option.key, e.target.value)}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const handleStyleSelect = (themeId: PartyThemeId) => {
    onThemeIdChange(themeId);
    setIsDropdownOpen(false);
  };

  const displayParty = !serverError && !isCheckingParty ? (linkedParty ?? null) : null;

  return (
    <div className="party-editor">
      <div className="party-editor-section">
        <label className="party-editor-label">
          Название вечеринки
          <input
            type="text"
            className="party-editor-input"
            value={partyName}
            onChange={(e) => onPartyNameChange(e.target.value)}
            placeholder="Введите название вечеринки"
          />
        </label>
      </div>

      <div className="party-editor-section">
        <label className="party-editor-label">
          Заголовок (на экране)
          <input
            type="text"
            className="party-editor-input"
            value={partyTitle}
            onChange={(e) => onPartyTitleChange?.(e.target.value)}
            placeholder="Если пусто — показывается название"
          />
        </label>
      </div>

      <div className="party-editor-section">
        <label className="party-editor-label">
          Подзаголовок
          <input
            type="text"
            className="party-editor-input"
            value={partySubtitle}
            onChange={(e) => onPartySubtitleChange?.(e.target.value)}
            placeholder="Строка под заголовком"
          />
        </label>
      </div>

      {onTimeZoneChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Таймзона
            <select
              className="party-editor-input"
              value={timeZone || getDefaultTimeZone()}
              onChange={(e) => onTimeZoneChange(e.target.value)}
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
          Дата и время мероприятия (по местному времени выбранной таймзоны)
          <input
            type="datetime-local"
            className="party-editor-input"
            value={eventDateTime}
            onChange={(e) => onEventDateTimeChange(e.target.value)}
          />
        </label>
      </div>

      {onDescriptionChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Описание
            <textarea
              className="party-editor-input"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Описание вечеринки"
              rows={3}
            />
          </label>
        </div>
      )}

      {onPlaceChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Место
            <input
              type="text"
              className="party-editor-input"
              value={place}
              onChange={(e) => onPlaceChange(e.target.value)}
              placeholder="Место проведения"
            />
          </label>
        </div>
      )}

      {onCityChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Город
            <input
              type="text"
              className="party-editor-input"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="Город"
            />
          </label>
        </div>
      )}

      {onScheduleChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Расписание
            <textarea
              className="party-editor-input"
              value={schedule}
              onChange={(e) => onScheduleChange(e.target.value)}
              placeholder="Расписание мероприятия"
              rows={3}
            />
          </label>
        </div>
      )}

      {onShortDescriptionChange && (
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
            />
            <span className="party-editor-char-count">
              {shortDescription.length}/{MAX_SHORT_DESCRIPTION_LENGTH}
            </span>
          </label>
        </div>
      )}

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
            />
          </label>
          <label className="party-editor-label">
            Текст ссылки (подпись)
            <input
              type="text"
              className="party-editor-input"
              value={externalLinkText}
              onChange={(e) =>
                onExternalLinkTextChange(e.target.value.slice(0, MAX_EXTERNAL_LINK_TEXT_LENGTH))
              }
              placeholder="Например: Сайт мероприятия"
              maxLength={MAX_EXTERNAL_LINK_TEXT_LENGTH}
            />
          </label>
        </div>
      )}

      {onDanceTagsChange && (
        <DanceTagsField
          tags={danceTagsProp}
          onChange={onDanceTagsChange}
          predefinedOptions={[...PREDEFINED_DANCE_TAGS]}
          maxTags={MAX_DANCE_TAGS}
          maxTagLength={MAX_DANCE_TAG_LENGTH}
        />
      )}

      <div className="party-editor-section">
        <label htmlFor="theme-selector" className="party-editor-label">
          Стиль оформления
        </label>
        <div className="party-editor-dropdown" ref={dropdownRef}>
          <button
            id="theme-selector"
            type="button"
            className="party-editor-dropdown-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
          >
            <div className="party-editor-dropdown-button-content">
              <div className="party-editor-dropdown-selected">
                <span className="party-editor-dropdown-name">{selectedStyle.name}</span>
                <span className="party-editor-dropdown-preview">{selectedStyle.preview}</span>
              </div>
              <span className="party-editor-dropdown-arrow">{isDropdownOpen ? '▲' : '▼'}</span>
            </div>
          </button>
          {isDropdownOpen && (
            <div className="party-editor-dropdown-menu">
              {AVAILABLE_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  className={`party-editor-dropdown-item ${themeId === style.id ? 'party-editor-dropdown-item--selected' : ''}`}
                  onClick={() => handleStyleSelect(style.id)}
                >
                  <div className="party-editor-dropdown-item-content">
                    <div className="party-editor-dropdown-item-name">{style.name}</div>
                    <div className="party-editor-dropdown-item-description">
                      {style.description}
                    </div>
                    <div className="party-editor-dropdown-item-preview">{style.preview}</div>
                  </div>
                  {themeId === style.id && (
                    <span className="party-editor-dropdown-item-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {renderCustomizationOptions()}

      <div className="party-editor-actions">
        {onPublish && (
          <button
            className="party-editor-button party-editor-button-primary"
            onClick={onPublish}
            disabled={isCreating || isPublishing}
            type="button"
          >
            {isPublishing || isCreating
              ? 'Публикация...'
              : linkedParty
                ? 'Опубликовать изменения'
                : 'Опубликовать'}
          </button>
        )}
        <button
          className="party-editor-button party-editor-button-secondary"
          onClick={onCreateParty}
          disabled={!isAuthenticated || isCreating || !partyName.trim()}
          type="button"
          title={!isAuthenticated ? 'Требуется авторизация' : undefined}
        >
          {isCreating ? 'Создание...' : 'Создать вечеринку'}
        </button>
        {onOpenLinkParty && isAuthenticated && (
          <button
            className="party-editor-button party-editor-button-secondary"
            onClick={onOpenLinkParty}
            type="button"
            title="Привязать текущий плейлист к вечеринке, созданной на сервере"
          >
            Привязать к вечеринке
          </button>
        )}
      </div>

      {isCheckingParty && (
        <div className="party-editor-checking">
          <div className="party-editor-checking-message">Проверка соединения с сервером...</div>
        </div>
      )}

      {serverError && !linkedParty && !isCheckingParty && (
        <div className="party-editor-error">
          <div className="party-editor-error-header">
            <strong className="party-editor-error-title">Ошибка подключения</strong>
          </div>
          <div className="party-editor-error-message">
            <p>{serverError}</p>
            <p className="party-editor-error-hint">Убедитесь, что сервер запущен и доступен.</p>
          </div>
          {onRetry && (
            <div className="party-editor-error-actions">
              <button
                className="action-button party-editor-error-retry-button"
                onClick={onRetry}
                type="button"
                disabled={isCheckingParty}
              >
                Переподключиться
              </button>
            </div>
          )}
        </div>
      )}

      {displayParty && (
        <div className="party-editor-party-block">
          <div className="party-editor-party-block-header">
            <span className="party-editor-party-block-icon">🔗</span>
            <span className="party-editor-party-block-title">Связано с вечеринкой</span>
          </div>
          <div className="party-editor-party-block-info">
            <div className="party-editor-party-block-code">
              <strong>Код:</strong> {displayParty.shortCode}
            </div>
            {displayParty.url && (
              <a
                href={displayParty.url}
                target="_blank"
                rel="noopener noreferrer"
                className="party-editor-linked-party-link"
              >
                Открыть в браузере →
              </a>
            )}
          </div>
          <div className="party-editor-url-section">
            <label className="party-editor-label">
              URL вечеринки
              <div className="party-editor-url-group">
                <input
                  type="text"
                  readOnly
                  value={displayParty.url ?? ''}
                  className="input-base party-editor-url-input"
                />
                <button
                  className="action-button party-editor-url-button"
                  onClick={onCopyUrl}
                  type="button"
                >
                  Копировать
                </button>
              </div>
            </label>
          </div>
          <div className="party-editor-info">
            <p className="party-editor-info-text">
              Плеер подключается к серверу по привязанной вечеринке. Статус соединения отображается
              в плеере.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
