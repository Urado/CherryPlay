import { type PartyThemeId } from '@cherryplay/components';
import React from 'react';

import type { PartyEditorPhase } from '../partyEditorPhase';

import {
  PartyDesignSettingsBlock,
  type PartyDesignLockedThemeInfo,
} from './PartyDesignSettingsBlock';
import { PartyExtendedFieldsSection } from './PartyExtendedFieldsSection';

import './PartyEditor.css';

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
  linkedParty?: { id: string; shortCode: string; url?: string } | null;
  serverError: string | null;
  isCheckingParty: boolean;
  onRetry?: () => void;
  lockedThemes?: PartyDesignLockedThemeInfo[];
  isThemeAccessLoading?: boolean;
  visibleThemeIds?: PartyThemeId[] | null;
  themeAccessErrorMessage?: string | null;
  phase: PartyEditorPhase;
  /** When true, shell overlay handles blocked states — hide checking/error UI. */
  isBlocked?: boolean;
}

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
  linkedParty,
  serverError,
  isCheckingParty,
  onRetry,
  lockedThemes = [],
  isThemeAccessLoading = false,
  visibleThemeIds = null,
  themeAccessErrorMessage = null,
  phase,
  isBlocked = false,
}) => {
  const isReadOnly = phase === 'completed';
  const showExtendedFields = phase !== 'draft-unlinked';
  const accessibleStyleIds = new Set(
    (visibleThemeIds ?? [])
      .filter((id) => !lockedThemes.some((locked) => locked.themeId === id))
      .map((id) => id),
  );
  const selectedLockedTheme = lockedThemes.find((item) => item.themeId === themeId) ?? null;

  return (
    <div className={`party-editor${isReadOnly ? ' party-editor--read-only' : ''}`}>
      <PartyDesignSettingsBlock
        themeId={themeId}
        customizationSettings={customizationSettings}
        onThemeIdChange={onThemeIdChange}
        onCustomizationSettingsChange={onCustomizationSettingsChange}
        readOnly={isReadOnly}
        lockedThemes={lockedThemes}
        visibleThemeIds={visibleThemeIds}
        isThemeAccessLoading={isThemeAccessLoading}
        themeAccessErrorMessage={themeAccessErrorMessage}
      />
      {!isThemeAccessLoading && visibleThemeIds != null && accessibleStyleIds.size === 0 && (
        <div className="party-editor-theme-access-hint">Нет доступных тем в вашем тарифе.</div>
      )}
      {selectedLockedTheme && (
        <div className="party-editor-theme-restricted-note">
          Текущая тема больше не входит в ваш доступ. Вы можете сохранить как есть или переключиться
          на доступную тему.
        </div>
      )}

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

      {showExtendedFields && (
        <PartyExtendedFieldsSection
          eventDateTime={eventDateTime}
          eventEndDateTime={eventEndDateTime}
          description={description}
          place={place}
          city={city}
          schedule={schedule}
          timeZone={timeZone}
          shortDescription={shortDescription}
          externalLinkUrl={externalLinkUrl}
          externalLinkText={externalLinkText}
          danceTags={danceTagsProp}
          readOnly={isReadOnly}
          onEventDateTimeChange={onEventDateTimeChange}
          onEventEndDateTimeChange={onEventEndDateTimeChange}
          onDescriptionChange={onDescriptionChange}
          onPlaceChange={onPlaceChange}
          onCityChange={onCityChange}
          onScheduleChange={onScheduleChange}
          onShortDescriptionChange={onShortDescriptionChange}
          onExternalLinkUrlChange={onExternalLinkUrlChange}
          onExternalLinkTextChange={onExternalLinkTextChange}
          onDanceTagsChange={onDanceTagsChange}
          onTimeZoneChange={onTimeZoneChange}
        />
      )}

      {!isReadOnly && phase === 'ready' && (
        <p className="party-editor-ready-publish-hint">
          Вечеринка готова к запуску. Опубликуйте плейлист и метаданные на сервер, чтобы зрители
          видели актуальную программу.
        </p>
      )}

      {!isBlocked && isCheckingParty && (
        <div className="party-editor-checking" aria-busy="true" aria-live="polite">
          <div className="party-editor-checking-message">
            Идёт проверка соединения с сервером...
          </div>
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
    </div>
  );
};
