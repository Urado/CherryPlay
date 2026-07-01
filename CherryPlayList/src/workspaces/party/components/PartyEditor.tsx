import { partyThemes, type PartyThemeId, getPartyTheme } from '@cherryplay/components';
import { getPopularTimeZones, getDefaultTimeZone } from '@cherryplay/components';
import React, { useState, useRef, useEffect } from 'react';

import type { PartyLifecycleState } from '@shared/services/partyService';
import {
  MAX_SHORT_DESCRIPTION_LENGTH,
  MAX_DANCE_TAGS,
  MAX_DANCE_TAG_LENGTH,
  MAX_EXTERNAL_LINK_URL_LENGTH,
  MAX_EXTERNAL_LINK_TEXT_LENGTH,
  PREDEFINED_DANCE_TAGS,
} from '@shared/services/partyService';
import { sanitizeExternalUrl } from '@shared/utils/urlSafety';

import type { PartyEditorPhase } from '../partyEditorPhase';

import { PartyLifecycleControls } from './PartyLifecycleControls';
import './PartyEditor.css';

interface LockedThemeInfo {
  themeId: PartyThemeId;
  packageCode: string;
  packageName: string;
}

const REVOKED_CURRENT_THEME_PACKAGE_CODE = 'revoked-current-theme';

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

interface PartyEditorProps {
  partyName: string;
  partyTitle?: string;
  partySubtitle?: string;
  themeId: PartyThemeId;
  customizationSettings: Record<string, unknown>;
  eventDateTime: string;
  eventEndDateTime?: string;
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
  onCustomizationSettingsChange: (settings: Record<string, unknown>) => void;
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
  lockedThemes?: LockedThemeInfo[];
  accessContactUrl?: string;
  isThemeAccessLoading?: boolean;
  visibleThemeIds?: PartyThemeId[] | null;
  themeAccessErrorMessage?: string | null;
  partyLifecycleState?: PartyLifecycleState | null;
  isTransitioningLifecycle?: boolean;
  onLifecycleTransition?: (targetState: PartyLifecycleState) => void;
  phase: PartyEditorPhase;
  /** When true, shell shows linked-party banner — hide duplicate block in editor. */
  hideLinkedPartyBlock?: boolean;
  /** When true, shell overlay handles blocked states — hide checking/error UI. */
  isBlocked?: boolean;
}

