import React from 'react';

import { WorkspaceId } from '@core/types/workspace';

import { PartyEditor } from './components/PartyEditor';
import {
  PartyEditorActions,
  shouldShowPartyLifecycleControls,
} from './components/PartyEditorActions';
import { PartyEditorShell } from './components/PartyEditorShell';
import { PartyLifecycleControls } from './components/PartyLifecycleControls';
import { PartyTrackDisplaySection } from './components/PartyTrackDisplaySection';
import {
  applyDemoBlockedOverride,
  resolvePartyEditorPhase,
  shouldPreserveShellContentWhenBlocked,
  shouldShowPartyTrackDisplaySection,
} from './partyEditorPhase';
import { PartyWorkspaceDemoPanel } from './PartyWorkspaceDemoPanel';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';
import './PartyEditorView.css';
import { usePartyWorkspaceRuntime } from './usePartyWorkspace';

interface PartyEditorViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
  showDemoPanel?: boolean;
}

export const PartyEditorView: React.FC<PartyEditorViewProps> = ({
  workspaceId: _workspaceId,
  zoneId: _zoneId,
  showDemoPanel = false,
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
    handleRetry,
    handleResetAndCreateNewParty,
    handleLifecycleTransition,
    openModal,
    lockedThemeInfos,
    visibleThemeIds,
  } = runtime;

  const demoBlockedOverride = usePartyWorkspaceStore((state) =>
    showDemoPanel ? state.demoBlockedOverride : null,
  );

  const linkedParty = meta.linkedParty;
  const phaseInput = {
    isAuth,
    isClientOutdated,
    isCheckingParty,
    serverUnreachable,
    linkedParty,
    partyLifecycleState,
    serverError,
  };
  const basePhaseResult = resolvePartyEditorPhase(phaseInput);
  const phaseResult = showDemoPanel
    ? applyDemoBlockedOverride(basePhaseResult, phaseInput, demoBlockedOverride)
    : basePhaseResult;
  const phase = phaseResult.phase;
  const isBlocked = phaseResult.isBlocked;
  const blockedReason = phaseResult.blockedReason;
  const preserveShellContent = shouldPreserveShellContentWhenBlocked(demoBlockedOverride);
  const editorPhase = isBlocked && !preserveShellContent ? null : (phase ?? 'draft-unlinked');
  const showTrackDisplay =
    shouldShowPartyTrackDisplaySection(phase) && (!isBlocked || preserveShellContent);
  const showLifecycle =
    editorPhase != null && shouldShowPartyLifecycleControls(editorPhase, linkedParty);

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
          onResetAndCreateNew: handleResetAndCreateNewParty,
        }}
        headerActions={
          editorPhase ? (
            <div className="party-editor-shell-header-toolbar">
              {showLifecycle && (
                <PartyLifecycleControls
                  layout="header"
                  partyLifecycleState={partyLifecycleState ?? 'draft'}
                  isTransitioning={isTransitioningLifecycle}
                  disabled={isCreating || isPublishing}
                  onTransition={(target) => void handleLifecycleTransition(target)}
                />
              )}
              <PartyEditorActions
                compact
                phase={editorPhase}
                partyName={partyName}
                linkedParty={linkedParty}
                isAuthenticated={isAuth}
                isCreating={isCreating}
                isPublishing={isPublishing}
                onCreateParty={handleCreateParty}
                onPublish={handlePublish}
                onOpenLinkParty={() => openModal('linkParty')}
              />
            </div>
          ) : undefined
        }
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
            linkedParty={linkedParty}
            serverError={serverError}
            isCheckingParty={isCheckingParty}
            onRetry={handleRetry}
            lockedThemes={lockedThemeInfos}
            isThemeAccessLoading={isThemeAccessLoading}
            visibleThemeIds={visibleThemeIds}
            themeAccessErrorMessage={themeAccessErrorMessage}
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

      {showDemoPanel && <PartyWorkspaceDemoPanel mode="editor" />}
    </div>
  );
};
