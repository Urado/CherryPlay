import { AuthForm } from '@cherryplay/components';
import type { OrganizerDto } from '@cherryplay/components';
import React, { useEffect, useState } from 'react';

import { authService } from '@shared/services/authService';
import { useUIStore } from '@shared/stores';
import { useAuthStore } from '@shared/stores/authStore';

export const AccountView: React.FC = () => {
  const { accessToken, setToken, setOrganizer, clearAuth, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [organizerInfo, setOrganizerInfo] = useState<OrganizerDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addNotification = useUIStore((state) => state.addNotification);

  useEffect(() => {
    // Загружаем информацию об организаторе при монтировании, если есть токен
    if (isAuthenticated() && accessToken) {
      loadOrganizerInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Обработка OAuth callback - регистрируем при монтировании компонента
  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) {
      return;
    }

    let isMounted = true;

    const registerCallback = async () => {
      try {
        // Регистрируем callback handler
        const result = (await window.api.invoke('auth:registerCallback')) as
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
        clearAuth();
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
      setToken(token);

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

  const handleLogout = async () => {
    try {
      setLoading(true);
      await authService.logout();
      setOrganizerInfo(null);
      addNotification({
        type: 'success',
        message: 'Successfully logged out',
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

  return (
    <div className="account-view" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>Account</h1>

      {error && (
        <div
          style={{
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '4px',
          }}
        >
          {error}
        </div>
      )}

      {loading && <div style={{ marginBottom: '20px', color: '#666' }}>Loading...</div>}

      {isAuthenticated() && organizerInfo ? (
        <div className="account-info">
          <div
            style={{
              padding: '12px',
              marginBottom: '20px',
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              borderRadius: '4px',
              border: '1px solid #4caf50',
            }}
          >
            ✓ Вы авторизованы как организатор
          </div>
          <h2>Информация об организаторе</h2>
          <div style={{ marginBottom: '20px' }}>
            <p>
              <strong>Name:</strong> {organizerInfo.name}
            </p>
            <p>
              <strong>ID:</strong> {organizerInfo.id}
            </p>
            {organizerInfo.logoUrl && (
              <p>
                <strong>Logo:</strong>{' '}
                <img
                  src={organizerInfo.logoUrl}
                  alt={organizerInfo.name}
                  style={{ maxWidth: '100px', maxHeight: '100px' }}
                />
              </p>
            )}
            {organizerInfo.links && Object.keys(organizerInfo.links).length > 0 && (
              <div>
                <strong>Links:</strong>
                <ul>
                  {Object.entries(organizerInfo.links).map(([key, value]) => (
                    <li key={key}>
                      <a href={value} target="_blank" rel="noopener noreferrer">
                        {key}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p>
              <strong>Created:</strong> {new Date(organizerInfo.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      ) : (
        <AuthForm
          title="Вход в систему"
          description="Для создания вечеринок и управления эфиром необходимо войти в систему"
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
