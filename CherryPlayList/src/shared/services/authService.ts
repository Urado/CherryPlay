import type {
  AuthService as IAuthService,
  OrganizerDto,
  AuthExchangeRequest,
  AuthExchangeResponse,
  ForgotPasswordResponse,
} from '@cherryplay/components';
import { AuthHttpError, FORGOT_PASSWORD_GENERIC_SUCCESS } from '@cherryplay/components';

import { getServerUrl } from '../config/serverConfig';
import {
  applyDemoAuthSession,
  DEMO_ACCESS_TOKEN,
  getDemoOrganizerDto,
} from '../demo/demoAuthFixture';
import { isDemoAuthMode } from '../demo/guardDemoAuth';
import { notifyDemoUnavailable } from '../demo/notifyDemoUnavailable';
import { getPlatform, isPlatformInitialized } from '../platform';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../utils/apiFetch';
import { handleAuthError } from '../utils/authErrorHandler';
import { clearAuthSession, setAuthSessionToken } from '../utils/authSession';
import { isTokenExpired } from '../utils/tokenUtils';

export type { OrganizerDto, AuthExchangeRequest, AuthExchangeResponse };

async function readResponseErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) {
      return '';
    }
    try {
      const json = JSON.parse(text) as {
        message?: unknown;
        detail?: unknown;
        title?: unknown;
      };
      if (typeof json.message === 'string' && json.message.trim()) {
        return json.message;
      }
      if (typeof json.detail === 'string' && json.detail.trim()) {
        return json.detail;
      }
      if (typeof json.title === 'string' && json.title.trim()) {
        return json.title;
      }
    } catch {
      return text;
    }
    return text;
  } catch {
    return '';
  }
}

async function throwAuthHttpError(response: Response): Promise<never> {
  const message = await readResponseErrorMessage(response);
  throw new AuthHttpError(response.status, message);
}

class AuthService implements IAuthService {
  private async getBaseUrl(): Promise<string> {
    return getServerUrl();
  }

  async startOAuthFlow(provider: 'telegram' | 'vk' | 'mailru'): Promise<void> {
    if (isDemoAuthMode()) {
      applyDemoAuthSession();
      console.info('[AuthService] Demo: OAuth skipped, using demo organizer', { provider });
      return;
    }
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

    if (isPlatformInitialized()) {
      const result = (await getPlatform().invoke('auth:openExternal', { url: authUrl })) as
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
      return;
    }

    console.warn('[AuthService] Platform not available, using window.open fallback');
    window.open(authUrl, '_blank');
  }

  async exchangeCode(code: string, provider: string, deviceId?: string): Promise<string> {
    if (isDemoAuthMode()) {
      applyDemoAuthSession();
      return DEMO_ACCESS_TOKEN;
    }
    const baseUrl = await this.getBaseUrl();
    const response = await apiFetch(`${baseUrl}/auth/exchange`, {
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
    if (isDemoAuthMode()) {
      return getDemoOrganizerDto();
    }
    const baseUrl = await this.getBaseUrl();
    const token = useAuthStore.getState().accessToken;

    if (!token) {
      throw new Error('No access token available');
    }

    if (isTokenExpired(token)) {
      handleAuthError('Authentication token has expired. Please login again.');
      throw new Error('Authentication token has expired');
    }

    try {
      const sessionCheckResponse = await apiFetch(`${baseUrl}/api/organizer/session/check`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-cache',
      });

      if (!sessionCheckResponse.ok) {
        if (sessionCheckResponse.status === 401) {
          handleAuthError('Authentication token expired or invalid');
          throw new Error('Authentication token expired or invalid');
        }
        throw new Error('Session check failed');
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('expired') || error.message.includes('invalid'))
      ) {
        throw error;
      }
      throw new Error('Session check failed');
    }

    const response = await apiFetch(`${baseUrl}/api/organizer/me`, {
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
    if (isDemoAuthMode()) {
      applyDemoAuthSession();
      return DEMO_ACCESS_TOKEN;
    }
    const baseUrl = await this.getBaseUrl();
    const response = await apiFetch(`${baseUrl}/auth/login`, {
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

    setAuthSessionToken(token);

    try {
      const organizer = await this.getCurrentOrganizer();
      useAuthStore.getState().setOrganizer({ id: organizer.id, name: organizer.name });
    } catch (err) {
      console.warn('Failed to load organizer info after login:', err);
    }

    return token;
  }

  async register(email: string, password: string, name: string): Promise<string> {
    if (isDemoAuthMode()) {
      applyDemoAuthSession();
      useAuthStore
        .getState()
        .setOrganizer({ id: getDemoOrganizerDto().id, name: name.trim() || 'Demo Organizer' });
      return DEMO_ACCESS_TOKEN;
    }
    const baseUrl = await this.getBaseUrl();
    const response = await apiFetch(`${baseUrl}/auth/register`, {
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

    setAuthSessionToken(token);

    try {
      const organizer = await this.getCurrentOrganizer();
      useAuthStore.getState().setOrganizer({ id: organizer.id, name: organizer.name });
    } catch (err) {
      console.warn('Failed to load organizer info after register:', err);
    }

    return token;
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    if (isDemoAuthMode()) {
      return { message: FORGOT_PASSWORD_GENERIC_SUCCESS };
    }

    const baseUrl = await this.getBaseUrl();
    const response = await apiFetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      cache: 'no-cache',
    });

    if (!response.ok) {
      await throwAuthHttpError(response);
    }

    if (response.status === 204) {
      return { message: FORGOT_PASSWORD_GENERIC_SUCCESS };
    }

    try {
      const data = (await response.json()) as ForgotPasswordResponse;
      return {
        message:
          typeof data.message === 'string' && data.message.trim()
            ? data.message
            : FORGOT_PASSWORD_GENERIC_SUCCESS,
      };
    } catch {
      return { message: FORGOT_PASSWORD_GENERIC_SUCCESS };
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (isDemoAuthMode()) {
      notifyDemoUnavailable();
      throw new AuthHttpError(503, 'Смена пароля недоступна в демо-режиме');
    }

    const baseUrl = await this.getBaseUrl();
    const token = useAuthStore.getState().accessToken;

    if (!token) {
      throw new AuthHttpError(401, 'Требуется авторизация');
    }

    const response = await apiFetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oldPassword,
        newPassword,
      }),
      cache: 'no-cache',
    });

    if (!response.ok) {
      await throwAuthHttpError(response);
    }
  }

  async logout(): Promise<void> {
    if (isDemoAuthMode()) {
      notifyDemoUnavailable();
      applyDemoAuthSession();
      return;
    }

    const baseUrl = await this.getBaseUrl();
    const token = useAuthStore.getState().accessToken;

    if (token) {
      try {
        await apiFetch(`${baseUrl}/auth/logout`, {
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

    clearAuthSession();
  }
}

export const authService = new AuthService();
