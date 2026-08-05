import { Disclosure, AuthForm, Button } from '@cherryplay/components';
import type { OrganizerDto } from '@cherryplay/components';
import React, { useEffect, useState } from 'react';

import { OnlineUnavailablePanel } from '@shared/components';
import { DEMO_ORGANIZER_DTO, getDemoOrganizerDto } from '@shared/demo/demoAuthFixture';
import {
  getAppMode,
  getPlatform,
  getPlatformCapabilities,
  isDemoFixturesMode,
  isDemoLiveMode,
  isPlatformInitialized,
} from '@shared/platform';
import { authService } from '@shared/services/authService';
import { useClientOutdatedStore, useUIStore } from '@shared/stores';
import { useAuthStore } from '@shared/stores/authStore';
import { clearAuthSession, setAuthSessionToken } from '@shared/utils/authSession';

import { MyPartiesList } from './MyPartiesList';

export const AccountView: React.FC = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const storeOrganizer = useAuthStore((state) => state.organizer);
  const setOrganizer = useAuthStore((state) => state.setOrganizer);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [loading, setLoading] = useState(false);
  const [organizerInfo, setOrganizerInfo] = useState<OrganizerDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOrganizerCardExpanded, setIsOrganizerCardExpanded] = useState(false);
  const addNotification = useUIStore((state) => state.addNotification);
  const { isOutdated: isClientOutdated, requiredVersion: clientRequiredVersion } =
    useClientOutdatedStore();
  const isDemoMode = getAppMode() === 'demo';
  const isFixturesDemo = isDemoFixturesMode(getAppMode());
  const isLiveDemo = isDemoLiveMode() && isDemoMode;
  const authenticated = isAuthenticated();

  const loadOrganizerInfo = async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const info = await authService.getCurrentOrganizer();
      setOrganizerInfo(info);
      setOrganizer({ id: info.id, name: info.name });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organizer info';
      setError(errorMessage);
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        clearAuthSession();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isDemoFixturesMode(getAppMode())) {
      if (useAuthStore.getState().isAuthenticated()) {
        setOrganizerInfo(getDemoOrganizerDto());
        setOrganizer({ id: DEMO_ORGANIZER_DTO.id, name: DEMO_ORGANIZER_DTO.name });
      }
      return;
    }
    if (!getPlatformCapabilities().supportsRealAuth) {
      return;
    }
    if (useAuthStore.getState().isAuthenticated() && useAuthStore.getState().accessToken) {
      void loadOrganizerInfo();
    }
  }, [accessToken, storeOrganizer?.id, setOrganizer]);

  useEffect(() => {
    if (!isPlatformInitialized() || !getPlatformCapabilities().supportsRealAuth) {
      return;
    }

    let isMounted = true;

    const registerCallback = async () => {
      try {
        const result = (await getPlatform().invoke('auth:registerCallback')) as
          | { success: true; data: { code: string; provider: string } }
          | { success: false; error: string };

        if (isMounted && result.success && result.data) {
          const { code, provider } = result.data;
          await handleOAuthExchange(code, provider);
        }
      } catch (callbackError) {
        if (isMounted) {
          console.error('Error handling OAuth callback:', callbackError);
          setError(
            callbackError instanceof Error
              ? callbackError.message
              : 'Failed to handle OAuth callback',
          );
        }
      }
    };

    void registerCallback();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOAuthExchange = async (code: string, provider: string) => {
    try {
      setLoading(true);
      setError(null);

      const deviceId = `desktop-${Date.now()}`;

      const token = await authService.exchangeCode(code, provider, deviceId);
      setAuthSessionToken(token);

      await loadOrganizerInfo();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to authenticate';
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

  const closeModal = useUIStore((state) => state.closeModal);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await authService.logout();
      setOrganizerInfo(null);
      closeModal();
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

  const organizer: OrganizerDto | null =
    organizerInfo ??
    (isFixturesDemo
      ? getDemoOrganizerDto()
      : storeOrganizer
        ? {
            id: storeOrganizer.id,
            name: storeOrganizer.name,
            createdAt: '',
            logoUrl: null,
          }
        : null);

  if (!isDemoMode && isClientOutdated) {
    return (
      <div className="account-view">
        <OnlineUnavailablePanel reason="outdated" requiredVersion={clientRequiredVersion} />
      </div>
    );
  }

  return (
    <div className="account-view">
      {isFixturesDemo && (
        <p className="account-view-demo-hint">
          Веб-демо: фейковый организатор, без запросов к CherryPlayServer.
        </p>
      )}
      {isLiveDemo && (
        <p className="account-view-demo-hint">
          Веб-демо (live): вход email/password через CherryPlayServer (Vite proxy).
        </p>
      )}

      {error && <div className="account-view-error">{error}</div>}

      {loading && !organizer && <div className="account-view-loading">Загрузка…</div>}

      {authenticated && organizer ? (
        <div className="account-info">
          <div className="account-view-success" role="status" aria-live="polite">
            <span className="account-view-success-mark" aria-hidden="true">
              ✓
            </span>
            <span className="account-view-success-text">
              Вы авторизованы как организатор
              {isFixturesDemo ? ' (демо)' : ''}
            </span>
          </div>

          <div className="account-disclosure-stack">
            <section className="account-disclosure-card" aria-label="Информация об организаторе">
              <Disclosure
                title="Информация об организаторе"
                className="account-disclosure"
                expanded={isOrganizerCardExpanded}
                onExpandedChange={setIsOrganizerCardExpanded}
              >
                <div className="account-view-organizer-details">
                  <div className="account-view-field">
                    <span className="account-view-field-label">Имя</span>
                    <span className="account-view-field-value">{organizer.name}</span>
                  </div>

                  <div className="account-view-field">
                    <span className="account-view-field-label">ID</span>
                    <span className="account-view-field-value account-view-field-value--mono">
                      {organizer.id}
                    </span>
                  </div>

                  {organizer.logoUrl && (
                    <div className="account-view-field">
                      <span className="account-view-field-label">Логотип</span>
                      <div className="account-view-logo-wrap">
                        <img
                          src={organizer.logoUrl}
                          alt={organizer.name}
                          className="account-view-logo"
                        />
                      </div>
                    </div>
                  )}

                  {organizer.createdAt ? (
                    <div className="account-view-field">
                      <span className="account-view-field-label">Создан</span>
                      <span className="account-view-field-value">
                        {new Date(organizer.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ) : null}
                </div>
              </Disclosure>
            </section>

            <MyPartiesList />
          </div>

          <div className="account-view-actions">
            <Button
              type="button"
              onClick={handleLogout}
              loading={loading}
              className="account-view-logout-btn modal-button"
              variant="danger"
              size="sm"
            >
              Выйти
            </Button>
          </div>
        </div>
      ) : (
        <>
          <AuthForm
            title="Вход в систему"
            compact={false}
            authService={authService}
            oauthEnabled={!isDemoMode}
            onLoginSuccess={() => {
              void loadOrganizerInfo();
            }}
          />
          <div className="account-disclosure-stack">
            <MyPartiesList />
          </div>
        </>
      )}
    </div>
  );
};
