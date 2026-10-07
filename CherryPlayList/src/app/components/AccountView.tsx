import { Button } from '@cherryplay/components';
import { OnlineUnavailablePanel } from '@shared/components';
import { getWebBaseUrl } from '@shared/config/serverConfig';
import { DEMO_ORGANIZER_DTO } from '@shared/demo/demoAuthFixture';
import {
  getAppMode,
  getPlatform,
  getPlatformCapabilities,
  isDemoFixturesMode,
  isDemoLiveMode,
} from '@shared/platform';
import { authService } from '@shared/services/authService';
import { useClientOutdatedStore, useUIStore } from '@shared/stores';
import { useAuthStore } from '@shared/stores/authStore';
import { clearAuthSession } from '@shared/utils/authSession';
import React, { useCallback, useEffect, useState } from 'react';

import { BrowserLoginPanel } from './BrowserLoginPanel';

interface AccountViewProps {
  onClose?: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({ onClose = () => undefined }) => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const storeOrganizer = useAuthStore((state) => state.organizer);
  const setOrganizer = useAuthStore((state) => state.setOrganizer);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addNotification = useUIStore((state) => state.addNotification);
  const { isOutdated: isClientOutdated, requiredVersion: clientRequiredVersion } =
    useClientOutdatedStore();
  const appMode = getAppMode();
  const isDemoMode = appMode === 'demo';
  const isFixturesDemo = isDemoFixturesMode(appMode);
  const isLiveDemo = isDemoLiveMode() && isDemoMode;
  const authenticated = isAuthenticated();

  const loadOrganizerInfo = useCallback(async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      return;
    }

    try {
      const info = await authService.getCurrentOrganizer();
      setOrganizer({ id: info.id, name: info.name });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organizer info';
      setError(errorMessage);
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        clearAuthSession();
      }
    }
  }, [setOrganizer]);

  useEffect(() => {
    if (isFixturesDemo) {
      if (useAuthStore.getState().isAuthenticated()) {
        setOrganizer({ id: DEMO_ORGANIZER_DTO.id, name: DEMO_ORGANIZER_DTO.name });
      }
      return;
    }
    if (
      getPlatformCapabilities().supportsRealAuth &&
      useAuthStore.getState().isAuthenticated() &&
      useAuthStore.getState().accessToken
    ) {
      void loadOrganizerInfo();
    }
  }, [accessToken, storeOrganizer?.id, isFixturesDemo, loadOrganizerInfo, setOrganizer]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await authService.logout();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to logout';
      setError(errorMessage);
      addNotification({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const openCabinetOnWeb = async () => {
    try {
      const webBaseUrl = await getWebBaseUrl();
      const url = `${webBaseUrl.replace(/\/$/, '')}/cabinet`;
      await getPlatform().invoke('auth:openExternal', { url });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось открыть сайт';
      setError(errorMessage);
      addNotification({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  if (!isDemoMode && isClientOutdated) {
    return (
      <div className="account-view">
        <OnlineUnavailablePanel reason="outdated" requiredVersion={clientRequiredVersion} />
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="account-view">
        {isFixturesDemo && (
          <p className="account-view-demo-hint">
            Веб-демо: фейковый организатор, без запросов к CherryPlayServer.
          </p>
        )}
        {isLiveDemo && (
          <p className="account-view-demo-hint">
            Веб-демо (live): вход через браузер (CherryPlayWeb), как в Desktop.
          </p>
        )}
        {error ? <div className="account-view-error">{error}</div> : null}
        <div className="account-view-actions">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="account-view-privacy-link"
            onClick={() => {
              void openCabinetOnWeb();
            }}
          >
            Открыть кабинет на сайте
          </Button>
          <Button
            type="button"
            onClick={() => void handleLogout()}
            loading={loading}
            className="account-view-logout-btn modal-button"
            variant="danger"
            size="sm"
          >
            Выйти
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="account-view account-view--login">
      {isFixturesDemo && (
        <p className="account-view-demo-hint">
          Веб-демо: фейковый организатор, без запросов к CherryPlayServer.
        </p>
      )}
      {isLiveDemo && (
        <p className="account-view-demo-hint">
          Веб-демо (live): вход через браузер (CherryPlayWeb), как в Desktop.
        </p>
      )}
      {error ? <div className="account-view-error">{error}</div> : null}
      <div className="account-view-login-panel">
        <BrowserLoginPanel
          title="Вход в систему"
          description="Откроется системный браузер для входа в CherryPlay"
        />
      </div>
    </div>
  );
};
