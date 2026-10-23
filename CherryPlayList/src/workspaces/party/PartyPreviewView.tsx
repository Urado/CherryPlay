import { partyThemes, type CustomizationSettings, type PartyThemeId } from '@cherryplay/components';
import { WorkspaceId } from '@core/types/workspace';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { usePartyPublicUrl } from '@shared/hooks/usePartyPublicUrl';
import { getPlatform } from '@shared/platform';
import { useProjectStore } from '@shared/stores/projectStore';
import { useUIStore } from '@shared/stores/uiStore';
import { useOnlineNetworkPolicy } from '@shared/streaming';
import { copyTextToClipboard } from '@shared/utils/copyTextToClipboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { PartyConnectivityBanner } from './components/PartyConnectivityBanner';
import { PartyPreviewDesignNav } from './components/PartyPreviewDesignNav';
import { PartyPreview } from './PartyPreview';
import { PartyPreviewDesignPanel } from './PartyPreviewDesignPanel';
import { PartyPreviewDisplayPanel } from './PartyPreviewDisplayPanel';
import { usePartyPreviewEffectiveState } from './partyPreviewEffectiveState';
import { syncPreviewWithProduction } from './partyPreviewScenarioActions';
import { usePartySettingsUiStore } from './partySettingsUiStore';
import { PartyWorkspaceDemoPanel } from './PartyWorkspaceDemoPanel';
import './PartyPreviewView.css';
import { usePartyWorkspaceRuntimeContext } from './partyWorkspaceRuntimeContext';
import { resolveDisplayPartyName } from './partyWorkspaceUtils';

interface PartyPreviewViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
  showDemoPanel?: boolean;
}

