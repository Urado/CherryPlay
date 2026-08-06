import type {
  AuthService as IAuthService,
  ForgotPasswordResponse,
  OrganizerDto,
} from '@cherryplay/components';
import { AuthHttpError } from '@cherryplay/components';

import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import { apiFetch } from '../utils/apiFetch';

async function readAuthErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) {
      return '';
    }
    try {
      const json = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
      if (typeof json.detail === 'string' && json.detail.trim()) {
        return json.detail;
      }
      if (typeof json.message === 'string' && json.message.trim()) {
        return json.message;
      }
      if (typeof json.error === 'string' && json.error.trim()) {
        return json.error;
      }
      return text;
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

async function throwAuthHttpError(response: Response): Promise<never> {
  const message = await readAuthErrorMessage(response);
  throw new AuthHttpError(response.status, message);
}

class AuthService implements IAuthService {
  async checkAuth(): Promise<OrganizerDto | null> {
    try {
      const sessionCheckUrl = getApiUrl(API_ENDPOINTS.ORGANIZER.SESSION_CHECK);
      const sessionResponse = await apiFetch(sessionCheckUrl, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache',
      });

      if (!sessionResponse.ok) {
        return null;
      }

      const url = getApiUrl(API_ENDPOINTS.ORGANIZER.ME);
      const response = await apiFetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache',
      });

      if (!response.ok) {
        return null;
      }

      const organizer = (await response.json()) as OrganizerDto;
      return organizer;
    } catch {
      return null;
    }
  }

  async login(email: string, password: string): Promise<void> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
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
      await throwAuthHttpError(response);
    }
  }

  async register(email: string, password: string, name: string): Promise<void> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
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
      await throwAuthHttpError(response);
    }
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponse | void> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.AUTH.FORGOT_PASSWORD), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email }),
      cache: 'no-cache',
    });

    if (!response.ok) {
      await throwAuthHttpError(response);
    }

    if (response.status === 204) {
      return;
    }

    const text = await response.text();
    if (!text) {
      return;
    }

    try {
      return JSON.parse(text) as ForgotPasswordResponse;
    } catch {
      return { message: text };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.AUTH.RESET_PASSWORD), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ token, newPassword }),
      cache: 'no-cache',
    });

    if (!response.ok) {
      await throwAuthHttpError(response);
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.AUTH.CHANGE_PASSWORD), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ oldPassword, newPassword }),
      cache: 'no-cache',
    });

    if (!response.ok) {
      await throwAuthHttpError(response);
    }
  }

  async logout(): Promise<void> {
    try {
      await apiFetch(getApiUrl(API_ENDPOINTS.AUTH.LOGOUT), {
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
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.ORGANIZER.PROFILE), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
      cache: 'no-cache',
    });

    if (!response.ok) {
      await throwAuthHttpError(response);
    }

    return response.json() as Promise<OrganizerDto>;
  }
}

export const authService = new AuthService();
