import React from 'react';

import type { PartyEditorPhase } from '../partyEditorPhase';

import { PartyCardFieldsSection } from './PartyCardFieldsSection';
import { PartyDesignSection } from './PartyDesignSection';
import type {
  PartyEditorConnectionState,
  PartyEditorDesignState,
  PartyEditorFieldHandlers,
  PartyEditorFieldValues,
} from './partyEditorRuntimeTypes';
import { PartyExtendedFieldsSection } from './PartyExtendedFieldsSection';
import { PartyInfoSection } from './PartyInfoSection';

import './PartyEditor.css';

interface PartyEditorProps {
  phase: PartyEditorPhase;
  fields: PartyEditorFieldValues;
  handlers: PartyEditorFieldHandlers;
  design: PartyEditorDesignState;
  connection: PartyEditorConnectionState;
  isBlocked?: boolean;
}

export const PartyEditor: React.FC<PartyEditorProps> = ({
  phase,
  fields,
  handlers,
  design,
  connection,
  isBlocked = false,
}) => {
  const {
    partyName,
    partyTitle,
    partySubtitle,
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
  } = fields;

  const {
    onPartyNameChange,
    onPartyTitleChange,
    onPartySubtitleChange,
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
  } = handlers;

  const {
    themeId,
    customizationSettings,
    lockedThemes,
    isThemeAccessLoading,
    visibleThemeIds,
    themeAccessErrorMessage,
    onThemeIdChange,
    onCustomizationSettingsChange,
  } = design;

  const { linkedParty, serverError, isCheckingParty, onRetry } = connection;

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
      <PartyDesignSection
        themeId={themeId}
        customizationSettings={customizationSettings}
        onThemeIdChange={onThemeIdChange}
        onCustomizationSettingsChange={onCustomizationSettingsChange}
        readOnly={isReadOnly}
        lockedThemes={lockedThemes}
        visibleThemeIds={visibleThemeIds}
        isThemeAccessLoading={isThemeAccessLoading}
        themeAccessErrorMessage={themeAccessErrorMessage}
        showNoAccessibleThemesHint={
          !isThemeAccessLoading && visibleThemeIds != null && accessibleStyleIds.size === 0
        }
        selectedLockedTheme={selectedLockedTheme}
      />

      <PartyInfoSection
        partyName={partyName}
        partyTitle={partyTitle}
        partySubtitle={partySubtitle}
        readOnly={isReadOnly}
        onPartyNameChange={onPartyNameChange}
        onPartyTitleChange={onPartyTitleChange}
        onPartySubtitleChange={onPartySubtitleChange}
      />

      {showExtendedFields && (
        <>
          <PartyCardFieldsSection
            eventDateTime={eventDateTime}
            eventEndDateTime={eventEndDateTime}
            city={city}
            timeZone={timeZone}
            shortDescription={shortDescription}
            externalLinkUrl={externalLinkUrl}
            externalLinkText={externalLinkText}
            danceTags={danceTags}
            readOnly={isReadOnly}
            onEventDateTimeChange={onEventDateTimeChange}
            onEventEndDateTimeChange={onEventEndDateTimeChange}
            onCityChange={onCityChange}
            onShortDescriptionChange={onShortDescriptionChange}
            onExternalLinkUrlChange={onExternalLinkUrlChange}
            onExternalLinkTextChange={onExternalLinkTextChange}
            onDanceTagsChange={onDanceTagsChange}
            onTimeZoneChange={onTimeZoneChange}
          />
          <PartyExtendedFieldsSection
            description={description}
            place={place}
            schedule={schedule}
            readOnly={isReadOnly}
            onDescriptionChange={onDescriptionChange}
            onPlaceChange={onPlaceChange}
            onScheduleChange={onScheduleChange}
          />
        </>
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
