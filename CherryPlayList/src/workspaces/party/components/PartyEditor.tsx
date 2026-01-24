import { themes, type ThemeId, getThemeMetadata, getTheme } from '@cherryplay/components';
import React, { useState, useRef, useEffect } from 'react';

import './PartyEditor.css';

interface PartyEditorProps {
  partyName: string;
  themeId: ThemeId;
  customizationSettings: Record<string, string | number>;
  eventDateTime: string;
  onPartyNameChange: (name: string) => void;
  onThemeIdChange: (themeId: ThemeId) => void;
  onCustomizationSettingsChange: (settings: Record<string, string | number>) => void;
  onEventDateTimeChange: (dateTime: string) => void;
  onCreateParty: () => void;
  isCreating: boolean;
  createdParty: { id: string; shortCode: string; url: string } | null;
  serverError: string | null;
  isCheckingParty: boolean;
  onCopyUrl: () => void;
  onRetry?: () => void;
}

// Маппинг превью для тем (опциональные описания для UI)
const THEME_PREVIEWS: Record<ThemeId, string> = {
  cyberpunk: '💚 Неоновое свечение, темный фон, футуристический стиль',
  sakura: '🌸 Розовые оттенки, мягкие переходы, элегантный дизайн',
  'art-deco': '✨ Золотые акценты, геометрические паттерны, роскошный вид',
  basic: '📋 Простой дизайн, темный фон, синий акцент',
};

// Используем темы из библиотеки компонентов
const AVAILABLE_STYLES = themes.map((theme) => ({
  id: theme.id,
  name: theme.name,
  description: theme.description,
  preview: THEME_PREVIEWS[theme.id] || theme.description,
}));

export const PartyEditor: React.FC<PartyEditorProps> = ({
  partyName,
  themeId,
  customizationSettings,
  eventDateTime,
  onPartyNameChange,
  onThemeIdChange,
  onCustomizationSettingsChange,
  onEventDateTimeChange,
  onCreateParty,
  isCreating,
  createdParty,
  serverError,
  isCheckingParty,
  onCopyUrl,
  onRetry,
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
    const theme = getTheme(themeId);
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
                      onChange={(e) =>
                        handleCustomizationChange(option.key, parseInt(e.target.value, 10))
                      }
                      style={{ flex: 1 }}
                    />
                    <span
                      style={{
                        minWidth: '40px',
                        textAlign: 'right',
                        fontSize: '14px',
                        color: 'var(--text-secondary, #666666)',
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

  const handleStyleSelect = (themeId: ThemeId) => {
    onThemeIdChange(themeId);
    setIsDropdownOpen(false);
  };

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
        <button
          className="party-editor-button party-editor-button-primary"
          onClick={onCreateParty}
          disabled={isCreating || !partyName.trim()}
        >
          {isCreating ? 'Создание...' : 'Создать вечеринку'}
        </button>
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

      {createdParty && !serverError && !isCheckingParty && (
        <div className="party-editor-success">
          <div className="party-editor-success-header">
            <strong className="party-editor-success-title">Вечеринка создана!</strong>
            <div className="party-editor-success-code">
              <span className="party-editor-success-code-label">Код:</span>
              <span className="party-editor-success-code-value">{createdParty.shortCode}</span>
            </div>
          </div>
          <div className="party-editor-url-section">
            <label className="party-editor-label">
              URL вечеринки
              <div className="party-editor-url-group">
                <input
                  type="text"
                  readOnly
                  value={createdParty.url}
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
              Плеер автоматически подключится к серверу при создании вечеринки.
            </p>
            <p className="party-editor-info-text">Статус соединения отображается в плеере.</p>
          </div>
        </div>
      )}
    </div>
  );
};
