import { Disclosure, AuthForm, Button } from '@cherryplay/components';
import type { OrganizerDto } from '@cherryplay/components';
import React, { useEffect, useState } from 'react';

import { OnlineUnavailablePanel } from '@shared/components';
import { DEMO_ORGANIZER_DTO, getDemoOrganizerDto } from '@shared/demo/demoAuthFixture';
import {
  getAppMode,
  getPlatform,
  getPlatformCapabilities,
  isPlatformInitialized,
} from '@shared/platform';
import { authService } from '@shared/services/authService';
import { useClientOutdatedStore, useUIStore } from '@shared/stores';
import { useAuthStore } from '@shared/stores/authStore';
import { clearAuthSession, setAuthSessionToken } from '@shared/utils/authSession';

export const AccountView: React.FC = () => {
  const { accessToken, setOrganizer, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [organizerInfo, setOrganizerInfo] = useState<OrganizerDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOrganizerCardExpanded, setIsOrganizerCardExpanded] = useState(true);
  const addNotification = useUIStore((state) => state.addNotification);
  const { isOutdated: isClientOutdated, requiredVersion: clientRequiredVersion } =
    useClientOutdatedStore();

  useEffect(() => {
    if (!getPlatformCapabilities().supportsRealAuth) {
      if (isAuthenticated()) {
        setOrganizerInfo(getDemoOrganizerDto());
        setOrganizer({ id: DEMO_ORGANIZER_DTO.id, name: DEMO_ORGANIZER_DTO.name });
      }
      return;
    }
    // Загружаем информацию об организаторе при монтировании, если есть токен
    if (isAuthenticated() && accessToken) {
      loadOrganizerInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Обработка OAuth callback - регистрируем при монтировании компонента
  useEffect(() => {
    if (!isPlatformInitialized() || !getPlatformCapabilities().supportsRealAuth) {
      return;
    }

    let isMounted = true;

    const registerCallback = async () => {
      try {
        // Регистрируем callback handler
        const result = (await getPlatform().invoke('auth:registerCallback')) as
          | { success: true; data: { code: string; provider: string } }
          | { success: false; error: string };

        if (isMounted && result.success && result.data) {
          const { code, provider } = result.data;
          await handleOAuthExchange(code, provider);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error handling OAuth callback:', error);
          setError(error instanceof Error ? error.message : 'Failed to handle OAuth callback');
        }
      }
    };

    registerCallback();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrganizerInfo = async () => {
    if (!accessToken) return;

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

  const handleOAuthExchange = async (code: string, provider: string) => {
    try {
      setLoading(true);
      setError(null);

      // Генерируем deviceId (можно использовать что-то уникальное для устройства)
      const deviceId = `desktop-${Date.now()}`;

      const token = await authService.exchangeCode(code, provider, deviceId);
      setAuthSessionToken(token);

      // Загружаем информацию об организаторе
      await loadOrganizerInfo();

      addNotification({
        type: 'success',
        message: 'Successfully logged in',
        duration: 3000,
      });
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
      addNotification({
        type: 'success',
        message: 'Вы вышли из аккаунта',
        duration: 3000,
      });
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

  const isDemoMode = getAppMode() === 'demo';
  const organizer = organizerInfo ?? getDemoOrganizerDto();

  if (!isDemoMode && isClientOutdated) {
    return (
      <div className="account-view">
        <OnlineUnavailablePanel reason="outdated" requiredVersion={clientRequiredVersion} />
      </div>
    );
  }

  return (
    <div className="account-view">
      {isDemoMode && (
        <p className="account-view-demo-hint">
          Веб-демо: фейковый организатор, без запросов к CherryPlayServer.
        </p>
      )}

      {error && <div className="account-view-error">{error}</div>}

      {loading && <div className="account-view-loading">Загрузка…</div>}

      {isAuthenticated() && (organizerInfo || isDemoMode) ? (
        <div className="account-info">
          <div className="account-view-success" role="status" aria-live="polite">
            <span className="account-view-success-mark" aria-hidden="true">
              ✓
            </span>
            <span className="account-view-success-text">
              Вы авторизованы как организатор
              {isDemoMode ? ' (демо)' : ''}
            </span>
          </div>

          <section className="account-view-card" aria-label="Информация об организаторе">
            <Disclosure
              title="Информация об организаторе"
              className="account-view-card-disclosure"
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

                <div className="account-view-field">
                  <span className="account-view-field-label">Создан</span>
                  <span className="account-view-field-value">
                    {new Date(organizer.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Disclosure>
          </section>

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
        <AuthForm
          title="Вход в систему"
          compact={false}
          authService={authService}
          onLoginSuccess={async () => {
            await loadOrganizerInfo();
            addNotification({
              type: 'success',
              message: 'Успешный вход в систему',
              duration: 3000,
            });
          }}
        />
      )}
    </div>
  );
};
