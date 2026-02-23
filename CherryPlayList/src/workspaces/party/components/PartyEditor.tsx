import {
  partyThemes,
  type PartyThemeId,
  getThemeMetadata,
  getPartyTheme,
} from '@cherryplay/components';
import React, { useState, useRef, useEffect } from 'react';

import { getPopularTimeZones, getDefaultTimeZone } from '@shared/utils/timezoneUtils';
import './PartyEditor.css';

interface PartyEditorProps {
  partyName: string;
  themeId: PartyThemeId;
  customizationSettings: Record<string, string | number>;
  eventDateTime: string;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
  onPartyNameChange: (name: string) => void;
  onThemeIdChange: (themeId: PartyThemeId) => void;
  onCustomizationSettingsChange: (settings: Record<string, string | number>) => void;
  onEventDateTimeChange: (dateTime: string) => void;
  onDescriptionChange?: (description: string) => void;
  onPlaceChange?: (place: string) => void;
  onCityChange?: (city: string) => void;
  onScheduleChange?: (schedule: string) => void;
  onTimeZoneChange?: (timeZone: string) => void;
  onCreateParty: () => void;
  onPublish?: () => void;
  isCreating: boolean;
  isPublishing?: boolean;
  /** Если false, кнопка «Создать вечеринку» отключена (требуется авторизация). */
  isAuthenticated?: boolean;
  linkedParty?: { id: string; shortCode: string; url: string } | null;
  createdParty: { id: string; shortCode: string; url: string } | null;
  serverError: string | null;
  isCheckingParty: boolean;
  onCopyUrl: () => void;
  onRetry?: () => void;
  /** Открыть диалог привязки к существующей вечеринке на сервере */
  onOpenLinkParty?: () => void;
}

// Маппинг превью для PartyTheme (опциональные описания для UI)
const PARTY_THEME_PREVIEWS: Record<PartyThemeId, string> = {
  cyberpunk: '💚 Неоновое свечение, темный фон, футуристический стиль',
  sakura: '🌸 Розовые оттенки, мягкие переходы, элегантный дизайн',
  'art-deco': '✨ Золотые акценты, геометрические паттерны, роскошный вид',
  basic: '📋 Простой дизайн, темный фон, синий акцент',
};

// Используем PartyTheme из библиотеки компонентов
const AVAILABLE_STYLES = partyThemes.map((theme) => ({
  id: theme.id,
  name: theme.name,
  description: theme.description,
  preview: PARTY_THEME_PREVIEWS[theme.id] || theme.description,
}));

export const PartyEditor: React.FC<PartyEditorProps> = ({
  partyName,
  themeId,
  customizationSettings,
  eventDateTime,
  description = '',
  place = '',
  city = '',
  schedule = '',
  timeZone = '',
  onPartyNameChange,
  onThemeIdChange,
  onCustomizationSettingsChange,
  onEventDateTimeChange,
  onDescriptionChange,
  onPlaceChange,
  onCityChange,
  onScheduleChange,
  onTimeZoneChange,
  onCreateParty,
  onPublish,
  isCreating,
  isPublishing = false,
  isAuthenticated = true,
  linkedParty,
  createdParty,
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

  const displayParty =
    createdParty && !serverError && !isCheckingParty ? createdParty : (linkedParty ?? null);
  const isJustCreated = !!(createdParty && !serverError && !isCheckingParty);

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
          Дата и время мероприятия
          <input
            type="datetime-local"
            className="party-editor-input"
            value={eventDateTime}
            onChange={(e) => onEventDateTimeChange(e.target.value)}
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

      {serverError && !createdParty && !isCheckingParty && (
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
            <a
              href={displayParty.url}
              target="_blank"
              rel="noopener noreferrer"
              className="party-editor-linked-party-link"
            >
              Открыть в браузере →
            </a>
          </div>
          <div className="party-editor-url-section">
            <label className="party-editor-label">
              URL вечеринки
              <div className="party-editor-url-group">
                <input
                  type="text"
                  readOnly
                  value={displayParty.url}
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
          {isJustCreated && (
            <div className="party-editor-info">
              <p className="party-editor-info-text">
                Плеер автоматически подключится к серверу при создании вечеринки.
              </p>
              <p className="party-editor-info-text">Статус соединения отображается в плеере.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
