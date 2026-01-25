/**
 * Сервис для работы с API вечеринок
 */
import type {
  PartyPlaylistDto,
  PublicPartyDto,
  PartyStateDto,
  PublicPartyListItemDto,
} from '../types/api';

// В продакшене используем относительные пути (nginx проксирует /api на backend)
// В разработке используем VITE_API_URL или localhost:5000
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

class PartyApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  /**
   * Получает плейлист первого доступного вечеринки (для демо)
   */
  async getFirstPartyPlaylist(): Promise<PartyPlaylistDto> {
    const response = await fetch(`${this.baseUrl}/api/parties/public/first`, {
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
    const response = await fetch(`${this.baseUrl}/api/parties/public/${shortCode}`, {
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
    const response = await fetch(`${this.baseUrl}/api/parties/public/${shortCode}/playlist`, {
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
    const response = await fetch(`${this.baseUrl}/api/parties/public/${shortCode}/state`, {
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
    const response = await fetch(`${this.baseUrl}/api/parties/public/list`, {
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки списка вечеринок: ${response.statusText}`);
    }

    return response.json();
  }
}

export const partyApiService = new PartyApiService();
