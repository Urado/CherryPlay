import type { AuthService as IAuthService, OrganizerDto } from '@cherryplay/components';

import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';

class AuthService implements IAuthService {
  async checkAuth(): Promise<OrganizerDto | null> {
    try {
      // Сначала проверяем валидность сессии легковесным эндпоинтом
      const sessionCheckUrl = getApiUrl(API_ENDPOINTS.ORGANIZER.SESSION_CHECK);
      const sessionResponse = await fetch(sessionCheckUrl, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache',
      });

      if (!sessionResponse.ok) {
        if (sessionResponse.status === 401) {
          return null;
        }
        // Если сервер недоступен (404, 500 и т.д.), не логируем ошибку
        return null;
      }

      // Если сессия валидна, получаем полную информацию об организаторе
      const url = getApiUrl(API_ENDPOINTS.ORGANIZER.ME);
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache',
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        return null;
      }

      const organizer = (await response.json()) as OrganizerDto;
      return organizer;
    } catch {
      // Не логируем сетевые ошибки при проверке сессии
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

  async updateProfile(data: {
    name?: string;
    logoUrl?: string;
    links?: Record<string, string>;
    timeZone?: string;
  }): Promise<OrganizerDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.ORGANIZER.PROFILE), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
      cache: 'no-cache',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update profile: ${errorText}`);
    }

    return response.json() as Promise<OrganizerDto>;
  }
}

export const authService = new AuthService();
