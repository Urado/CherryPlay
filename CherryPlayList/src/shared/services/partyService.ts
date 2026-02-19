import { getApiConfig } from '../config/apiConfig';
import { useAuthStore } from '../stores/authStore';
import { handleApiResponse } from '../utils/apiErrorHandler';
import type { PlayerItemForApi } from '../utils/partyUtils';

export interface CreatePartyDto {
  name: string;
  themeId: string;
  customizationSettings?: Record<string, string | number>;
  playlistData: {
    items: PlayerItemForApi[];
    totalDuration: number;
    totalTracks: number;
  };
  eventDateTime?: string;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
}

export interface PartyDto {
  id: string;
  name: string;
  shortCode: string;
  themeId: string;
  createdAt: string;
  hasActiveSession: boolean;
  eventDateTime?: string;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
}

class PartyService {
  private async getBaseUrl(): Promise<string> {
    const config = await getApiConfig();
    return config.apiUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async createParty(data: CreatePartyDto): Promise<PartyDto> {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Для создания вечеринки необходимо войти в аккаунт');
    }
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
      cache: 'no-cache',
    });

    return handleApiResponse<PartyDto>(response, 'Failed to create party');
  }

  async getParties(): Promise<PartyDto[]> {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Для просмотра списка вечеринок необходимо войти в аккаунт');
    }
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      cache: 'no-cache',
    });
    return handleApiResponse<PartyDto[]>(response, 'Failed to load parties');
  }

  async getParty(partyId: string): Promise<PartyDto> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties/${partyId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      cache: 'no-cache',
    });

    return handleApiResponse<PartyDto>(response, 'Failed to get party');
  }

  async checkPartyExists(partyId: string): Promise<boolean> {
    try {
      await this.getParty(partyId);
      return true;
    } catch {
      return false;
    }
  }

  async updateParty(partyId: string, data: Partial<CreatePartyDto>): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties/${partyId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
      cache: 'no-cache',
    });

    await handleApiResponse<void>(response, 'Failed to update party');
  }

  async updatePartyPlaylist(
    partyId: string,
    playlist: { items: PlayerItemForApi[]; totalTracks: number; totalDuration: number },
  ): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties/${partyId}/playlist`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(playlist),
      cache: 'no-cache',
    });

    if (!response.ok) {
      await handleApiResponse<never>(response, 'Failed to update party playlist');
    }
  }

  async deleteParty(_partyId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async getPartyUrl(shortCode: string): Promise<string> {
    const config = await getApiConfig();
    const serverUrl = config.serverUrl;

    try {
      const url = new URL(serverUrl);
      const protocol = url.protocol;
      const hostname = url.hostname;

      // Определяем порт веб-приложения
      // По умолчанию веб-приложение работает на порту 3000 (dev) или 80 (prod через nginx)
      // Если API сервер на порту 5000, веб обычно на 3000
      const apiPort = url.port;

      // В dev режиме: если API на 5000, веб на 3000
      // В prod через nginx: оба на одном домене без порта или на стандартных портах
      let webPort: string | null = null;
      if (apiPort && apiPort !== '80' && apiPort !== '443') {
        if (apiPort === '5000') {
          // Dev режим: веб на 3000
          webPort = '3000';
        } else {
          // Для других портов используем стандартные
          webPort = url.protocol === 'https:' ? '443' : '80';
        }
      }
      // Если порт стандартный или отсутствует (nginx), используем тот же домен без порта

      // Используем формат /party/:shortCode
      if (webPort) {
        return `${protocol}//${hostname}:${webPort}/party/${shortCode}`;
      }

      return `${protocol}//${hostname}/party/${shortCode}`;
    } catch {
      const cleanUrl = serverUrl.replace(/^https?:\/\//, '').split('/')[0];
      const protocol = serverUrl.startsWith('https') ? 'https' : 'http';
      // По умолчанию используем порт 3000 для веб-приложения в dev режиме
      const defaultWebPort = serverUrl.includes(':5000') ? '3000' : null;
      if (defaultWebPort) {
        return `${protocol}://${cleanUrl}:${defaultWebPort}/party/${shortCode}`;
      }
      return `${protocol}://${cleanUrl}/party/${shortCode}`;
    }
  }
}

export const partyService = new PartyService();
