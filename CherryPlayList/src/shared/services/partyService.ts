import { getApiConfig } from '../config/apiConfig';
import {
  DEMO_PARTY_ID,
  DEMO_THEME_ACCESS,
  demoCreateParty,
  demoTransitionPartyLifecycle,
  demoUpdateParty,
  getDemoPartyPublicUrl,
  getDemoPartySnapshot,
  getDemoPartyState,
} from '../demo/demoPartyFixture';
import { isDemoAuthMode } from '../demo/guardDemoAuth';
import { useAuthStore } from '../stores/authStore';
import { handleApiResponse } from '../utils/apiErrorHandler';
import { apiFetch } from '../utils/apiFetch';
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

/** Жизненный цикл вечеринки (CONTRACTS.md §6.7, snake_case в JSON). */
export const PARTY_LIFECYCLE_STATES = ['draft', 'ready', 'completed'] as const;

export type PartyLifecycleState = (typeof PARTY_LIFECYCLE_STATES)[number];

export function isPartyLifecycleState(value: unknown): value is PartyLifecycleState {
  return typeof value === 'string' && (PARTY_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export interface TransitionPartyLifecycleDto {
  partyLifecycleState: PartyLifecycleState;
}

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
  partyLifecycleState: PartyLifecycleState;
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

export interface LockedThemeDto {
  themeId: string;
  packageCode: string;
  packageName: string;
}

export interface ThemeAccessDto {
  grantedThemeIds: string[];
  visibleLockedThemes: LockedThemeDto[];
  contactUrl: string;
}

export class ThemeNotEntitledError extends Error {
  readonly code: 'theme_not_entitled';
  readonly themeId?: string;
  readonly requiredPackageCodes: string[];

  constructor(message: string, themeId?: string, requiredPackageCodes: string[] = []) {
    super(message);
    this.name = 'ThemeNotEntitledError';
    this.code = 'theme_not_entitled';
    this.themeId = themeId;
    this.requiredPackageCodes = requiredPackageCodes;
  }
}

export class InvalidPartyLifecycleTransitionError extends Error {
  readonly code = 'invalid_lifecycle_transition' as const;
  readonly currentState: PartyLifecycleState;
  readonly requestedState: PartyLifecycleState;

  constructor(
    message: string,
    currentState: PartyLifecycleState,
    requestedState: PartyLifecycleState,
  ) {
    super(message);
    this.name = 'InvalidPartyLifecycleTransitionError';
    this.currentState = currentState;
    this.requestedState = requestedState;
  }
}

class PartyService {
  private themeAccessCache: ThemeAccessDto | null = null;
  private themeAccessCacheToken: string | null = null;
  private themeAccessInFlight: Promise<ThemeAccessDto> | null = null;
  private static readonly guidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

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

  invalidateThemeAccessCache(): void {
    this.themeAccessCache = null;
    this.themeAccessCacheToken = null;
    this.themeAccessInFlight = null;
  }

  async createParty(data: CreatePartyDto): Promise<PartyDto> {
    if (isDemoAuthMode()) {
      return demoCreateParty(data);
    }
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Для создания вечеринки необходимо войти в аккаунт');
    }
    const baseUrl = await this.getBaseUrl();
    const response = await apiFetch(`${baseUrl}/parties`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
      cache: 'no-cache',
    });

    await this.throwIfThemeNotEntitled(response);
    return handleApiResponse<PartyDto>(response, 'Failed to create party');
  }

  /**
   * Список вечеринок организатора. Сервер не возвращает записи в состоянии `draft`
   * (черновик доступен через {@link getParty}).
   */
  async getParties(): Promise<PartyDto[]> {
    if (isDemoAuthMode()) {
      return [getDemoPartySnapshot()];
    }
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Для просмотра списка вечеринок необходимо войти в аккаунт');
    }
    const baseUrl = await this.getBaseUrl();
    const response = await apiFetch(`${baseUrl}/parties`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      cache: 'no-cache',
    });
    return handleApiResponse<PartyDto[]>(response, 'Failed to load parties');
  }

  async getParty(partyId: string): Promise<PartyDto> {
    if (isDemoAuthMode()) {
      if (partyId === DEMO_PARTY_ID || partyId.toLowerCase() === DEMO_PARTY_ID) {
        return getDemoPartySnapshot();
      }
      return getDemoPartySnapshot();
    }
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Для получения данных вечеринки необходимо войти в аккаунт');
    }
    const baseUrl = await this.getBaseUrl();
    const normalizedPartyId = this.normalizePartyId(partyId);
    const response = await apiFetch(`${baseUrl}/parties/${normalizedPartyId}`, {
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
    if (isDemoAuthMode()) {
      return true;
    }
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
    if (isDemoAuthMode()) {
      demoUpdateParty(partyId, data);
      return;
    }
    const baseUrl = await this.getBaseUrl();
    const normalizedPartyId = this.normalizePartyId(partyId);
    const response = await apiFetch(`${baseUrl}/parties/${normalizedPartyId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
      cache: 'no-cache',
    });

    await this.throwIfThemeNotEntitled(response);
    await handleApiResponse<void>(response, 'Failed to update party');
  }

  async updatePartyPlaylist(
    partyId: string,
    playlist: { items: PlayerItemForApi[]; totalTracks: number; totalDuration: number },
  ): Promise<void> {
    if (isDemoAuthMode()) {
      void partyId;
      void playlist;
      return;
    }
    const baseUrl = await this.getBaseUrl();
    const normalizedPartyId = this.normalizePartyId(partyId);
    const response = await apiFetch(`${baseUrl}/parties/${normalizedPartyId}/playlist`, {
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
    if (isDemoAuthMode()) {
      void partyId;
      return;
    }
    const baseUrl = await this.getBaseUrl();
    const normalizedPartyId = this.normalizePartyId(partyId);
    const response = await apiFetch(`${baseUrl}/parties/${normalizedPartyId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      cache: 'no-cache',
    });
    await handleApiResponse<void>(response, 'Failed to delete party');
  }

  /**
   * Перевод вечеринки в целевое состояние жизненного цикла (POST `/api/parties/{partyId}/lifecycle`).
   * Идемпотентно, если уже в целевом состоянии. При недопустимом переходе — 409
   * {@link InvalidPartyLifecycleTransitionError}.
   */
  async transitionPartyLifecycle(
    partyId: string,
    targetState: PartyLifecycleState,
  ): Promise<PartyDto> {
    if (isDemoAuthMode()) {
      void partyId;
      return demoTransitionPartyLifecycle(targetState);
    }
    const baseUrl = await this.getBaseUrl();
    const normalizedPartyId = this.normalizePartyId(partyId);
    const body: TransitionPartyLifecycleDto = { partyLifecycleState: targetState };
    const response = await apiFetch(`${baseUrl}/parties/${normalizedPartyId}/lifecycle`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body),
      cache: 'no-cache',
    });

    await this.throwIfInvalidLifecycleTransition(response);
    return handleApiResponse<PartyDto>(response, 'Failed to transition party lifecycle');
  }

  async getPartyState(shortCode: string): Promise<PartyStateDto | null> {
    if (isDemoAuthMode()) {
      void shortCode;
      return getDemoPartyState();
    }
    const baseUrl = await this.getBaseUrl();
    const response = await apiFetch(`${baseUrl}/parties/public/${shortCode}/state`, {
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
    if (isDemoAuthMode()) {
      return getDemoPartyPublicUrl(shortCode);
    }
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

  async getThemeAccess(forceRefresh = false): Promise<ThemeAccessDto> {
    if (isDemoAuthMode()) {
      void forceRefresh;
      return DEMO_THEME_ACCESS;
    }
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      this.invalidateThemeAccessCache();
      throw new Error('Для получения доступа к темам необходимо войти в аккаунт');
    }

    if (this.themeAccessCacheToken !== token) {
      this.invalidateThemeAccessCache();
      this.themeAccessCacheToken = token;
    }

    if (!forceRefresh && this.themeAccessCache) {
      return this.themeAccessCache;
    }

    if (!forceRefresh && this.themeAccessInFlight) {
      return this.themeAccessInFlight;
    }

    this.themeAccessInFlight = (async () => {
      const baseUrl = await this.getBaseUrl();
      const response = await apiFetch(`${baseUrl}/organizer/me/theme-access`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-cache',
      });

      if (response.status === 401 || response.status === 403) {
        this.invalidateThemeAccessCache();
      }
      const data = await handleApiResponse<ThemeAccessDto>(response, 'Failed to load theme access');
      this.themeAccessCache = data;
      return data;
    })();

    try {
      return await this.themeAccessInFlight;
    } finally {
      this.themeAccessInFlight = null;
    }
  }

  private async throwIfThemeNotEntitled(response: Response): Promise<void> {
    if (response.status !== 403) {
      return;
    }

    let payload: unknown;
    try {
      payload = await response.clone().json();
    } catch {
      return;
    }

    if (!payload || typeof payload !== 'object') {
      return;
    }

    const body = payload as {
      code?: unknown;
      message?: unknown;
      detail?: unknown;
      themeId?: unknown;
      requiredPackageCodes?: unknown;
    };

    if (body.code !== 'theme_not_entitled') {
      return;
    }

    const message =
      (typeof body.message === 'string' && body.message) ||
      (typeof body.detail === 'string' && body.detail) ||
      'У вас нет доступа к выбранной теме.';

    const themeId = typeof body.themeId === 'string' ? body.themeId : undefined;
    const requiredPackageCodes = Array.isArray(body.requiredPackageCodes)
      ? body.requiredPackageCodes.filter((code): code is string => typeof code === 'string')
      : [];

    throw new ThemeNotEntitledError(message, themeId, requiredPackageCodes);
  }

  private async throwIfInvalidLifecycleTransition(response: Response): Promise<void> {
    if (response.status !== 409) {
      return;
    }

    let payload: unknown;
    try {
      payload = await response.clone().json();
    } catch {
      return;
    }

    if (!payload || typeof payload !== 'object') {
      return;
    }

    const body = payload as {
      code?: unknown;
      message?: unknown;
      detail?: unknown;
      currentState?: unknown;
      requestedState?: unknown;
    };

    if (body.code !== 'invalid_lifecycle_transition') {
      return;
    }

    const message =
      (typeof body.message === 'string' && body.message) ||
      (typeof body.detail === 'string' && body.detail) ||
      'Недопустимый переход состояния вечеринки.';

    const currentState = isPartyLifecycleState(body.currentState) ? body.currentState : 'draft';
    const requestedState = isPartyLifecycleState(body.requestedState)
      ? body.requestedState
      : 'draft';

    throw new InvalidPartyLifecycleTransitionError(message, currentState, requestedState);
  }

  private normalizePartyId(partyId: string): string {
    const normalized = partyId.trim().replace(/^\{|\}$/g, '');
    if (!PartyService.guidRegex.test(normalized)) {
      throw new Error('Некорректный идентификатор вечеринки');
    }
    return normalized.toLowerCase();
  }
}

export const partyService = new PartyService();
