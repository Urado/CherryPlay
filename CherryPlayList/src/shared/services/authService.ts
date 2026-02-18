import { getServerUrl } from '../config/serverConfig';
import { useAuthStore } from '../stores/authStore';
import { handleAuthError, isAuthError } from '../utils/authErrorHandler';
import { isTokenExpired, isTokenExpiringSoon } from '../utils/tokenUtils';
import type { AuthService as IAuthService, OrganizerDto, AuthExchangeRequest, AuthExchangeResponse } from '@cherryplay/components';

// Re-export types for backward compatibility
export type { OrganizerDto, AuthExchangeRequest, AuthExchangeResponse };

class AuthService implements IAuthService {
  private async getBaseUrl(): Promise<string> {
    return getServerUrl();
  }

  async startOAuthFlow(provider: 'telegram' | 'vk' | 'mailru'): Promise<void> {
    const baseUrl = await this.getBaseUrl();

    const isDev = import.meta.env.DEV;
    const redirectUriParam = isDev
      ? `?redirectUri=${encodeURIComponent(`${baseUrl}/auth/${provider}/callback`)}`
      : '';

    const authUrl = `${baseUrl}/auth/${provider}/start${redirectUriParam}`;

    console.log('[AuthService] Starting OAuth flow:', {
      provider,
      baseUrl,
      authUrl,
      isDev,
    });

    if (typeof window !== 'undefined' && window.api) {
      const result = (await window.api.invoke('system:openExternal', { url: authUrl })) as
        | { success: true }
        | { success: false; error: string };

      if (!result.success) {
        console.error('[AuthService] Failed to open browser:', result.error);
        throw new Error(result.error || 'Failed to open browser');
      }

      console.log('[AuthService] Browser opened successfully, waiting for OAuth callback...');
      console.log(
        '[AuthService] Expected callback URL:',
        isDev ? 'http://localhost:5174/auth/callback' : 'cherryplaylist://auth',
      );
    } else {
      console.warn('[AuthService] window.api not available, using window.open fallback');
      window.open(authUrl, '_blank');
    }
  }

  async exchangeCode(code: string, provider: string, deviceId?: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/auth/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        provider,
        deviceId,
      } as AuthExchangeRequest),
      cache: 'no-cache',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    const data = (await response.json()) as AuthExchangeResponse;
    return data.accessToken;
  }

  async getCurrentOrganizer(): Promise<OrganizerDto> {
    const baseUrl = await this.getBaseUrl();
    const token = useAuthStore.getState().accessToken;

    if (!token) {
      throw new Error('No access token available');
    }

    // Проверяем, не истек ли токен перед запросом
    if (isTokenExpired(token)) {
      handleAuthError('Authentication token has expired. Please login again.');
      throw new Error('Authentication token has expired');
    }

    const response = await fetch(`${baseUrl}/api/organizer/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-cache',
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleAuthError('Authentication token expired or invalid');
        throw new Error('Authentication token expired or invalid');
      }
      const errorText = await response.text();
      throw new Error(`Failed to get organizer: ${errorText}`);
    }

    return response.json();
  }

  async login(email: string, password: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
      cache: 'no-cache',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to login: ${errorText}`);
    }

    const data = (await response.json()) as AuthExchangeResponse;
    const token = data.accessToken;
    
    // Сохраняем токен в store
    useAuthStore.getState().setToken(token);
    
    // Загружаем информацию об организаторе
    try {
      const organizer = await this.getCurrentOrganizer();
      useAuthStore.getState().setOrganizer({ id: organizer.id, name: organizer.name });
    } catch (err) {
      console.warn('Failed to load organizer info after login:', err);
    }
    
    return token;
  }

  async register(email: string, password: string, name: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
      }),
      cache: 'no-cache',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to register: ${errorText}`);
    }

    const data = (await response.json()) as AuthExchangeResponse;
    const token = data.accessToken;
    
    // Сохраняем токен в store
    useAuthStore.getState().setToken(token);
    
    // Загружаем информацию об организаторе
    try {
      const organizer = await this.getCurrentOrganizer();
      useAuthStore.getState().setOrganizer({ id: organizer.id, name: organizer.name });
    } catch (err) {
      console.warn('Failed to load organizer info after register:', err);
    }
    
    return token;
  }

  async logout(): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const token = useAuthStore.getState().accessToken;

    if (token) {
      try {
        await fetch(`${baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-cache',
        });
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }

    useAuthStore.getState().clearAuth();
  }
}

export const authService = new AuthService();
