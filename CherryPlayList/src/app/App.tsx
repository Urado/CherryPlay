import React, { useEffect } from 'react';

import { NotificationContainer } from '@shared/components';
import { initializeServerConfig } from '@shared/config';
import { useTrackItemSize } from '@shared/hooks';
import { initializeShortcuts } from '@shared/shortcuts';
import { authService } from '@shared/services/authService';
import {
  useLayoutStore,
  useUIStore,
  useGlobalHistoryStore,
  useSettingsStore,
  useAuthStore,
  initializeGlobalHistory,
  initializeProjectStoreHistory,
} from '@shared/stores';
import { isTokenExpired, isTokenExpiringSoon, getDaysUntilExpiration } from '@shared/utils/tokenUtils';
import { TrackSettingsModal } from '@workspaces/player/TrackSettingsModal';

import { AccountModal } from './components/AccountModal';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { SplitContainer } from './components/SplitContainer';

const App: React.FC = () => {
  const { layout } = useLayoutStore();

  useEffect(() => {
    initializeProjectStoreHistory();
    initializeGlobalHistory();

    initializeServerConfig().catch((error: unknown) => {
      console.warn('Failed to initialize server config:', error);
    });

    initializeShortcuts(() => useSettingsStore.getState().keyBindings);

    useGlobalHistoryStore.getState().registerErrorHandler((message) => {
      useUIStore.getState().addNotification({
        type: 'error',
        message,
        duration: 5000,
      });
    });

    // Проверяем валидность токена при старте приложения
    const checkAuthOnStart = async () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        return;
      }

      // Проверяем, не истек ли токен локально
      if (isTokenExpired(token)) {
        console.warn('[App] Token expired on startup, clearing auth');
        useAuthStore.getState().clearAuth();
        return;
      }

      // Проверяем, истекает ли токен в ближайшие 7 дней
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

      // Проверяем валидность токена на сервере
      try {
        await authService.getCurrentOrganizer();
      } catch (error) {
        console.warn('[App] Token validation failed on startup:', error);
        // Ошибка уже обработана в authService
      }
    };

    checkAuthOnStart();
  }, []);

  useTrackItemSize();

  if (layout.rootZone.type !== 'container') {
    return (
      <div className="app">
        <AppHeader />
        <div className="app-content">
          <div className="empty-state">
            <p>Error: Root zone must be a container</p>
          </div>
        </div>
        <SettingsModal />
        <ExportModal />
        <TrackSettingsModal />
        <AccountModal />
        <NotificationContainer />
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader />
      <div className="app-content">
        <SplitContainer zone={layout.rootZone} />
      </div>
      <SettingsModal />
      <ExportModal />
      <TrackSettingsModal />
      <AccountModal />
      <NotificationContainer />
      <AppFooter />
    </div>
  );
};

export default App;
