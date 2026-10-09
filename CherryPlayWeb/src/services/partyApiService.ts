import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import { isPartyLifecycleState, LIFECYCLE_STATUS_LABELS } from '../constants/partyLifecycle';
import type {
  ApiErrorPayload,
  PartyLifecycleState,
  PartyPlaylistDto,
  PublicPartyDto,
  PartyStateDto,
  PublicPartyListItemDto,
  PartyDto,
  CreatePartyDto,
  TransitionPartyLifecycleDto,
  UpdatePartyDto,
} from '../types/api';
import { handleApiResponse, parseApiErrorPayload } from '../utils/apiErrorHandler';
import { apiFetch } from '../utils/apiFetch';

import {
  FuturePartyLimitReachedError,
  InvalidPartyLifecycleTransitionError,
  ThemeNotEntitledError,
} from './partyApiErrors';

const FUTURE_PARTY_LIMIT_FALLBACK = 2;

const buildFuturePartyLimitMessage = (limit: number): string => {
  return `Достигнут лимит: не больше ${limit} будущих вечеринок. Новую будущую вечеринку создать нельзя, и прошедшую нельзя перенести в будущее.`;
}

const resolveFuturePartyLimit = (limit: unknown): number => {
  return typeof limit === 'number' && Number.isInteger(limit) && limit > 0
    ? limit
    : FUTURE_PARTY_LIMIT_FALLBACK;
}

const buildThemeEntitlementMessage = (payload: ApiErrorPayload): string => {
  if (payload.code !== 'theme_not_entitled') {
    return payload.detail || payload.message || 'Ошибка доступа к теме';
  }

  const packageCodes = payload.requiredPackageCodes ?? [];
  if (!packageCodes.length) {
    return 'Выбранная тема недоступна. Обратитесь к администратору для выдачи пакета.';
  }

  return `Тема недоступна без пакета: ${packageCodes.join(', ')}. Обратитесь к администратору.`;
}

const buildLifecycleTransitionMessage = (payload: ApiErrorPayload): string => {
  if (payload.code !== 'invalid_lifecycle_transition') {
    return payload.detail || payload.message || 'Недопустимый переход состояния вечеринки';
  }

  const from = payload.currentState;
  const to = payload.requestedState;
  if (from && to) {
    const fromLabel = LIFECYCLE_STATUS_LABELS[from];
    const toLabel = LIFECYCLE_STATUS_LABELS[to];
    return `Нельзя перевести вечеринку из «${fromLabel}» в «${toLabel}».`;
  }

  return payload.message || 'Недопустимый переход состояния вечеринки';
}

const throwIfFuturePartyLimitReached = async (response: Response): Promise<void> => {
  if (response.status !== 403) {
    return;
  }

  const payload = await parseApiErrorPayload<ApiErrorPayload>(response.clone());
  if (!payload || payload.code !== 'future_party_limit_reached') {
    return;
  }

  const limit = resolveFuturePartyLimit(payload.limit);
  throw new FuturePartyLimitReachedError(buildFuturePartyLimitMessage(limit), limit);
}

const throwIfThemeNotEntitled = async (response: Response): Promise<void> => {
  if (response.status !== 403) {
    return;
  }

  const payload = await parseApiErrorPayload<ApiErrorPayload>(response.clone());
  if (!payload || payload.code !== 'theme_not_entitled') {
    return;
  }

  const message = buildThemeEntitlementMessage(payload);
  const themeId = typeof payload.themeId === 'string' ? payload.themeId : undefined;
  const requiredPackageCodes = Array.isArray(payload.requiredPackageCodes)
    ? payload.requiredPackageCodes.filter((code): code is string => typeof code === 'string')
    : [];

  throw new ThemeNotEntitledError(message, themeId, requiredPackageCodes);
}

const throwIfInvalidLifecycleTransition = async (response: Response): Promise<void> => {
  if (response.status !== 409) {
    return;
  }

  const payload = await parseApiErrorPayload<ApiErrorPayload>(response);
  if (!payload || payload.code !== 'invalid_lifecycle_transition') {
    return;
  }

  const message = buildLifecycleTransitionMessage(payload);
  const currentState = isPartyLifecycleState(payload.currentState) ? payload.currentState : 'draft';
  const requestedState = isPartyLifecycleState(payload.requestedState)
    ? payload.requestedState
    : 'draft';

  throw new InvalidPartyLifecycleTransitionError(message, currentState, requestedState);
}

class PartyApiService {
  async getMyParties(): Promise<PartyDto[]> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.MY), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<PartyDto[]>(response, 'Ошибка загрузки списка вечеринок');
  }

  async getPartyById(partyId: string): Promise<PartyDto> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.BY_ID(partyId)), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<PartyDto>(response, 'Ошибка загрузки вечеринки');
  }

  async createParty(dto: CreatePartyDto): Promise<PartyDto> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.MY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dto),
    });

    await throwIfFuturePartyLimitReached(response);
    await throwIfThemeNotEntitled(response);
    return handleApiResponse<PartyDto>(response, 'Ошибка создания вечеринки');
  }

  async updatePartyMetadata(partyId: string, dto: UpdatePartyDto): Promise<void> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.BY_ID(partyId)), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dto),
    });

    await throwIfFuturePartyLimitReached(response);
    await throwIfThemeNotEntitled(response);
    await handleApiResponse<void>(response, 'Ошибка обновления вечеринки');
  }

  async deleteParty(partyId: string): Promise<void> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.BY_ID(partyId)), {
      method: 'DELETE',
      credentials: 'include',
    });

    await handleApiResponse<void>(response, 'Ошибка удаления вечеринки');
  }

  async transitionPartyLifecycle(
    partyId: string,
    targetState: PartyLifecycleState,
  ): Promise<PartyDto> {
    const body: TransitionPartyLifecycleDto = { partyLifecycleState: targetState };
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.LIFECYCLE(partyId)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
      cache: 'no-cache',
    });

    await throwIfInvalidLifecycleTransition(response);
    await throwIfThemeNotEntitled(response);

    return handleApiResponse<PartyDto>(response, 'Ошибка смены состояния вечеринки');
  }

  async getFirstPartyPlaylist(): Promise<PartyPlaylistDto> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.FIRST), {
      cache: 'no-cache',
    });

    return handleApiResponse<PartyPlaylistDto>(response, 'Ошибка загрузки плейлиста');
  }

  async getPublicParty(shortCode: string): Promise<PublicPartyDto> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.BY_CODE(shortCode)), {
      cache: 'no-cache',
    });

    return handleApiResponse<PublicPartyDto>(response, 'Ошибка загрузки вечеринки');
  }

  async getPartyPlaylist(shortCode: string): Promise<PartyPlaylistDto> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.PLAYLIST(shortCode)), {
      cache: 'no-cache',
    });

    return handleApiResponse<PartyPlaylistDto>(response, 'Ошибка загрузки плейлиста');
  }

  async getPartyState(shortCode: string): Promise<PartyStateDto> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.STATE(shortCode)), {
      cache: 'no-cache',
    });

    return handleApiResponse<PartyStateDto>(response, 'Ошибка загрузки состояния');
  }

  async getAllParties(): Promise<PublicPartyListItemDto[]> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.PARTIES.PUBLIC.LIST), {
      cache: 'no-cache',
    });

    return handleApiResponse<PublicPartyListItemDto[]>(
      response,
      'Ошибка загрузки списка вечеринок',
    );
  }
}

export const partyApiService = new PartyApiService();

export {
  FuturePartyLimitReachedError,
  InvalidPartyLifecycleTransitionError,
  ThemeNotEntitledError,
} from './partyApiErrors';
