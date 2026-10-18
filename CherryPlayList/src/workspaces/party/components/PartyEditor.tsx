import { usePartyPublicUrl } from '@shared/hooks/usePartyPublicUrl';
import { useProjectStore } from '@shared/stores/projectStore';
import React from 'react';

import type { PartyEditorPhase } from '../partyEditorPhase';
import type { PartySettingsSection } from '../partySettingsUiStore';

import { PartyCatalogSection } from './PartyCatalogSection';
import { PartyDesignSection } from './PartyDesignSection';
import type {
  PartyEditorConnectionState,
  PartyEditorDesignState,
  PartyEditorFieldHandlers,
  PartyEditorFieldValues,
} from './partyEditorRuntimeTypes';
import { PartyGeneralSection } from './PartyGeneralSection';
import { PartyGuestPageSection } from './PartyGuestPageSection';

import './PartyEditor.css';

export type PartyEditorSectionMode = Exclude<PartySettingsSection, 'danger'> | 'all';

interface PartyEditorProps {
  phase: PartyEditorPhase;
  section: PartyEditorSectionMode;
  fields: PartyEditorFieldValues;
  handlers: PartyEditorFieldHandlers;
  design: PartyEditorDesignState;
  connection: PartyEditorConnectionState;
  isBlocked?: boolean;
  aboutActions?: React.ReactNode;
  defaultExpanded?: boolean;
  designPreviewHint?: React.ReactNode;
  showCopyUrl?: boolean;
  copyUrlDisabled?: boolean;
  copyUrlTitle?: string;
  onCopyUrl?: () => void;
  catalogVisibilityControl?: React.ReactNode;
  catalogDefaultExpanded?: boolean;
  catalogExpanded?: boolean;
  onCatalogExpandedChange?: (expanded: boolean) => void;
  catalogSectionRef?: React.Ref<HTMLElement>;
  isListedInCatalog?: boolean;
  showDraftCatalogHint?: boolean;
}

export const PartyEditor: React.FC<PartyEditorProps> = ({
  phase,
  section,
  fields,
  handlers,
  design,
  connection,
  isBlocked = false,
  aboutActions,
  defaultExpanded = false,
  designPreviewHint,
  showCopyUrl = false,
  copyUrlDisabled = false,
  copyUrlTitle,
  onCopyUrl,
  catalogVisibilityControl,
  catalogDefaultExpanded = false,
  catalogExpanded,
  onCatalogExpandedChange,
  catalogSectionRef,
  isListedInCatalog = false,
  showDraftCatalogHint = false,
}) => {
  const projectName = useProjectStore((state) => state.name);
  const {
    partyName,
    partyTitle,
    partySubtitle,
    eventDateTime,
    eventEndDateTime,
    city,
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
    onCityChange,
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
    hasThemeAccess,
    networkEnabled: designNetworkEnabled,
    isThemeAccessLoading,
    visibleThemeIds,
    themeAccessErrorMessage,
    onThemeIdChange,
    onCustomizationSettingsChange,
  } = design;

  const { linkedParty, serverError, isCheckingParty, onRetry } = connection;
  const partyUrl = usePartyPublicUrl(linkedParty?.shortCode, linkedParty?.url);

  const isReadOnly = phase === 'completed';
  const showAllSections = section === 'all';
  const showAbout = section === 'about' || showAllSections;
  const showDesign = section === 'design' || showAllSections;
  const showGuestPage = showAllSections;
  const accessibleStyleIds = new Set(
    (visibleThemeIds ?? [])
      .filter((id) => !lockedThemes.some((locked) => locked.themeId === id))
      .map((id) => id),
  );
  const selectedLockedTheme = lockedThemes.find((item) => item.themeId === themeId) ?? null;

  const designSectionProps = {
    themeId,
    customizationSettings,
    onThemeIdChange,
    onCustomizationSettingsChange,
    readOnly: isReadOnly,
    lockedThemes,
    visibleThemeIds,
    hasThemeAccess,
    networkEnabled: designNetworkEnabled,
    isThemeAccessLoading,
    themeAccessErrorMessage,
    showNoAccessibleThemesHint:
      !isThemeAccessLoading && visibleThemeIds != null && accessibleStyleIds.size === 0,
    selectedLockedTheme,
    designPreviewHint,
    defaultExpanded,
  };

  return (
    <div className={`party-editor${isReadOnly ? ' party-editor--read-only' : ''}`}>
      {showAbout ? (
        <>
          <PartyGeneralSection
            readOnly={isReadOnly}
            catalogVisibilityControl={catalogVisibilityControl}
            partyUrl={partyUrl}
            showCopyUrl={showCopyUrl}
            copyUrlDisabled={copyUrlDisabled}
            copyUrlTitle={copyUrlTitle}
            onCopyUrl={onCopyUrl}
          />

          {showGuestPage ? (
            <PartyGuestPageSection
              partyTitle={partyTitle}
              partySubtitle={partySubtitle}
              projectName={projectName}
              readOnly={isReadOnly}
              defaultExpanded={defaultExpanded}
              designPreviewHint={designPreviewHint}
              onPartyTitleChange={onPartyTitleChange}
              onPartySubtitleChange={onPartySubtitleChange}
              {...designSectionProps}
            />
          ) : null}

          <PartyCatalogSection
            partyName={partyName}
            onPartyNameChange={onPartyNameChange}
            projectName={projectName}
            eventDateTime={eventDateTime}
            eventEndDateTime={eventEndDateTime}
            city={city}
            timeZone={timeZone}
            shortDescription={shortDescription}
            externalLinkUrl={externalLinkUrl}
            externalLinkText={externalLinkText}
            danceTags={danceTags}
            readOnly={isReadOnly}
            defaultExpanded={catalogDefaultExpanded || defaultExpanded}
            expanded={catalogExpanded}
            onExpandedChange={onCatalogExpandedChange}
            sectionRef={catalogSectionRef}
            isListedInCatalog={isListedInCatalog}
            editorPhase={phase}
            showDraftCatalogHint={showDraftCatalogHint}
            onEventDateTimeChange={onEventDateTimeChange}
            onEventEndDateTimeChange={onEventEndDateTimeChange}
            onCityChange={onCityChange}
            onShortDescriptionChange={onShortDescriptionChange}
            onExternalLinkUrlChange={onExternalLinkUrlChange}
            onExternalLinkTextChange={onExternalLinkTextChange}
            onDanceTagsChange={onDanceTagsChange}
            onTimeZoneChange={onTimeZoneChange}
          />
        </>
      ) : null}

      {showDesign && !showGuestPage ? <PartyDesignSection {...designSectionProps} /> : null}

      {showAbout ? (
        <>
          {aboutActions}

          {!isBlocked && isCheckingParty ? (
            <div className="party-editor-checking" aria-busy="true" aria-live="polite">
              <div className="party-editor-checking-message">
                Идёт проверка соединения с сервером...
              </div>
            </div>
          ) : null}

          {!isBlocked && serverError && !linkedParty && !isCheckingParty ? (
            <div className="party-editor-error">
              <div className="party-editor-error-header">
                <strong className="party-editor-error-title">Ошибка подключения</strong>
              </div>
              <div className="party-editor-error-message">
                <p>{serverError}</p>
                <p className="party-editor-error-hint">Убедитесь, что сервер запущен и доступен.</p>
              </div>
              {onRetry ? (
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
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
