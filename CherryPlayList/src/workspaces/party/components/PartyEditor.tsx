import React, { useState, useRef, useEffect } from 'react';

import './PartyEditor.css';

interface PartyEditorProps {
  partyName: string;
  themeId: string;
  customizationSettings: Record<string, any>;
  eventDateTime: string;
  onPartyNameChange: (name: string) => void;
  onThemeIdChange: (themeId: string) => void;
  onCustomizationSettingsChange: (settings: Record<string, any>) => void;
  onEventDateTimeChange: (dateTime: string) => void;
  onCreateParty: () => void;
  isCreating: boolean;
  createdParty: { id: string; shortCode: string; url: string } | null;
  serverError: string | null;
  isCheckingParty: boolean;
  onCopyUrl: () => void;
  onRetry?: () => void;
}

const AVAILABLE_STYLES = [
  { 
    id: 'cyberpunk', 
    name: 'Cyberpunk', 
    description: 'Неоновая тема в стиле киберпанк',
    preview: '💚 Неоновое свечение, темный фон, футуристический стиль'
  },
  { 
    id: 'sakura', 
    name: 'Sakura', 
    description: 'Нежная пастельная тема',
    preview: '🌸 Розовые оттенки, мягкие переходы, элегантный дизайн'
  },
  { 
    id: 'art-deco', 
    name: 'Art Deco', 
    description: 'Элегантная тема в стиле ар-деко',
    preview: '✨ Золотые акценты, геометрические паттерны, роскошный вид'
  },
];

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

  const handleCustomizationChange = (key: string, value: any) => {
    onCustomizationSettingsChange({
      ...customizationSettings,
      [key]: value,
    });
  };

  const handleStyleSelect = (themeId: string) => {
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
        <label className="party-editor-label">Стиль оформления</label>
        <div className="party-editor-dropdown" ref={dropdownRef}>
          <button
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
                    <div className="party-editor-dropdown-item-description">{style.description}</div>
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

      {themeId === 'cyberpunk' && (
        <div className="party-editor-section">
          <label className="party-editor-label">Настройки Cyberpunk</label>
          <div className="party-editor-customization">
            <label className="party-editor-customization-item">
              Цвет акцента
              <input
                type="color"
                value={customizationSettings.accentColor || '#00ff00'}
                onChange={(e) => handleCustomizationChange('accentColor', e.target.value)}
              />
            </label>
            <label className="party-editor-customization-item">
              Интенсивность свечения (0-100)
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customizationSettings.glowIntensity || 50}
                  onChange={(e) => handleCustomizationChange('glowIntensity', parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: '40px', textAlign: 'right', fontSize: '14px', color: 'var(--text-secondary, #666666)' }}>
                  {customizationSettings.glowIntensity || 50}
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {themeId === 'sakura' && (
        <div className="party-editor-section">
          <label className="party-editor-label">Настройки Sakura</label>
          <div className="party-editor-customization">
            <label className="party-editor-customization-item">
              Оттенок розового
              <input
                type="color"
                value={customizationSettings.pinkTint || '#ffb3d9'}
                onChange={(e) => handleCustomizationChange('pinkTint', e.target.value)}
              />
            </label>
            <label className="party-editor-customization-item">
              Прозрачность фона (0-100)
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customizationSettings.backgroundOpacity || 80}
                  onChange={(e) => handleCustomizationChange('backgroundOpacity', parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: '40px', textAlign: 'right', fontSize: '14px', color: 'var(--text-secondary, #666666)' }}>
                  {customizationSettings.backgroundOpacity || 80}
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {themeId === 'art-deco' && (
        <div className="party-editor-section">
          <label className="party-editor-label">Настройки Art Deco</label>
          <div className="party-editor-customization">
            <label className="party-editor-customization-item">
              Цвет золота
              <input
                type="color"
                value={customizationSettings.goldColor || '#d4af37'}
                onChange={(e) => handleCustomizationChange('goldColor', e.target.value)}
              />
            </label>
            <label className="party-editor-customization-item">
              Стиль паттерна
              <select
                value={customizationSettings.patternStyle || 'geometric'}
                onChange={(e) => handleCustomizationChange('patternStyle', e.target.value)}
              >
                <option value="geometric">Геометрический</option>
                <option value="floral">Цветочный</option>
                <option value="linear">Линейный</option>
              </select>
            </label>
          </div>
        </div>
      )}

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
          <div className="party-editor-checking-message">
            Проверка соединения с сервером...
          </div>
        </div>
      )}

      {serverError && !createdParty && !isCheckingParty && (
        <div className="party-editor-error">
          <div className="party-editor-error-header">
            <strong className="party-editor-error-title">Ошибка подключения</strong>
          </div>
          <div className="party-editor-error-message">
            <p>{serverError}</p>
            <p className="party-editor-error-hint">
              Убедитесь, что сервер запущен и доступен.
            </p>
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
            <p className="party-editor-info-text">
              Статус соединения отображается в плеере.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

