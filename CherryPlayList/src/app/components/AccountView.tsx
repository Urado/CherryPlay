import { Disclosure, AuthForm, Button, ChangePasswordForm } from '@cherryplay/components';
import type { OrganizerDto } from '@cherryplay/components';
import React, { useEffect, useState } from 'react';

import { OnlineUnavailablePanel } from '@shared/components';
import { getWebBaseUrl } from '@shared/config/serverConfig';
import { DEMO_ORGANIZER_DTO, getDemoOrganizerDto } from '@shared/demo/demoAuthFixture';
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

import { BrowserLoginPanel } from './BrowserLoginPanel';
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
  const [isChangePasswordExpanded, setIsChangePasswordExpanded] = useState(false);
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

  const handleChangePasswordSuccess = () => {
    clearAuthSession();
    setOrganizerInfo(null);
    setIsChangePasswordExpanded(false);
    setError(null);
    addNotification({
      type: 'success',
      message: 'Пароль успешно изменён. Войдите снова с новым паролем.',
      duration: 8000,
    });
  };

  const openAccountPrivacyOnWeb = async () => {
    try {
      const webBaseUrl = await getWebBaseUrl();
      const url = `${webBaseUrl.replace(/\/$/, '')}/cabinet#account`;
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

  if (authenticated && !organizer) {
    return (
      <div className="account-view account-view--login">
        {error ? <div className="account-view-error">{error}</div> : null}
        {!error || loading ? (
          <div className="account-view-loading" role="status" aria-live="polite">
            Загрузка…
          </div>
        ) : null}
      </div>
    );
  }

  if (authenticated && organizer) {
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

            {!isFixturesDemo && (
              <section className="account-disclosure-card" aria-label="Смена пароля">
                <Disclosure
                  title="Смена пароля"
                  className="account-disclosure"
                  expanded={isChangePasswordExpanded}
                  onExpandedChange={setIsChangePasswordExpanded}
                >
                  <ChangePasswordForm
                    authService={authService}
                    layout="embedded"
                    title={null}
                    onSuccess={handleChangePasswordSuccess}
                  />
                </Disclosure>
              </section>
            )}

            {!isFixturesDemo && (
              <section className="account-disclosure-card" aria-label="Конфиденциальность">
                <p className="account-view-privacy-hint">
                  Удаление аккаунта и согласия — в кабинете на сайте.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="account-view-privacy-link"
                  aria-label="Открыть управление аккаунтом на сайте в браузере"
                  onClick={() => {
                    void openAccountPrivacyOnWeb();
                  }}
                >
                  Открыть кабинет на сайте
                </Button>
                <p className="account-view-privacy-external">Откроется в браузере</p>
              </section>
            )}

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
          Веб-демо (live): вход email/password через CherryPlayServer (Vite proxy).
        </p>
      )}

      {error && <div className="account-view-error">{error}</div>}

      <div className="account-view-login-panel">
        {isLiveDemo ? (
          <AuthForm
            title="Вход в систему"
            description="Для работы с аккаунтом необходимо войти"
            compact={false}
            authService={authService}
            oauthEnabled={false}
            onLoginSuccess={() => {
              void loadOrganizerInfo();
            }}
          />
        ) : (
          <BrowserLoginPanel
            title="Вход в систему"
            description="Откроется системный браузер для входа в CherryPlay"
          />
        )}
      </div>
    </div>
  );
};
