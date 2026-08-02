import { Button } from '@cherryplay/components';
import React, { useMemo } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { useProjectStore } from '@shared/stores';
import { useOnlineNetworkPolicy } from '@shared/streaming';

import { PartyCatalogVisibilityControl } from './components/PartyCatalogVisibilityControl';
import { PartyConnectivityBanner } from './components/PartyConnectivityBanner';
import { PartyEditor } from './components/PartyEditor';
import {
  getPartyEditorActionVisibility,
  PartyEditorActions,
  shouldShowPartyCatalogVisibilityControl,
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
  const isNetworkEnabledForEditor = showDemoPanel ? true : networkEnabled;
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
    pendingLifecycleTransition,
    serverError,
    isThemeAccessLoading,
    themeAccessErrorMessage,
    themeEntitlementModal,
    themeAccess,
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
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
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
  const showCatalog = editorPhase != null && shouldShowPartyCatalogVisibilityControl(editorPhase);
  const showCopyUrl =
    Boolean(linkedParty?.url) && (editorPhase === 'draft-linked' || editorPhase === 'ready');
  const showGuestAccess = showCatalog || showCopyUrl;

  const networkActionsDisabled = !isNetworkEnabledForEditor || serverUnreachable;

  const isCurrentThemeLocked = lockedThemeInfos.some((item) => item.themeId === themeId);
  const createBlockedByTheme = isThemeAccessLoading || !themeAccess || isCurrentThemeLocked;
  const createBlockedByThemeTitle = isCurrentThemeLocked
    ? 'Выберите тему, доступную в вашем тарифе'
    : isThemeAccessLoading || !themeAccess
      ? (themeAccessErrorMessage ?? 'Дождитесь проверки доступа к темам')
      : undefined;

  const connectivityBanner = !isNetworkEnabledForEditor ? (
    <PartyConnectivityBanner kind="offline" />
  ) : serverUnreachable && !isBlocked ? (
    <PartyConnectivityBanner
      kind="unreachable"
      isReconnecting={isReconnecting}
      lastManualCheckFailed={lastManualCheckFailed}
      onManualReconnect={handleManualReconnect}
    />
  ) : null;

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

  const editorActionVisibility = editorPhase
    ? getPartyEditorActionVisibility(editorPhase, {
        isAuthenticated: isAuth,
        hasOnPublish: true,
        hasOnOpenLinkParty: true,
      })
    : null;

  const editorActionProps = editorPhase
    ? {
        compact: true as const,
        phase: editorPhase,
        partyName,
        linkedParty,
        isAuthenticated: isAuth,
        isCreating,
        isPublishing,
        networkDisabled: networkActionsDisabled,
        networkOffline: !isNetworkEnabledForEditor,
        createBlockedByTheme,
        createBlockedByThemeTitle,
        onCreateParty: handleCreateParty,
        onPublish: handlePublish,
        onOpenLinkParty: () => openModal('linkParty'),
      }
    : null;

  const showSecondaryEditorActions = Boolean(
    editorActionVisibility &&
    ((editorActionVisibility.showLinkParty && isAuth) ||
      (editorActionVisibility.showPublish && editorPhase === 'draft-linked')),
  );
  const showAccentEditorActions = Boolean(
    editorActionVisibility &&
    (editorActionVisibility.showCreate ||
      (editorActionVisibility.showPublish && editorPhase === 'ready')),
  );

  const lifecycleState = partyLifecycleState ?? 'draft';
  const showSecondaryLifecycle = showLifecycle && lifecycleState === 'ready';
  const showAccentLifecycle = showLifecycle && lifecycleState === 'draft';

  const secondaryEditorActions =
    showSecondaryEditorActions && editorActionProps ? (
      <PartyEditorActions {...editorActionProps} slot="secondary" />
    ) : null;
  const accentEditorActions =
    showAccentEditorActions && editorActionProps ? (
      <PartyEditorActions {...editorActionProps} slot="accent" />
    ) : null;

  const secondaryLifecycle = showSecondaryLifecycle ? (
    <PartyLifecycleControls
      layout="header"
      slot="secondary"
      partyLifecycleState={lifecycleState}
      isTransitioning={isTransitioningLifecycle}
      pendingTransition={pendingLifecycleTransition}
      disabled={isCreating || isPublishing || networkActionsDisabled}
      sessionMode={sessionMode}
      onTransition={(target) => void handleLifecycleTransition(target)}
    />
  ) : null;

  const accentLifecycle = showAccentLifecycle ? (
    <PartyLifecycleControls
      layout="header"
      slot="accent"
      partyLifecycleState={lifecycleState}
      isTransitioning={isTransitioningLifecycle}
      pendingTransition={pendingLifecycleTransition}
      disabled={isCreating || isPublishing || networkActionsDisabled}
      sessionMode={sessionMode}
      onTransition={(target) => void handleLifecycleTransition(target)}
    />
  ) : null;

  const guestAccessGroup = showGuestAccess ? (
    <div className="party-editor-shell-header-group" role="group" aria-label="Доступ гостей">
      {showCatalog && (
        <PartyCatalogVisibilityControl
          layout="header"
          isListedInCatalog={isListedInCatalog}
          disabled={networkActionsDisabled}
          isUpdating={isTogglingCatalogVisibility}
          networkOffline={!isNetworkEnabledForEditor}
          onChange={(listed) => void handleCatalogVisibilityChange(listed)}
        />
      )}
      {showCopyUrl ? (
        <Button type="button" onClick={() => void handleCopyUrl()} variant="secondary" size="sm">
          Скопировать URL
        </Button>
      ) : null}
    </div>
  ) : null;

  const hasSecondaryToolbar =
    showSecondaryEditorActions || showSecondaryLifecycle || showGuestAccess;
  const hasAccentToolbar = showAccentEditorActions || showAccentLifecycle;

  return (
    <div className="party-editor-view">
      <PartyEditorShell
        phase={phase}
        isBlocked={isBlocked}
        blockedReason={blockedReason}
        hidePhaseBadge={showLifecycle}
        sessionMode={sessionMode}
        connectivityBanner={connectivityBanner}
        blockedOverlayProps={{
          clientRequiredVersion,
          isReconnecting,
          lastManualCheckFailed,
          onManualReconnect: handleManualReconnect,
          onResetAndCreateNew: handleResetAndCreateNewParty,
        }}
        headerActions={
          editorPhase &&
          editorPhase !== 'completed' &&
          (hasSecondaryToolbar || hasAccentToolbar) ? (
            <div className="party-editor-shell-header-toolbar">
              {hasAccentToolbar ? (
                <div className="party-editor-shell-header-toolbar-accent">
                  {accentLifecycle}
                  {accentEditorActions}
                </div>
              ) : null}
              {hasSecondaryToolbar ? (
                <div className="party-editor-shell-header-toolbar-secondary">
                  {secondaryEditorActions ? (
                    <div className="party-editor-shell-header-group">{secondaryEditorActions}</div>
                  ) : null}
                  {secondaryLifecycle ? (
                    <div className="party-editor-shell-header-group party-editor-shell-header-group--transitions">
                      {secondaryLifecycle}
                    </div>
                  ) : null}
                  {guestAccessGroup}
                </div>
              ) : null}
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
