import { getApiConfig } from '../config/apiConfig';
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
}

export interface PartyDto {
  id: string;
  name: string;
  shortCode: string;
  themeId: string;
  createdAt: string;
  hasActiveSession: boolean;
  eventDateTime?: string;
}

class PartyService {
  private async getBaseUrl(): Promise<string> {
    const config = await getApiConfig();
    return config.apiUrl;
  }

  async createParty(data: CreatePartyDto): Promise<PartyDto> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      cache: 'no-cache',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create party: ${errorText}`);
    }

    return response.json();
  }

  async getParties(): Promise<PartyDto[]> {
    return Promise.resolve([]);
  }

  async getParty(partyId: string): Promise<PartyDto> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties/${partyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-cache',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Party not found');
      }
      const errorText = await response.text();
      throw new Error(`Failed to get party: ${errorText}`);
    }

    return response.json();
  }

  async checkPartyExists(partyId: string): Promise<boolean> {
    try {
      await this.getParty(partyId);
      return true;
    } catch {
      return false;
    }
  }

  async updateParty(_partyId: string, _data: Partial<CreatePartyDto>): Promise<PartyDto> {
    throw new Error('Not implemented');
  }

  async updatePartyPlaylist(
    partyId: string,
    playlist: { items: PlayerItemForApi[]; totalTracks: number; totalDuration: number },
  ): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/parties/${partyId}/playlist`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(playlist),
      cache: 'no-cache',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update party playlist: ${errorText}`);
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

      if (url.port && url.port !== '80' && url.port !== '443') {
        const webPort = url.protocol === 'https:' ? '443' : '80';
        return `${protocol}//${hostname}${webPort === '80' ? '' : `:${webPort}`}/?party=${shortCode}`;
      }

      return `${protocol}//${hostname}/?party=${shortCode}`;
    } catch {
      const cleanUrl = serverUrl.replace(/^https?:\/\//, '').split('/')[0];
      const protocol = serverUrl.startsWith('https') ? 'https' : 'http';
      return `${protocol}://${cleanUrl}/?party=${shortCode}`;
    }
  }
}

export const partyService = new PartyService();
