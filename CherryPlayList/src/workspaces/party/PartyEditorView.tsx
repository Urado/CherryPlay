import React from 'react';

import { WorkspaceId } from '@core/types/workspace';

import { PartyEditor } from './components/PartyEditor';
import { PartyEditorShell } from './components/PartyEditorShell';
import { PartyTrackDisplaySection } from './components/PartyTrackDisplaySection';
import { resolvePartyEditorPhase, shouldShowPartyTrackDisplaySection } from './partyEditorPhase';
import './PartyEditorView.css';
import { usePartyWorkspaceRuntime } from './usePartyWorkspace';

interface PartyEditorViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PartyEditorView: React.FC<PartyEditorViewProps> = ({
  workspaceId: _workspaceId,
  zoneId: _zoneId,
}) => {
  const runtime = usePartyWorkspaceRuntime();
  const {
    isAuth,
    isClientOutdated,
    clientRequiredVersion,
    isCheckingParty,
    serverUnreachable,
    isReconnecting,
    lastManualCheckFailed,
    handleManualReconnect,
    meta,
    partyTrackDisplay,
    setPartyTrackDisplaySettings,
    partyName,
    partyTitle,
    partySubtitle,
    themeId,
    customizationSettings,
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
    isCreating,
    isPublishing,
    partyLifecycleState,
    isTransitioningLifecycle,
    serverError,
    themeAccess,
    isThemeAccessLoading,
    themeAccessErrorMessage,
    themeEntitlementModal,
    setPartyName,
    setPartyTitle,
    setPartySubtitle,
    setEventDateTime,
    setDescription,
    setPlace,
    setCity,
    setSchedule,
    setShortDescription,
    setExternalLinkUrl,
    setExternalLinkText,
    setDanceTags,
    setThemeEntitlementModal,
    handleThemeChange,
    handleCustomizationSettingsChange,
    handleEventEndDateTimeChange,
    handleTimeZoneChange,
    handleCreateParty,
    handlePublish,
    handleCopyUrl,
    handleRetry,
    handleLifecycleTransition,
    openModal,
    lockedThemeInfos,
    visibleThemeIds,
  } = runtime;

  const linkedParty = meta.linkedParty;
  const phaseResult = resolvePartyEditorPhase({
    isAuth,
    isClientOutdated,
    isCheckingParty,
    serverUnreachable,
    linkedParty,
    partyLifecycleState,
  });
  const { phase, isBlocked, blockedReason } = phaseResult;
  const editorPhase = isBlocked ? null : (phase ?? 'draft-unlinked');
  const showTrackDisplay = !isBlocked && shouldShowPartyTrackDisplaySection(phase);

  return (
    <div className="party-editor-view">
      <PartyEditorShell
        phase={phase}
        linkedParty={linkedParty}
        isBlocked={isBlocked}
        blockedReason={blockedReason}
        blockedOverlayProps={{
          clientRequiredVersion,
          isReconnecting,
          lastManualCheckFailed,
          onManualReconnect: handleManualReconnect,
        }}
      >
        {showTrackDisplay && (
          <PartyTrackDisplaySection
            value={partyTrackDisplay}
            onChange={setPartyTrackDisplaySettings}
          />
        )}
        {editorPhase && (
          <PartyEditor
            phase={editorPhase}
            partyName={partyName}
            partyTitle={partyTitle}
            partySubtitle={partySubtitle}
            themeId={themeId}
            customizationSettings={customizationSettings}
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
            danceTags={danceTags}
            onPartyNameChange={setPartyName}
            onPartyTitleChange={setPartyTitle}
            onPartySubtitleChange={setPartySubtitle}
            onThemeIdChange={handleThemeChange}
            onCustomizationSettingsChange={handleCustomizationSettingsChange}
            onEventDateTimeChange={setEventDateTime}
            onEventEndDateTimeChange={handleEventEndDateTimeChange}
            onDescriptionChange={setDescription}
            onPlaceChange={setPlace}
            onCityChange={setCity}
            onScheduleChange={setSchedule}
            onShortDescriptionChange={setShortDescription}
            onExternalLinkUrlChange={setExternalLinkUrl}
            onExternalLinkTextChange={setExternalLinkText}
            onDanceTagsChange={setDanceTags}
            onTimeZoneChange={handleTimeZoneChange}
            onCreateParty={handleCreateParty}
            onPublish={handlePublish}
            isCreating={isCreating}
            isPublishing={isPublishing}
            isAuthenticated={isAuth}
            linkedParty={linkedParty}
            serverError={serverError}
            isCheckingParty={isCheckingParty}
            onCopyUrl={handleCopyUrl}
            onRetry={handleRetry}
            onOpenLinkParty={() => openModal('linkParty')}
            lockedThemes={lockedThemeInfos}
            accessContactUrl={themeAccess?.contactUrl ?? ''}
            isThemeAccessLoading={isThemeAccessLoading}
            visibleThemeIds={visibleThemeIds}
            themeAccessErrorMessage={themeAccessErrorMessage}
            partyLifecycleState={partyLifecycleState}
            isTransitioningLifecycle={isTransitioningLifecycle}
            onLifecycleTransition={(target) => void handleLifecycleTransition(target)}
            hideLinkedPartyBlock={Boolean(linkedParty)}
            isBlocked={isBlocked}
          />
        )}
      </PartyEditorShell>

      {themeEntitlementModal && (
        <div className="party-editor-locked-theme-modal-overlay" role="dialog" aria-modal="true">
          <div className="party-editor-locked-theme-modal">
            <h4 className="party-editor-locked-theme-title">Тема недоступна</h4>
            <p className="party-editor-locked-theme-text">
              {themeEntitlementModal.message} Можно подключить быстро, если нужно.
            </p>
            {themeEntitlementModal.safeContactUrl ? (
              <a
                href={themeEntitlementModal.safeContactUrl}
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
              onClick={() => setThemeEntitlementModal(null)}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
