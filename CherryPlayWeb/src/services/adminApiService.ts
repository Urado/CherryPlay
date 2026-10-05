import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import type {
  AdminOrganizerDetailDto,
  AdminOrganizerListResponse,
  ApiErrorPayload,
  CreateEntitlementRevocationRequest,
  EntitlementDto,
  EntitlementRevocationDto,
  GrantEntitlementRequest,
  ThemePackageListResponse,
} from '../types/api';
import { createApiError, handleApiResponse, parseApiErrorPayload } from '../utils/apiErrorHandler';
import { apiFetch } from '../utils/apiFetch';

function formatAdminError(payload: ApiErrorPayload | null, fallback: string): string {
  if (!payload) return fallback;
  if (payload.code === 'entitlement_already_active') {
    return 'Пакет уже выдан этому организатору и активен.';
  }
  if (payload.code === 'entitlement_already_revoked') {
    return 'Доступ уже отозван. Обновите карточку организатора.';
  }
  if (payload.code === 'revocation_id_conflict') {
    return 'Идентификатор отзыва уже использован. Повторите действие с новым идентификатором.';
  }
  if (payload.code === 'package_is_auto_granted') {
    return 'Этот пакет выдается автоматически и не требует ручной выдачи.';
  }
  if (payload.code === 'organizer_not_found') {
    return 'Организатор не найден.';
  }
  if (payload.code === 'package_not_found') {
    return 'Пакет не найден или неактивен.';
  }
  if (payload.code === 'entitlement_not_found') {
    return 'Выбранный доступ не найден.';
  }
  return payload.detail || payload.message || payload.error || fallback;
}

async function createAdminApiError(
  response: Response,
  payload: ApiErrorPayload | null,
  fallback: string,
) {
  const error = await createApiError(response, fallback);
  return {
    ...error,
    message: formatAdminError(payload, error.message || fallback),
    code: payload?.code ?? error.code,
    details: payload ?? error.details,
  };
}

class AdminApiService {
  async getOrganizers(params: {
    query?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AdminOrganizerListResponse> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set('query', params.query);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

    const queryString = searchParams.toString();
    const organizersUrl = queryString
      ? `${API_ENDPOINTS.ADMIN.ORGANIZERS}?${queryString}`
      : API_ENDPOINTS.ADMIN.ORGANIZERS;

    const response = await apiFetch(getApiUrl(organizersUrl), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<AdminOrganizerListResponse>(response, 'Ошибка загрузки организаторов');
  }

  async getOrganizerById(organizerId: string): Promise<AdminOrganizerDetailDto> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.ADMIN.ORGANIZER_BY_ID(organizerId)), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<AdminOrganizerDetailDto>(response, 'Ошибка загрузки организатора');
  }

  async getThemePackages(): Promise<ThemePackageListResponse> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.ADMIN.THEME_PACKAGES), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<ThemePackageListResponse>(response, 'Ошибка загрузки пакетов');
  }

  async grantEntitlement(
    organizerId: string,
    request: GrantEntitlementRequest,
  ): Promise<EntitlementDto> {
    const response = await apiFetch(
      getApiUrl(API_ENDPOINTS.ADMIN.ORGANIZER_ENTITLEMENTS(organizerId)),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const payload = await parseApiErrorPayload<ApiErrorPayload>(response.clone());
      throw await createAdminApiError(response, payload, 'Ошибка выдачи пакета');
    }

    return response.json() as Promise<EntitlementDto>;
  }

  async revokeEntitlement(request: CreateEntitlementRevocationRequest): Promise<void> {
    const response = await apiFetch(
      getApiUrl(API_ENDPOINTS.ADMIN.ENTITLEMENT_REVOCATIONS),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const payload = await parseApiErrorPayload<ApiErrorPayload>(response.clone());
      throw await createAdminApiError(response, payload, 'Ошибка отзыва доступа');
    }
  }

  async getEntitlementRevocations(entitlementId: string): Promise<EntitlementRevocationDto[]> {
    const searchParams = new URLSearchParams({ entitlementId });
    const response = await apiFetch(
      getApiUrl(`${API_ENDPOINTS.ADMIN.ENTITLEMENT_REVOCATIONS}?${searchParams.toString()}`),
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache',
      },
    );

    return handleApiResponse<EntitlementRevocationDto[]>(
      response,
      'Ошибка загрузки истории отзывов',
    );
  }
}

export const adminApiService = new AdminApiService();
