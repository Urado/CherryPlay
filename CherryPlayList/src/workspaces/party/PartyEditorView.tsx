import React, { useMemo } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { useOnlineNetworkPolicy } from '@shared/streaming';

import { PartyCatalogVisibilityControl } from './components/PartyCatalogVisibilityControl';
import { PartyConnectivityBanner } from './components/PartyConnectivityBanner';
import { PartyEditor } from './components/PartyEditor';
import {
  PartyEditorActions,
  shouldShowPartyLifecycleControls,
} from './components/PartyEditorActions';
import { PartyEditorShell } from './components/PartyEditorShell';
import { PartyLifecycleControls } from './components/PartyLifecycleControls';
import { PartyTrackDisplaySection } from './components/PartyTrackDisplaySection';
import { usePartyEditorDemoStore } from './partyEditorDemoStore';
import {
  applyDemoBlockedOverride,
  resolvePartyEditorPhase,
  shouldPreserveShellContentWhenBlocked,
  shouldShowPartyTrackDisplaySection,
} from './partyEditorPhase';
import { PartyWorkspaceDemoPanel } from './PartyWorkspaceDemoPanel';
import './PartyEditorView.css';
import { usePartyWorkspaceRuntimeContext } from './partyWorkspaceRuntimeContext';

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
  const runtime = usePartyWorkspaceRuntimeContext();
  const { networkEnabled } = useOnlineNetworkPolicy();
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
    isListedInCatalog,
    isTogglingCatalogVisibility,
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
    handleCopyUrl,
    handleCatalogVisibilityChange,
    handleRetry,
    handleResetAndCreateNewParty,
    handleLifecycleTransition,
    openModal,
    lockedThemeInfos,
    visibleThemeIds,
  } = runtime;

  const blockedOverride = usePartyEditorDemoStore((state) =>
    showDemoPanel ? state.blockedOverride : null,
  );

  const linkedParty = meta.linkedParty;
  const phaseInput = {
    isAuth,
    isClientOutdated,
    isCheckingParty,
    linkedParty,
    partyLifecycleState,
    serverError,
  };
  const basePhaseResult = resolvePartyEditorPhase(phaseInput);
  const phaseResult = showDemoPanel
    ? applyDemoBlockedOverride(basePhaseResult, phaseInput, blockedOverride)
    : basePhaseResult;
  const phase = phaseResult.phase;
  const isBlocked = phaseResult.isBlocked;
  const blockedReason = phaseResult.blockedReason;
  const preserveShellContent = shouldPreserveShellContentWhenBlocked(blockedOverride);
  const editorPhase = isBlocked && !preserveShellContent ? null : (phase ?? 'draft-unlinked');
  const showTrackDisplay =
    shouldShowPartyTrackDisplaySection(phase) && (!isBlocked || preserveShellContent);
  const showLifecycle =
    editorPhase != null && shouldShowPartyLifecycleControls(editorPhase, linkedParty);

  const networkActionsDisabled = !networkEnabled || serverUnreachable;

  const connectivityBanner = useMemo(() => {
    if (!networkEnabled) {
      return <PartyConnectivityBanner kind="offline" />;
    }
    if (serverUnreachable && !isBlocked) {
      return (
        <PartyConnectivityBanner
          kind="unreachable"
          isReconnecting={isReconnecting}
          lastManualCheckFailed={lastManualCheckFailed}
          onManualReconnect={handleManualReconnect}
        />
      );
    }
    return null;
  }, [
    networkEnabled,
    serverUnreachable,
    isBlocked,
    isReconnecting,
    lastManualCheckFailed,
    handleManualReconnect,
  ]);

  const editorFields = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  const editorHandlers = useMemo(
    () => ({
      onPartyNameChange: setPartyName,
      onPartyTitleChange: setPartyTitle,
      onPartySubtitleChange: setPartySubtitle,
      onEventDateTimeChange: setEventDateTime,
      onEventEndDateTimeChange: handleEventEndDateTimeChange,
      onDescriptionChange: setDescription,
      onPlaceChange: setPlace,
      onCityChange: setCity,
      onScheduleChange: setSchedule,
      onShortDescriptionChange: setShortDescription,
      onExternalLinkUrlChange: setExternalLinkUrl,
      onExternalLinkTextChange: setExternalLinkText,
      onDanceTagsChange: setDanceTags,
      onTimeZoneChange: handleTimeZoneChange,
    }),
    [
      setPartyName,
      setPartyTitle,
      setPartySubtitle,
      setEventDateTime,
      handleEventEndDateTimeChange,
      setDescription,
      setPlace,
      setCity,
      setSchedule,
      setShortDescription,
      setExternalLinkUrl,
      setExternalLinkText,
      setDanceTags,
      handleTimeZoneChange,
    ],
  );

  const editorDesign = useMemo(
    () => ({
      themeId,
      customizationSettings,
      lockedThemes: lockedThemeInfos,
      isThemeAccessLoading,
      visibleThemeIds,
      themeAccessErrorMessage,
      onThemeIdChange: handleThemeChange,
      onCustomizationSettingsChange: handleCustomizationSettingsChange,
    }),
    [
      themeId,
      customizationSettings,
      lockedThemeInfos,
      isThemeAccessLoading,
      visibleThemeIds,
      themeAccessErrorMessage,
      handleThemeChange,
      handleCustomizationSettingsChange,
    ],
  );

  const editorConnection = useMemo(
    () => ({
      linkedParty,
      serverError,
      isCheckingParty,
      onRetry: handleRetry,
    }),
    [linkedParty, serverError, isCheckingParty, handleRetry],
  );

  return (
    <div className="party-editor-view">
      <PartyEditorShell
        phase={phase}
        linkedParty={linkedParty}
        onCopyUrl={linkedParty?.url ? () => void handleCopyUrl() : undefined}
        isBlocked={isBlocked}
        blockedReason={blockedReason}
        hidePhaseBadge={showLifecycle}
        connectivityBanner={connectivityBanner}
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
              {editorPhase !== 'completed' && (
                <PartyCatalogVisibilityControl
                  layout="header"
                  isListedInCatalog={isListedInCatalog}
                  disabled={networkActionsDisabled}
                  isUpdating={isTogglingCatalogVisibility}
                  networkOffline={!networkEnabled}
                  onChange={(listed) => void handleCatalogVisibilityChange(listed)}
                />
              )}
              {showLifecycle && (
                <PartyLifecycleControls
                  layout="header"
                  partyLifecycleState={partyLifecycleState ?? 'draft'}
                  isTransitioning={isTransitioningLifecycle}
                  disabled={isCreating || isPublishing || networkActionsDisabled}
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
                networkDisabled={networkActionsDisabled}
                networkOffline={!networkEnabled}
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
            fields={editorFields}
            handlers={editorHandlers}
            design={editorDesign}
            connection={editorConnection}
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
