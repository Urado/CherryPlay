import React, { useCallback, useRef } from 'react';

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
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleCreateParty = () => {
    void form.handleCreateParty().then((created) => {
      notifyParentAfterPartyCreated(created, onPartyCreated);
    });
  };

  const focusVisibilitySettings = useCallback(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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

  const designPreviewHint = form.editorPhase
    ? 'Оформление также можно менять в превью гостей — кнопка «Дизайн» слева от превью.'
    : null;

  const catalogDefaultExpanded = form.editorPhase === 'draft-unlinked';

  return (
    <div className="party-settings-content">
      {connectivityBanner}
      <div className="party-settings-content__body" ref={bodyRef}>
        {form.editorPhase ? (
          <PartyEditor
            phase={form.editorPhase}
            section="all"
            fields={form.editorFields}
            handlers={form.editorHandlers}
            design={form.editorDesign}
            connection={form.editorConnection}
            isBlocked={form.isBlocked}
            defaultExpanded={true}
            catalogDefaultExpanded={catalogDefaultExpanded}
            catalogVisibilityControl={catalogVisibilityControl}
            isListedInCatalog={form.isListedInCatalog}
            showDraftCatalogHint={false}
            designPreviewHint={designPreviewHint}
            showCopyUrl={form.showCopyUrl}
            copyUrlDisabled={
              form.isCreating || form.isSavingMetadata
            }
            copyUrlTitle="Скопировать ссылку для гостей"
            onCopyUrl={() => void form.handleCopyUrl()}
          />
        ) : null}
      </div>
      {primaryActions || form.showCatalog ? (
        <footer className="party-settings-content__footer" aria-label="Действия вечеринки">
          <PartySettingsCatalogStatusChip
            isListedInCatalog={form.isListedInCatalog}
            visible={Boolean(form.showCatalog)}
            onFocusVisibility={focusVisibilitySettings}
          />
          {primaryActions ? (
            <div className="party-settings-content__actions">{primaryActions}</div>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
};