const PARTY_THEME_PREVIEWS: Record<PartyThemeId, string> = {
  cyberpunk: '💚 Неоновое свечение, темный фон, футуристический стиль',
  sakura: '🌸 Розовые оттенки, мягкие переходы, элегантный дизайн',
  'art-deco': '✨ Золотые акценты, геометрические паттерны, роскошный вид',
  'spring-cross-step': '🌿 Весенние оттенки, мягкие акценты, свежий ритм',
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
  eventEndDateTime = '',
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
  lockedThemes = [],
  accessContactUrl = '',
  isThemeAccessLoading = false,
  visibleThemeIds = null,
  themeAccessErrorMessage = null,
  partyLifecycleState = null,
  isTransitioningLifecycle = false,
  onLifecycleTransition,
  phase,
  hideLinkedPartyBlock = false,
  isBlocked = false,
}) => {
  const isReadOnly = phase === 'completed';
  const showExtendedFields = phase !== 'draft-unlinked';
  const effectiveLifecycle = partyLifecycleState ?? 'draft';
  const showLifecycle =
    phase !== 'draft-unlinked' && Boolean(linkedParty) && Boolean(onLifecycleTransition);
  const showPublish = Boolean(onPublish) && (phase === 'draft-linked' || phase === 'ready');
  const showCreate = phase === 'draft-unlinked';
  const showLinkParty = phase === 'draft-unlinked' && Boolean(onOpenLinkParty) && isAuthenticated;
  const showPartyBlock =
    Boolean(linkedParty) && phase !== 'draft-unlinked' && !hideLinkedPartyBlock;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lockedThemeModal, setLockedThemeModal] = useState<LockedThemeInfo | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lockedThemeMap = new Map<PartyThemeId, LockedThemeInfo>(
    lockedThemes.map((item) => [item.themeId, item]),
  );
  const visibleThemeIdSet = visibleThemeIds ? new Set(visibleThemeIds) : null;
  const stylesForDropdown = AVAILABLE_STYLES.filter((style) => {
    if (!visibleThemeIdSet) {
      return true;
    }
    return visibleThemeIdSet.has(style.id) || style.id === themeId;
  });
  const sortedStylesForDropdown = [...stylesForDropdown].sort((a, b) => {
    if (a.id === 'basic' && b.id !== 'basic') {
      return -1;
    }
    if (b.id === 'basic' && a.id !== 'basic') {
      return 1;
    }

    const aLocked = lockedThemeMap.has(a.id);
    const bLocked = lockedThemeMap.has(b.id);
    if (aLocked === bLocked) {
      return 0;
    }
    return aLocked ? 1 : -1;
  });
  const accessibleStyleIds = new Set(
    stylesForDropdown.map((style) => style.id).filter((styleId) => !lockedThemeMap.has(styleId)),
  );
  const selectedLockedTheme = lockedThemeMap.get(themeId) ?? null;
  const safeContactUrl = sanitizeExternalUrl(accessContactUrl);

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

  const renderCustomizationOptions = () => {
    const theme = getPartyTheme(themeId);
    const ThemeCustomizationEditor = theme?.components.CustomizationEditor;

    if (!ThemeCustomizationEditor) {
      return null;
    }

    return (
      <ThemeCustomizationEditor
        customizationSettings={customizationSettings}
        onCustomizationSettingsChange={onCustomizationSettingsChange}
      />
    );
  };

  const handleStyleSelect = (nextThemeId: PartyThemeId) => {
    const lockedTheme = lockedThemeMap.get(nextThemeId);
    if (lockedTheme) {
      setLockedThemeModal(lockedTheme);
      return;
    }

    onThemeIdChange(nextThemeId);
    setIsDropdownOpen(false);
  };

  const displayParty = !serverError && !isCheckingParty ? (linkedParty ?? null) : null;

  return (
    <div className={`party-editor${isReadOnly ? ' party-editor--read-only' : ''}`}>
      <div className="party-editor-section">
        <label className="party-editor-label">
          Название вечеринки
          <input
            type="text"
            className="party-editor-input"
            value={partyName}
            onChange={(e) => onPartyNameChange(e.target.value)}
            placeholder="Введите название вечеринки"
            readOnly={isReadOnly}
            disabled={isReadOnly}
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
            readOnly={isReadOnly}
            disabled={isReadOnly}
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
            readOnly={isReadOnly}
            disabled={isReadOnly}
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
              disabled={isReadOnly}
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

      {showExtendedFields && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Дата и время мероприятия (по местному времени выбранной таймзоны)
            <input
              type="datetime-local"
              className="party-editor-input"
              value={eventDateTime}
              onChange={(e) => onEventDateTimeChange(e.target.value)}
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          </label>
        </div>
      )}

      {showExtendedFields && onEventEndDateTimeChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Время окончания мероприятия (по местному времени выбранной таймзоны)
            <input
              type="datetime-local"
              className="party-editor-input"
              value={eventEndDateTime}
              onChange={(e) => onEventEndDateTimeChange(e.target.value)}
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          </label>
        </div>
      )}

      {showExtendedFields && onDescriptionChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Описание
            <textarea
              className="party-editor-input"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Описание вечеринки"
              rows={3}
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          </label>
        </div>
      )}

      {showExtendedFields && onPlaceChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Место
            <input
              type="text"
              className="party-editor-input"
              value={place}
              onChange={(e) => onPlaceChange(e.target.value)}
              placeholder="Место проведения"
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          </label>
        </div>
      )}

      {showExtendedFields && onCityChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Город
            <input
              type="text"
              className="party-editor-input"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="Город"
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          </label>
        </div>
      )}

      {showExtendedFields && onScheduleChange && (
        <div className="party-editor-section">
          <label className="party-editor-label">
            Расписание
            <textarea
              className="party-editor-input"
              value={schedule}
              onChange={(e) => onScheduleChange(e.target.value)}
              placeholder="Расписание мероприятия"
              rows={3}
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          </label>
        </div>
      )}

      {showExtendedFields && onShortDescriptionChange && (
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
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
            <span className="party-editor-char-count">
              {shortDescription.length}/{MAX_SHORT_DESCRIPTION_LENGTH}
            </span>
          </label>
        </div>
      )}

      {showExtendedFields && onExternalLinkUrlChange && onExternalLinkTextChange && (
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
              readOnly={isReadOnly}
              disabled={isReadOnly}
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
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          </label>
        </div>
      )}

      {showExtendedFields && onDanceTagsChange && (
        <DanceTagsField
          tags={danceTagsProp}
          onChange={onDanceTagsChange}
          predefinedOptions={[...PREDEFINED_DANCE_TAGS]}
          maxTags={MAX_DANCE_TAGS}
          maxTagLength={MAX_DANCE_TAG_LENGTH}
          readOnly={isReadOnly}
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
            disabled={isReadOnly}
          >
            <div className="party-editor-dropdown-button-content">
              <div className="party-editor-dropdown-selected">
                <span className="party-editor-dropdown-name">{selectedStyle.name}</span>
                <span className="party-editor-dropdown-preview">{selectedStyle.preview}</span>
                {selectedLockedTheme && (
                  <span className="party-editor-theme-status-badge">Ограничен доступ</span>
                )}
              </div>
              <span className="party-editor-dropdown-arrow">{isDropdownOpen ? '▲' : '▼'}</span>
            </div>
          </button>
          {isDropdownOpen && (
            <div className="party-editor-dropdown-menu">
              {sortedStylesForDropdown.map((style) => {
                const lockedTheme = lockedThemeMap.get(style.id);
                const isLocked = Boolean(lockedTheme);
                const isSelected = themeId === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    className={`party-editor-dropdown-item ${isSelected ? 'party-editor-dropdown-item--selected' : ''} ${isLocked ? 'party-editor-dropdown-item--locked' : ''}`}
                    onClick={() => handleStyleSelect(style.id)}
                    aria-label={
                      isLocked
                        ? `${style.name}. Требуется пакет ${lockedTheme?.packageName}.`
                        : style.name
                    }
                  >
                    <div className="party-editor-dropdown-item-content">
                      <div className="party-editor-dropdown-item-name">{style.name}</div>
                      <div className="party-editor-dropdown-item-description">
                        {style.description}
                      </div>
                      <div className="party-editor-dropdown-item-preview">{style.preview}</div>
                      {isLocked && lockedTheme && (
                        <div className="party-editor-theme-lock-info">
                          {lockedTheme.packageCode === REVOKED_CURRENT_THEME_PACKAGE_CODE
                            ? 'Не доступна в пакетах'
                            : `Доступно в пакете ${lockedTheme.packageName}`}
                        </div>
                      )}
                    </div>
                    {isSelected && <span className="party-editor-dropdown-item-check">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {isThemeAccessLoading && (
          <div className="party-editor-theme-access-hint">Проверяем доступные темы...</div>
        )}
        {themeAccessErrorMessage && (
          <div className="party-editor-theme-access-hint party-editor-theme-access-hint--warning">
            {themeAccessErrorMessage}
          </div>
        )}
        {!isThemeAccessLoading && accessibleStyleIds.size === 0 && (
          <div className="party-editor-theme-access-hint">Нет доступных тем в вашем тарифе.</div>
        )}
        {selectedLockedTheme && (
          <div className="party-editor-theme-restricted-note">
            Текущая тема больше не входит в ваш доступ. Вы можете сохранить как есть или
            переключиться на доступную тему.
          </div>
        )}
      </div>

      {renderCustomizationOptions()}

      {showLifecycle && onLifecycleTransition && (
        <PartyLifecycleControls
          partyLifecycleState={effectiveLifecycle}
          isTransitioning={isTransitioningLifecycle}
          disabled={isCreating || isPublishing}
          onTransition={onLifecycleTransition}
        />
      )}

      {!isReadOnly && phase === 'ready' && (
        <p className="party-editor-ready-publish-hint">
          Вечеринка готова к запуску. Опубликуйте плейлист и метаданные на сервер, чтобы зрители
          видели актуальную программу.
        </p>
      )}

      {!isReadOnly && (showPublish || showCreate || showLinkParty) && (
        <div className="party-editor-actions">
          {showPublish && onPublish && (
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
          {showCreate && (
            <button
              className="party-editor-button party-editor-button-secondary"
              onClick={onCreateParty}
              disabled={!isAuthenticated || isCreating || !partyName.trim()}
              type="button"
              title={!isAuthenticated ? 'Требуется авторизация' : undefined}
            >
              {isCreating ? 'Создание...' : 'Создать вечеринку'}
            </button>
          )}
          {showLinkParty && onOpenLinkParty && (
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
      )}

      {!isBlocked && isCheckingParty && (
        <div className="party-editor-checking">
          <div className="party-editor-checking-message">Проверка соединения с сервером...</div>
        </div>
      )}

      {!isBlocked && serverError && !linkedParty && !isCheckingParty && (
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

      {showPartyBlock && displayParty && (
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

      {lockedThemeModal && (
        <div className="party-editor-locked-theme-modal-overlay" role="dialog" aria-modal="true">
          <div className="party-editor-locked-theme-modal">
            <h4 className="party-editor-locked-theme-title">Тема недоступна</h4>
            <p className="party-editor-locked-theme-text">
              {lockedThemeModal.packageCode === REVOKED_CURRENT_THEME_PACKAGE_CODE
                ? 'Эта тема не доступна в пакетах.'
                : `Эта тема есть в пакете ${lockedThemeModal.packageName}. Можно подключить в пару кликов.`}
            </p>
            {safeContactUrl ? (
              <a
                href={safeContactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="party-editor-locked-theme-cta"
              >
                Напиши в ВК
              </a>
            ) : (
              <p className="party-editor-locked-theme-text">
                Ссылка на ВК сейчас недоступна. Попробуй чуть позже.
              </p>
            )}
            <button
              type="button"
              className="party-editor-button party-editor-button-secondary"
              onClick={() => setLockedThemeModal(null)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
