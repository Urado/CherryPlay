import {
  useAimpStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
} from '@shared/stores';
import { useOnlineNetworkPolicy } from '@shared/streaming';
import { useMemo } from 'react';

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
import { resolvePartyEditorPhase } from './partyEditorPhase';
import { resolvePartyPlaybackSourceState } from './partyPlaybackSource';
import type { PartyWorkspaceRuntimeValue } from './partyWorkspaceRuntimeContext';
import { resolveCreateBlockedByTheme } from './partyWorkspaceUtils';
import { resolvePartyArchiveAvailability } from './resolvePartyArchiveAvailability';

export const usePartySettingsFormState = (
  runtime: PartyWorkspaceRuntimeValue,
  options?: { networkEnabledOverride?: boolean },
) => {
  const { networkEnabled: policyNetworkEnabled } = useOnlineNetworkPolicy();
  const isNetworkEnabledForEditor = options?.networkEnabledOverride ?? policyNetworkEnabled;

  const {
    isAuth,
    isClientOutdated,
    isCheckingParty,
    meta,
    groupDisplayDepth,
    setGroupDisplayDepth,
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
  const aimpBridgeState = useAimpStore((state) => state.bridgeState);

  const phaseResult = resolvePartyEditorPhase({
    isAuth,
    isClientOutdated,
    isCheckingParty,
    linkedParty,
    partyLifecycleState,
    serverError,
  });
  const isBlocked = phaseResult.isBlocked;
  const editorPhase = resolvePartyEditorPhase({
    isAuth: true,
    isClientOutdated: false,
    isCheckingParty: false,
    linkedParty,
    partyLifecycleState,
    serverError,
  }).phase;
  const showCatalog =
    editorPhase != null &&
    shouldShowPartyCatalogVisibilityControl(editorPhase) &&
    (!linkedParty || !isBlocked);
  const showCopyUrl =
    Boolean(linkedParty?.shortCode) &&
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
    partyLifecycleState: isBlocked ? null : partyLifecycleState,
    playbackSourceState: resolvePartyPlaybackSourceState(streamingSource, {
      sessionMode,
      playerPlaybackStatus: playbackStatus,
      aimpBridgeState,
    }),
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

  const showActions =
    !isBlocked || (!linkedParty && !isAuth && !isCheckingParty && !isClientOutdated);
  const actionVisibility =
    editorPhase && showActions
      ? getPartyEditorActionVisibility(editorPhase, {
          isAuthenticated: isAuth,
          hasOnOpenLinkParty: true,
        })
      : null;

  return {
    editorPhase,
    isBlocked,
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
    groupDisplayDepth,
    setGroupDisplayDepth,
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
};
