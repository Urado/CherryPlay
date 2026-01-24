/**
 * Сервис для работы с вечеринками через REST API
 */

import { apiConfig } from '../config/apiConfig';
import type { PlayerItemForApi } from '../utils/partyUtils';

export interface CreatePartyDto {
  name: string;
  themeId: string;
  customizationSettings?: Record<string, any>;
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
  private get baseUrl(): string {
    return apiConfig.apiUrl;
  }

  /**
   * Создает новую вечеринку
   */
  async createParty(data: CreatePartyDto): Promise<PartyDto> {
    const response = await fetch(`${this.baseUrl}/parties`, {
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

  /**
   * Получает список вечеринок
   */
  async getParties(): Promise<PartyDto[]> {
    // В минимальной версии не реализовано
    return Promise.resolve([]);
  }

  /**
   * Получает вечеринку по ID
   */
  async getParty(partyId: string): Promise<PartyDto> {
    const response = await fetch(`${this.baseUrl}/parties/${partyId}`, {
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

  /**
   * Проверяет существование вечеринки на сервере
   */
  async checkPartyExists(partyId: string): Promise<boolean> {
    try {
      await this.getParty(partyId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Обновляет вечеринку
   */
  async updateParty(_partyId: string, _data: Partial<CreatePartyDto>): Promise<PartyDto> {
    // В минимальной версии не реализовано
    throw new Error('Not implemented');
  }

  /**
   * Обновляет плейлист вечеринки
   */
  async updatePartyPlaylist(partyId: string, playlist: { items: any[]; totalTracks: number; totalDuration: number }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/parties/${partyId}/playlist`, {
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

  /**
   * Удаляет вечеринку
   */
  async deleteParty(_partyId: string): Promise<void> {
    // В минимальной версии не реализовано
    throw new Error('Not implemented');
  }

  /**
   * Генерирует URL для вечеринки
   */
  getPartyUrl(shortCode: string): string {
    return `http://localhost:3000/?party=${shortCode}`;
  }
}

export const partyService = new PartyService();

