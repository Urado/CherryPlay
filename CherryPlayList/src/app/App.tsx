import React, { useEffect, useRef } from 'react';

import { NotificationContainer } from '@shared/components';
import { initializeServerConfig } from '@shared/config';
import { useTrackItemSize } from '@shared/hooks';
import { getAppMode, usePlatformCapabilities } from '@shared/platform';
import { authService } from '@shared/services/authService';
import { initializeShortcuts } from '@shared/shortcuts';
import {
  useLayoutStore,
  useUIStore,
  useGlobalHistoryStore,
  useSettingsStore,
  useAuthStore,
  initializeGlobalHistory,
  initializeProjectStoreHistory,
} from '@shared/stores';
import { clearAuthSession } from '@shared/utils/authSession';
import {
  isTokenExpired,
  isTokenExpiringSoon,
  getDaysUntilExpiration,
} from '@shared/utils/tokenUtils';
import { TrackSettingsModal } from '@workspaces/player/TrackSettingsModal';

import { AccountModal } from './components/AccountModal';
import { AimpIntegrationController } from './components/AimpIntegrationController';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { CherryPlayStreamingController } from './components/CherryPlayStreamingController';
import { DemoModeBanner } from './components/DemoModeBanner';
import { DemoPlayerShell } from './components/DemoPlayerShell';
import { ExportModal } from './components/ExportModal';
import { LayoutWorkspaceArea } from './components/LayoutWorkspaceArea';
import { LinkPartyModal } from './components/LinkPartyModal';
import { SettingsModal } from './components/SettingsModal';
import { useWindowMinSize } from './hooks';
import { requestExitEditMode } from './hooks/useWorkspaceDirtyGuard';

const App: React.FC = () => {
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);
  const isDemoMode = getAppMode() === 'demo';
  const { supportsAimpWorkspace, supportsRealAuth } = usePlatformCapabilities();
  const appContentRef = useRef<HTMLDivElement>(null);
  const layoutHostRef = useRef<HTMLDivElement>(null);

  useWindowMinSize(layoutHostRef);

  useEffect(() => {
    if (isDemoMode) {
      document.title = 'CherryPlayList (Demo)';
    }

    initializeProjectStoreHistory();
    initializeGlobalHistory();

    initializeServerConfig().catch((error: unknown) => {
      console.warn('Failed to initialize server config:', error);
    });

    initializeShortcuts(() => useSettingsStore.getState().keyBindings, {
      isShortcutsBlocked: () => useLayoutStore.getState().isLayoutEditMode,
    });

    useGlobalHistoryStore.getState().registerErrorHandler((message) => {
      useUIStore.getState().addNotification({
        type: 'error',
        message,
        duration: 5000,
      });
    });

    if (!supportsRealAuth) {
      return;
    }

    const checkAuthOnStart = async () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        return;
      }

      if (isTokenExpired(token)) {
        console.warn('[App] Token expired on startup, clearing auth');
        clearAuthSession();
        return;
      }

      if (isTokenExpiringSoon(token, 7)) {
        const daysLeft = getDaysUntilExpiration(token);
        if (daysLeft !== null && daysLeft > 0) {
          useUIStore.getState().addNotification({
            type: 'warning',
            message: `Ваш токен авторизации истечет через ${daysLeft} ${daysLeft === 1 ? 'день' : 'дней'}. Пожалуйста, войдите снова.`,
            duration: 10000,
          });
        }
      }

      try {
        await authService.getCurrentOrganizer();
      } catch (error) {
        console.warn('[App] Token validation failed on startup:', error);
      }
    };

    checkAuthOnStart();
  }, [isDemoMode, supportsRealAuth]);

  useTrackItemSize();

  useEffect(() => {
    if (!isLayoutEditMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          active.classList.contains('workspace-pill__rename-input')
        ) {
          return;
        }

        event.preventDefault();
        const { openLayoutEditPickerKey, setOpenLayoutEditPickerKey } = useLayoutStore.getState();
        if (openLayoutEditPickerKey !== null) {
          setOpenLayoutEditPickerKey(null);
          return;
        }
        requestExitEditMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isLayoutEditMode]);

  return (
    <CherryPlayStreamingController>
      <div className="app">
        {isDemoMode && <DemoModeBanner />}
        <AppHeader />
        <div ref={appContentRef} className="app-content">
          <div ref={layoutHostRef} className="app-content-main">
            <LayoutWorkspaceArea />
          </div>
          <div className="demo-player-shell-host">
            <DemoPlayerShell contentContainerRef={appContentRef} />
          </div>
        </div>
        {supportsAimpWorkspace && <AimpIntegrationController />}
        <SettingsModal />
        <ExportModal />
        <LinkPartyModal />
        <TrackSettingsModal />
        <AccountModal />
        <NotificationContainer />
        <AppFooter />
      </div>
    </CherryPlayStreamingController>
  );
};

export default App;
