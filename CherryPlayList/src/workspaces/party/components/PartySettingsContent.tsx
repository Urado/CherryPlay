import React, { useCallback, useRef, useState } from 'react';

import type { PartyWorkspaceRuntimeValue } from '../partyWorkspaceRuntimeContext';
import { usePartySettingsFormState } from '../usePartySettingsFormState';

import { PartyCatalogVisibilityControl } from './PartyCatalogVisibilityControl';
import { PartyConnectivityBanner } from './PartyConnectivityBanner';
import { PartyEditor } from './PartyEditor';
import { PartyEditorActions } from './PartyEditorActions';
import { PartyEditorDangerZone } from './PartyEditorDangerZone';
import { PartySettingsCatalogStatusChip } from './PartySettingsCatalogStatusChip';

export interface PartySettingsContentProps {
  runtime: PartyWorkspaceRuntimeValue;
  onOpenLinkParty: () => void;
  onPartyCreated: () => void;
}

export const notifyParentAfterPartyCreated = (
  created: boolean,
  onPartyCreated: () => void,
): void => {
  if (created) {
    onPartyCreated();
  }
};

export const PartySettingsContent: React.FC<PartySettingsContentProps> = ({
  runtime,
  onOpenLinkParty,
  onPartyCreated,
}) => {
  const form = usePartySettingsFormState(runtime);
  const catalogSectionRef = useRef<HTMLElement>(null);
  const [catalogExpanded, setCatalogExpanded] = useState<boolean | undefined>(undefined);

  const handleCreateParty = () => {
    void form.handleCreateParty().then((created) => {
      notifyParentAfterPartyCreated(created, onPartyCreated);
    });
  };

  const focusCatalogSection = useCallback(() => {
    setCatalogExpanded(true);
    requestAnimationFrame(() => {
      catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const connectivityBanner = !form.isNetworkEnabledForEditor ? (
    <PartyConnectivityBanner
      kind="offline"
      offlineHint="Включите «Онлайн» в настройках приложения (шестерёнка), а не здесь. Локальное редактирование полей вечеринки доступно."
    />
  ) : runtime.serverUnreachable ? (
    <PartyConnectivityBanner
      kind="unreachable"
      isReconnecting={runtime.isReconnecting}
      lastManualCheckFailed={runtime.lastManualCheckFailed}
      onManualReconnect={() => void runtime.handleManualReconnect()}
    />
  ) : null;

  const archiveZone = form.archiveAvailability.showDangerSection ? (
    <PartyEditorDangerZone
      availability={form.archiveAvailability}
      disabled={form.isCreating || form.isSavingMetadata || form.networkActionsDisabled}
      isTransitioning={
        form.isTransitioningLifecycle && form.pendingLifecycleTransition === 'completed'
      }
      onArchive={() => void form.handleLifecycleTransition('completed')}
    />
  ) : null;

  const catalogVisibilityControl =
    form.editorPhase && form.showCatalog ? (
      <PartyCatalogVisibilityControl
        layout="header"
        isListedInCatalog={form.isListedInCatalog}
        disabled={form.networkActionsDisabled || form.editorPhase === 'completed'}
        isUpdating={form.isTogglingCatalogVisibility}
        networkOffline={!form.isNetworkEnabledForEditor}
        onChange={(listed) => void form.handleCatalogVisibilityChange(listed)}
      />
    ) : null;

  const primaryActions =
    form.editorPhase && form.actionVisibility ? (
      <PartyEditorActions
        phase={form.editorPhase}
        isAuthenticated={form.isAuth}
        isCreating={form.isCreating}
        isSaving={form.isSavingMetadata}
        networkDisabled={form.networkActionsDisabled}
        createBlockedByTheme={form.createBlockedByTheme}
        createBlockedByThemeTitle={form.createBlockedByThemeTitle}
        showSave={form.actionVisibility.showSave}
        showMakeReady={form.actionVisibility.showMakeReady}
        isMakeReadyLoading={
          form.isTransitioningLifecycle && form.pendingLifecycleTransition === 'ready'
        }
        secondaryExtra={archiveZone}
        onCreateParty={handleCreateParty}
        onOpenLinkParty={onOpenLinkParty}
        onSaveMetadata={() => void form.handleSaveMetadata()}
        onMakeReady={() => void form.handleLifecycleTransition('ready')}
      />
    ) : archiveZone ? (
      <div className="party-editor-actions">
        <div className="party-editor-actions__trailing">{archiveZone}</div>
      </div>
    ) : null;

  const footerActions = primaryActions ? (
    <div className="party-editor-about-actions">{primaryActions}</div>
  ) : null;

  const designPreviewHint = form.editorPhase ? (
    <p className="party-settings-design-hint">
      Оформление удобнее править в превью гостей — кнопка «Дизайн» слева от превью.
    </p>
  ) : null;

  const catalogDefaultExpanded = form.editorPhase === 'draft-unlinked';

  return (
    <div className="party-settings-content">
      {connectivityBanner}
      <div className="party-settings-content__status-row">
        <PartySettingsCatalogStatusChip
          isListedInCatalog={form.isListedInCatalog}
          visible={Boolean(form.showCatalog)}
          onFocusCatalog={focusCatalogSection}
        />
      </div>
      <div className="party-settings-content__body">
        {form.editorPhase ? (
          <PartyEditor
            phase={form.editorPhase}
            section="all"
            fields={form.editorFields}
            handlers={form.editorHandlers}
            design={form.editorDesign}
            connection={form.editorConnection}
            isBlocked={form.isBlocked}
            aboutActions={footerActions}
            defaultExpanded={true}
            catalogDefaultExpanded={catalogDefaultExpanded}
            catalogExpanded={catalogExpanded}
            onCatalogExpandedChange={setCatalogExpanded}
            catalogSectionRef={catalogSectionRef}
            catalogVisibilityControl={catalogVisibilityControl}
            isListedInCatalog={form.isListedInCatalog}
            showDraftCatalogHint={form.editorPhase === 'draft-unlinked'}
            designPreviewHint={designPreviewHint}
            showTrackDisplay={form.showTrackDisplay}
            partyTrackDisplay={form.partyTrackDisplay}
            onPartyTrackDisplayChange={form.setPartyTrackDisplaySettings}
            showCopyUrl={form.showCopyUrl}
            copyUrlDisabled={
              form.networkActionsDisabled || form.isCreating || form.isSavingMetadata
            }
            copyUrlTitle={
              form.networkActionsDisabled
                ? 'Включите «Онлайн» в настройках'
                : 'Скопировать URL вечеринки'
            }
            onCopyUrl={() => void form.handleCopyUrl()}
          />
        ) : null}
      </div>
    </div>
  );
};
