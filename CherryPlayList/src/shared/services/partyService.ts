import { getApiConfig } from '../config/apiConfig';
import { useAuthStore } from '../stores/authStore';
import { handleApiResponse } from '../utils/apiErrorHandler';
import type { PlayerItemForApi } from '../utils/partyUtils';

export const MAX_SHORT_DESCRIPTION_LENGTH = 200;

export const MAX_DANCE_TAGS = 20;

export const MAX_DANCE_TAG_LENGTH = 50;

export const MAX_EXTERNAL_LINK_URL_LENGTH = 2048;

export const MAX_EXTERNAL_LINK_TEXT_LENGTH = 200;

export const PREDEFINED_DANCE_TAGS = [
  'Кросс-степ вальс',
  'Свободные Вальсы',
  'КД',
  'ШКД',
  'Кадрили',
  'Фигурные вальсы',
] as const;

export interface CreatePartyDto {
  name: string;
  title?: string;
  subtitle?: string;
  partyThemeId: string;
  customizationSettings?: Record<string, unknown>;
  playlistData: {
    items: PlayerItemForApi[];
    totalDuration: number;
    totalTracks: number;
  };
  eventDateTime?: string;
  eventEndDateTime?: string;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
  isListedInCatalog?: boolean;
  shortDescription?: string;
  externalLinkUrl?: string;
  externalLinkText?: string;
  danceTags?: string[];
}

export interface PartyDto {
  id: string;
  name: string;
  title?: string;
  subtitle?: string;
  shortCode: string;
  partyThemeId: string;
  customizationSettings?: Record<string, unknown>;
  createdAt: string;
  hasActiveSession: boolean;
  eventDateTime?: string;
  eventEndDateTime?: string;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
  shortDescription?: string;
  externalLinkUrl?: string;
  externalLinkText?: string;
  danceTags?: string[];
}

export interface UpdatePartyDto {
  name?: string;
  title?: string;
  subtitle?: string;
  partyThemeId?: string;
  customizationSettings?: Record<string, unknown>;
  eventDateTime?: string | null;
  eventEndDateTime?: string | null;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
  isListedInCatalog?: boolean;
  shortDescription?: string;
  externalLinkUrl?: string;
  externalLinkText?: string;
  danceTags?: string[];
}

export interface PartyStateDto {
  partyId: string;
  isSessionActive: boolean;
  playlist: { items: unknown[]; totalDuration: number; totalTracks: number };
  serverTrackIds?: string[];
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
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Для получения данных вечеринки необходимо войти в аккаунт');
    }
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

  async checkServerReachable(): Promise<boolean> {
    try {
      const config = await getApiConfig();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`${config.serverUrl}/api/health`, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-cache',
        });
        return response.ok;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return false;
    }
  }

  async updateParty(partyId: string, data: UpdatePartyDto): Promise<void> {
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

  async deleteParty(partyId: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties/${partyId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      cache: 'no-cache',
    });
    await handleApiResponse<void>(response, 'Failed to delete party');
  }

  async getPartyState(shortCode: string): Promise<PartyStateDto | null> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties/public/${shortCode}/state`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache',
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      await handleApiResponse<never>(response, 'Failed to get party state');
    }
    return response.json() as Promise<PartyStateDto>;
  }

  async getPartyUrl(shortCode: string): Promise<string> {
    const config = await getApiConfig();
    const serverUrl = config.serverUrl;

    try {
      const url = new URL(serverUrl);
      const protocol = url.protocol;
      const hostname = url.hostname;

      const apiPort = url.port;

      let webPort: string | null = null;
      if (apiPort && apiPort !== '80' && apiPort !== '443') {
        if (apiPort === '5000') {
          webPort = '3000';
        } else {
          webPort = url.protocol === 'https:' ? '443' : '80';
        }
      }

      if (webPort) {
        return `${protocol}//${hostname}:${webPort}/party/${shortCode}`;
      }

      return `${protocol}//${hostname}/party/${shortCode}`;
    } catch {
      const cleanUrl = serverUrl.replace(/^https?:\/\//, '').split('/')[0];
      const protocol = serverUrl.startsWith('https') ? 'https' : 'http';
      const defaultWebPort = serverUrl.includes(':5000') ? '3000' : null;
      if (defaultWebPort) {
        return `${protocol}://${cleanUrl}:${defaultWebPort}/party/${shortCode}`;
      }
      return `${protocol}://${cleanUrl}/party/${shortCode}`;
    }
  }
}

export const partyService = new PartyService();