export const PartyPreviewView: React.FC<PartyPreviewViewProps> = ({
  workspaceId: _workspaceId,
  zoneId: _zoneId,
  showDemoPanel = false,
}) => {
  const runtime = usePartyWorkspaceRuntimeContext();
  const { networkEnabled } = useOnlineNetworkPolicy();
  const {
    partyName,
    partyTitle,
    partySubtitle,
    themeId,
    customizationSettings,
    playbackState,
    partyLifecycleState,
    visibleThemeIds,
    meta,
    previewPlaylistData,
    serverUnreachable,
    isReconnecting,
    lastManualCheckFailed,
    handleManualReconnect,
  } = runtime;
  const projectName = useProjectStore((state) => state.name);
  const guestUrl = usePartyPublicUrl(meta.linkedParty?.shortCode, meta.linkedParty?.url);
  const guestLinkRef = useRef<HTMLDivElement>(null);
  const guestLinkTriggerRef = useRef<HTMLButtonElement>(null);
  const [guestLinkOpen, setGuestLinkOpen] = useState(false);
  const displayPartyName = useMemo(() => {
    const title = partyTitle.trim();
    if (title.length > 0) {
      return title;
    }
    return resolveDisplayPartyName(partyName, projectName, 'Как видят гости');
  }, [partyTitle, partyName, projectName]);

  const {
    isSynchronized,
    previewLifecycleState,
    effectivePlaybackState,
    previewViewerStatusOverride,
    effectiveThemeId,
    effectiveCustomizationSettings,
    isEffectiveThemeUnavailable,
    previewTrackIds,
  } = usePartyPreviewEffectiveState({
    production: {
      themeId,
      customizationSettings,
      playbackState,
      partyLifecycleState,
      isLinked: meta.linkedParty != null,
    },
    previewPlaylistData,
    visibleThemeIds,
  });

  const previewDesignOpen = usePartySettingsUiStore((state) => state.previewDesignOpen);
  const previewDisplayOpen = usePartySettingsUiStore((state) => state.previewDisplayOpen);
  const togglePreviewDesignOpen = usePartySettingsUiStore((state) => state.togglePreviewDesignOpen);
  const togglePreviewDisplayOpen = usePartySettingsUiStore(
    (state) => state.togglePreviewDisplayOpen,
  );

  const availableThemeSet = useMemo(
    () => (visibleThemeIds ? new Set(visibleThemeIds) : null),
    [visibleThemeIds],
  );
  const previewDesignOptions = useMemo(
    () =>
      partyThemes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        isAvailable: availableThemeSet ? availableThemeSet.has(theme.id) : true,
      })),
    [availableThemeSet],
  );

  const playbackContext = useMemo(
    () => ({
      isSynchronized,
      previewLifecycleState,
      effectivePlaybackState,
    }),
    [isSynchronized, previewLifecycleState, effectivePlaybackState],
  );

  const handleCopyGuestLink = async () => {
    if (!guestUrl) {
      return;
    }
    try {
      await copyTextToClipboard(guestUrl);
      useUIStore.getState().addNotification({
        type: 'success',
        message: 'Ссылка для гостей скопирована',
      });
    } catch {
      useUIStore.getState().addNotification({
        type: 'error',
        message: 'Не удалось скопировать ссылку. Скопируйте её в настройках вечеринки.',
      });
    }
  };

  const handleOpenGuestPage = async () => {
    if (!guestUrl) {
      return;
    }
    try {
      const result = await getPlatform().invoke('system:openExternal', { url: guestUrl });
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to open guest page');
      }
    } catch {
      useUIStore.getState().addNotification({
        type: 'error',
        message: 'Не удалось открыть страницу для гостей',
      });
    }
  };

  useEffect(() => {
    if (!guestLinkOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!guestLinkRef.current?.contains(event.target as Node)) {
        setGuestLinkOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGuestLinkOpen(false);
        guestLinkTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [guestLinkOpen]);

  return (
    <div className="party-preview-view">
      {!networkEnabled && <PartyConnectivityBanner kind="offline" />}
      {networkEnabled && serverUnreachable && (
        <PartyConnectivityBanner
          kind="unreachable"
          isReconnecting={isReconnecting}
          lastManualCheckFailed={lastManualCheckFailed}
          onManualReconnect={() => void handleManualReconnect()}
        />
      )}
      <div className="party-preview-view-header">
        <h2>Превью (как будет выглядеть в браузере)</h2>
        <div className="party-preview-guest-link" ref={guestLinkRef}>
          <button
            type="button"
            className="party-preview-guest-link__trigger"
            aria-label="Ссылка для гостей"
            aria-expanded={guestLinkOpen}
            aria-controls={guestLinkOpen ? 'party-preview-guest-link-panel' : undefined}
            title="Ссылка для гостей"
            ref={guestLinkTriggerRef}
            onClick={() => setGuestLinkOpen((open) => !open)}
          >
            <LinkOutlinedIcon fontSize="small" />
            <span>Ссылка на вечеринку</span>
          </button>
          {guestLinkOpen ? (
            <div
              className="party-preview-guest-link__panel"
              id="party-preview-guest-link-panel"
              role="group"
              aria-label="Страница для гостей"
            >
              <input
                className="party-preview-guest-link__url"
                aria-label="Адрес страницы для гостей"
                value={guestUrl ?? 'Ссылка появится после привязки вечеринки'}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <div className="party-preview-guest-link__actions">
                <button
                  type="button"
                  className="party-preview-guest-link__button"
                  onClick={() => void handleCopyGuestLink()}
                  disabled={!guestUrl}
                >
                  Скопировать ссылку
                </button>
                <button
                  type="button"
                  className="party-preview-guest-link__button"
                  onClick={() => void handleOpenGuestPage()}
                  disabled={!guestUrl}
                >
                  Открыть в браузере
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {isSynchronized ? (
          <span className="party-preview-view-sync-badge party-preview-view-sync-badge--synced">
            Синхронизировано
          </span>
        ) : (
          <button
            type="button"
            className="party-preview-view-sync-badge party-preview-view-sync-badge--detached"
            aria-label="Локальный сценарий. Синхронизировать с сайтом"
            title="Синхронизировать с сайтом"
            onClick={syncPreviewWithProduction}
          >
            Локальный сценарий
          </button>
        )}
        {isEffectiveThemeUnavailable && (
          <span className="party-preview-view-sync-badge party-preview-view-sync-badge--warning">
            Недоступный дизайн
          </span>
        )}
      </div>
      <div className="party-preview-layout">
        <PartyPreviewDesignNav
          open={previewDesignOpen}
          displayOpen={previewDisplayOpen}
          onToggle={togglePreviewDesignOpen}
          onDisplayToggle={togglePreviewDisplayOpen}
        />
        {previewDesignOpen || previewDisplayOpen ? (
          <button
            type="button"
            className="party-preview-design-backdrop"
            aria-label="Закрыть панель настроек"
            onClick={previewDesignOpen ? togglePreviewDesignOpen : togglePreviewDisplayOpen}
          />
        ) : null}
        <div className="party-preview-layout__main">
          <PartyPreviewDesignPanel hidden={!previewDesignOpen} />
          <PartyPreviewDisplayPanel themeId={effectiveThemeId} hidden={!previewDisplayOpen} />
          <div className="party-preview-layout__canvas">
            <div className="party-preview-view-content">
              <PartyPreview
                playlist={previewPlaylistData}
                themeId={effectiveThemeId}
                customizationSettings={
                  effectiveCustomizationSettings as CustomizationSettings<PartyThemeId>
                }
                playbackState={effectivePlaybackState}
                partyName={displayPartyName}
                subtitle={partySubtitle.trim() || undefined}
                previewLifecycleState={previewLifecycleState}
                previewViewerStatusOverride={previewViewerStatusOverride}
              />
            </div>
            <PartyWorkspaceDemoPanel
              mode="preview"
              previewTrackIds={previewTrackIds}
              playbackContext={playbackContext}
              previewThemeId={effectiveThemeId}
              previewDesignOptions={previewDesignOptions}
              previewCustomizationSettings={effectiveCustomizationSettings}
              showDemoReset={showDemoPanel}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
