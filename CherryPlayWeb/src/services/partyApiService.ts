/**
 * Сервис для работы с API вечеринок
 */
import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import type {
  PartyPlaylistDto,
  PublicPartyDto,
  PartyStateDto,
  PublicPartyListItemDto,
} from '../types/api';

class PartyApiService {
  /**
   * Получает плейлист первого доступного вечеринки (для демо)
   */
  async getFirstPartyPlaylist(): Promise<PartyPlaylistDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.FIRST), {
      cache: 'no-cache',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Плейлист не найден');
      }
      throw new Error(`Ошибка загрузки плейлиста: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Получает публичную информацию о вечеринке
   */
  async getPublicParty(shortCode: string): Promise<PublicPartyDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.BY_CODE(shortCode)), {
      cache: 'no-cache',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Вечеринка не найдена');
      }
      throw new Error(`Ошибка загрузки вечеринки: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Получает плейлист вечеринки по shortCode
   */
  async getPartyPlaylist(shortCode: string): Promise<PartyPlaylistDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.PLAYLIST(shortCode)), {
      cache: 'no-cache',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Плейлист не найден');
      }
      throw new Error(`Ошибка загрузки плейлиста: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Получает полное состояние вечеринки
   */
  async getPartyState(shortCode: string): Promise<PartyStateDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.STATE(shortCode)), {
      cache: 'no-cache',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Вечеринка не найдена');
      }
      throw new Error(`Ошибка загрузки состояния: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Получает список всех публичных вечеринок
   */
  async getAllParties(): Promise<PublicPartyListItemDto[]> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.LIST), {
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки списка вечеринок: ${response.statusText}`);
    }

    return response.json();
  }
}

export const partyApiService = new PartyApiService();
