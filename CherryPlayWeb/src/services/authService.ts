import type { AuthService as IAuthService, OrganizerDto } from '@cherryplay/components';

import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';

class AuthService implements IAuthService {
  async checkAuth(): Promise<OrganizerDto | null> {
    try {
      const url = getApiUrl(API_ENDPOINTS.ORGANIZER.ME);
      console.log('[AuthService] Checking auth at:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache',
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('[AuthService] Not authenticated (401)');
          return null;
        }
        console.warn('[AuthService] Auth check failed:', response.status, response.statusText);
        return null;
      }

      const organizer = (await response.json()) as OrganizerDto;
      console.log('[AuthService] Authenticated as:', organizer.id);
      return organizer;
    } catch (error) {
      console.log(
        '[AuthService] Auth check failed (network error):',
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
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
  }

  async register(email: string, password: string, name: string): Promise<void> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
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
  }

  async logout(): Promise<void> {
    try {
      await fetch(getApiUrl(API_ENDPOINTS.AUTH.LOGOUT), {
        method: 'POST',
        credentials: 'include',
        cache: 'no-cache',
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  async startOAuthFlow(provider: 'telegram' | 'vk' | 'mailru'): Promise<void> {
    const authUrl = getApiUrl(API_ENDPOINTS.AUTH.OAUTH_START(provider).replace('/start', '/web'));
    window.location.href = authUrl;
  }
}

export const authService = new AuthService();
