import React, { useEffect } from 'react';

import { NotificationContainer } from '@shared/components';
import { initializeServerConfig } from '@shared/config';
import { useTrackItemSize } from '@shared/hooks';
import { initializeShortcuts } from '@shared/shortcuts';
import {
  useLayoutStore,
  useUIStore,
  useGlobalHistoryStore,
  useSettingsStore,
  initializeGlobalHistory,
  initializeProjectStoreHistory,
} from '@shared/stores';
import { TrackSettingsModal } from '@workspaces/player/TrackSettingsModal';

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
      <NotificationContainer />
      <AppFooter />
    </div>
  );
};

export default App;
