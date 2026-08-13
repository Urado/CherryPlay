import React from 'react';

import type { PartyWorkspaceRuntimeValue } from '../partyWorkspaceRuntimeContext';
import { usePartySettingsFormState } from '../usePartySettingsFormState';

import { PartyCatalogVisibilityControl } from './PartyCatalogVisibilityControl';
import { PartyEditor } from './PartyEditor';
import { PartyEditorActions } from './PartyEditorActions';
import { PartyEditorDangerZone } from './PartyEditorDangerZone';
import { PartyTrackDisplaySection } from './PartyTrackDisplaySection';

export interface PartySettingsContentProps {
  runtime: PartyWorkspaceRuntimeValue;
  onOpenLinkParty: () => void;
}

export const PartySettingsContent: React.FC<PartySettingsContentProps> = ({
  runtime,
  onOpenLinkParty,
}) => {
  const form = usePartySettingsFormState(runtime);

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

  const catalogBlock =
    form.editorPhase && form.actionVisibility && form.showCatalog ? (
      <PartyCatalogVisibilityControl
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
        onCreateParty={form.handleCreateParty}
        onOpenLinkParty={onOpenLinkParty}
        onSaveMetadata={form.handleSaveMetadata}
        onMakeReady={() => void form.handleLifecycleTransition('ready')}
      />
    ) : archiveZone ? (
      <div className="party-editor-actions">
        <div className="party-editor-actions__trailing">{archiveZone}</div>
      </div>
    ) : null;

  const footerActions =
    catalogBlock || primaryActions ? (
      <div className="party-editor-about-actions">
        {catalogBlock}
        {primaryActions}
      </div>
    ) : null;

  const aboutActions =
    form.showTrackDisplay || footerActions ? (
      <>
        {form.showTrackDisplay ? (
          <PartyTrackDisplaySection
            value={form.partyTrackDisplay}
            onChange={form.setPartyTrackDisplaySettings}
            defaultExpanded={true}
          />
        ) : null}
        {footerActions}
      </>
    ) : null;

  const designPreviewHint = form.editorPhase ? (
    <p className="party-settings-design-hint">
      Оформление удобнее править в превью гостей — кнопка «Дизайн» слева от превью.
    </p>
  ) : null;

  return (
    <div className="party-settings-content">
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
            aboutActions={aboutActions}
            defaultExpanded={true}
            designPreviewHint={designPreviewHint}
            showCopyUrl={form.showCopyUrl}
            copyUrlDisabled={
              form.networkActionsDisabled || form.isCreating || form.isSavingMetadata
            }
            copyUrlTitle={
              form.networkActionsDisabled
                ? 'Включите «Онлайн» в настройках'
                : 'Скопировать URL вечеринки'
            }
            onCopyUrl={form.handleCopyUrl}
          />
        ) : null}
      </div>
    </div>
  );
};
