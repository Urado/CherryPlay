/**
 * Сервис для работы с API вечеринок
 */
import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import type {
  ApiErrorPayload,
  PartyPlaylistDto,
  PublicPartyDto,
  PartyStateDto,
  PublicPartyListItemDto,
  PartyDto,
  CreatePartyDto,
  UpdatePartyDto,
} from '../types/api';
import { handleApiResponse, createApiError } from '../utils/apiErrorHandler';

function buildThemeEntitlementError(payload: ApiErrorPayload): string {
  if (payload.code !== 'theme_not_entitled') {
    return payload.detail || payload.message || 'Ошибка доступа к теме';
  }

  const packageCodes = payload.requiredPackageCodes ?? [];
  if (!packageCodes.length) {
    return 'Выбранная тема недоступна. Обратитесь к администратору для выдачи пакета.';
  }

  return `Тема недоступна без пакета: ${packageCodes.join(', ')}. Обратитесь к администратору.`;
}

class PartyApiService {
  /**
   * Список вечеринок текущего организатора (требует авторизации)
   */
  async getMyParties(): Promise<PartyDto[]> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.MY), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<PartyDto[]>(response, 'Ошибка загрузки списка вечеринок');
  }

  /**
   * Создать вечеринку (требует авторизации)
   */
  async createParty(dto: CreatePartyDto): Promise<PartyDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.MY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const error = await createApiError(response, 'Ошибка создания вечеринки');
      const payload = (error.details ?? null) as ApiErrorPayload | null;
      throw new Error(payload ? buildThemeEntitlementError(payload) : error.message);
    }

    return response.json() as Promise<PartyDto>;
  }

  /**
   * Обновить метаданные вечеринки (требует авторизации)
   */
  async updatePartyMetadata(partyId: string, dto: UpdatePartyDto): Promise<void> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.BY_ID(partyId)), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const error = await createApiError(response, 'Ошибка обновления вечеринки');
      const payload = (error.details ?? null) as ApiErrorPayload | null;
      throw new Error(payload ? buildThemeEntitlementError(payload) : error.message);
    }
  }

  /**
   * Удалить вечеринку (требует авторизации)
   */
  async deleteParty(partyId: string): Promise<void> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.BY_ID(partyId)), {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await createApiError(response, 'Ошибка удаления вечеринки');
      throw new Error(error.message);
    }
  }

  /**
   * Получает плейлист первого доступного вечеринки (для демо)
   */
  async getFirstPartyPlaylist(): Promise<PartyPlaylistDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.FIRST), {
      cache: 'no-cache',
    });

    return handleApiResponse<PartyPlaylistDto>(response, 'Ошибка загрузки плейлиста');
  }

  /**
   * Получает публичную информацию о вечеринке
   */
  async getPublicParty(shortCode: string): Promise<PublicPartyDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.BY_CODE(shortCode)), {
      cache: 'no-cache',
    });

    return handleApiResponse<PublicPartyDto>(response, 'Ошибка загрузки вечеринки');
  }

  /**
   * Получает плейлист вечеринки по shortCode
   */
  async getPartyPlaylist(shortCode: string): Promise<PartyPlaylistDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.PLAYLIST(shortCode)), {
      cache: 'no-cache',
    });

    return handleApiResponse<PartyPlaylistDto>(response, 'Ошибка загрузки плейлиста');
  }

  /**
   * Получает полное состояние вечеринки
   */
  async getPartyState(shortCode: string): Promise<PartyStateDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.STATE(shortCode)), {
      cache: 'no-cache',
    });

    return handleApiResponse<PartyStateDto>(response, 'Ошибка загрузки состояния');
  }

  /**
   * Получает список всех публичных вечеринок
   */
  async getAllParties(): Promise<PublicPartyListItemDto[]> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.LIST), {
      cache: 'no-cache',
    });

    return handleApiResponse<PublicPartyListItemDto[]>(
      response,
      'Ошибка загрузки списка вечеринок',
    );
  }
}

export const partyApiService = new PartyApiService();
