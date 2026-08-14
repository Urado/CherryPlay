import { useMemo } from 'react';

import {
  useAimpStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
} from '@shared/stores';
import { useOnlineNetworkPolicy } from '@shared/streaming';

import {
  getPartyEditorActionVisibility,
  shouldShowPartyCatalogVisibilityControl,
} from './components/PartyEditorActions';
import type {
  PartyEditorConnectionState,
  PartyEditorDesignState,
  PartyEditorFieldHandlers,
  PartyEditorFieldValues,
} from './components/partyEditorRuntimeTypes';
import { resolvePartyEditorPhase, shouldShowPartyTrackDisplaySection } from './partyEditorPhase';
import type { PartyWorkspaceRuntimeValue } from './partyWorkspaceRuntimeContext';
import { resolveCreateBlockedByTheme } from './partyWorkspaceUtils';
import { resolvePartyArchiveAvailability } from './resolvePartyArchiveAvailability';

export function usePartySettingsFormState(
  runtime: PartyWorkspaceRuntimeValue,
  options?: { networkEnabledOverride?: boolean },
) {
  const { networkEnabled: policyNetworkEnabled } = useOnlineNetworkPolicy();
  const isNetworkEnabledForEditor = options?.networkEnabledOverride ?? policyNetworkEnabled;

  const {
    isAuth,
    isClientOutdated,
    isCheckingParty,
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
    isSavingMetadata,
    partyLifecycleState,
    isTransitioningLifecycle,
    pendingLifecycleTransition,
    serverError,
    themeAccess,
    isThemeAccessLoading,
    themeAccessErrorMessage,
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
    handleThemeChange,
    handleCustomizationSettingsChange,
    handleEventEndDateTimeChange,
    handleTimeZoneChange,
    handleCreateParty,
    handleCopyUrl,
    handleSaveMetadata,
    handleCatalogVisibilityChange,
    handleRetry,
    handleLifecycleTransition,
    lockedThemeInfos,
    visibleThemeIds,
  } = runtime;

  const linkedParty = meta.linkedParty;
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const playbackStatus = usePlayerAudioStore((state) => state.status);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const aimpLiveStreamStarted = useAimpStore((state) => state.bridgeState.liveStreamStarted);
  const aimpPlaybackStatus = useAimpStore(
    (state) => state.bridgeState.playbackSnapshot?.status ?? null,
  );

  const phaseResult = resolvePartyEditorPhase({
    isAuth,
    isClientOutdated,
    isCheckingParty,
    linkedParty,
    partyLifecycleState,
    serverError,
  });
  const phase = phaseResult.phase;
  const isBlocked = phaseResult.isBlocked;
  const editorPhase = isBlocked ? null : (phase ?? 'draft-unlinked');
  const showTrackDisplay = shouldShowPartyTrackDisplaySection(phase);
  const showCatalog = editorPhase != null && shouldShowPartyCatalogVisibilityControl(editorPhase);
  const showCopyUrl =
    Boolean(linkedParty?.url) &&
    (editorPhase === 'draft-linked' || editorPhase === 'ready' || editorPhase === 'completed');
  const networkActionsDisabled = !isNetworkEnabledForEditor;

  const isCurrentThemeLocked = lockedThemeInfos.some((item) => item.themeId === themeId);
  const createBlockedByThemeResult = resolveCreateBlockedByTheme({
    themeAccess,
    isCurrentThemeLocked,
  });
  const createBlockedByTheme = createBlockedByThemeResult.blocked;
  const createBlockedByThemeTitle = createBlockedByThemeResult.title;

  const archiveAvailability = resolvePartyArchiveAvailability({
    partyLifecycleState,
    sessionMode,
    playbackStatus: sessionMode === 'session' ? playbackStatus : null,
    aimpLiveStreamStarted,
    aimpPlaybackStatus,
    streamingSource,
  });

  const editorFields: PartyEditorFieldValues = useMemo(
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

  const editorHandlers: PartyEditorFieldHandlers = useMemo(
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

  const editorDesign: PartyEditorDesignState = useMemo(
    () => ({
      themeId,
      customizationSettings,
      lockedThemes: lockedThemeInfos,
      hasThemeAccess: Boolean(themeAccess),
      networkEnabled: isNetworkEnabledForEditor,
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
      themeAccess,
      isNetworkEnabledForEditor,
      isThemeAccessLoading,
      visibleThemeIds,
      themeAccessErrorMessage,
      handleThemeChange,
      handleCustomizationSettingsChange,
    ],
  );

  const editorConnection: PartyEditorConnectionState = useMemo(
    () => ({
      linkedParty,
      serverError,
      isCheckingParty,
      onRetry: handleRetry,
    }),
    [linkedParty, serverError, isCheckingParty, handleRetry],
  );

  const actionVisibility = editorPhase
    ? getPartyEditorActionVisibility(editorPhase, {
        isAuthenticated: isAuth,
        hasOnOpenLinkParty: true,
      })
    : null;

  return {
    editorPhase,
    isBlocked,
    showTrackDisplay,
    showCatalog,
    showCopyUrl,
    networkActionsDisabled,
    isNetworkEnabledForEditor,
    createBlockedByTheme,
    createBlockedByThemeTitle,
    archiveAvailability,
    editorFields,
    editorHandlers,
    editorDesign,
    editorConnection,
    actionVisibility,
    partyTrackDisplay,
    setPartyTrackDisplaySettings,
    isListedInCatalog,
    isTogglingCatalogVisibility,
    isCreating,
    isSavingMetadata,
    isTransitioningLifecycle,
    pendingLifecycleTransition,
    isAuth,
    handleCreateParty,
    handleCopyUrl,
    handleSaveMetadata,
    handleCatalogVisibilityChange,
    handleLifecycleTransition,
  };
}
