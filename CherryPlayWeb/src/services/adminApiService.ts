import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import type {
  AdminOrganizerDetailDto,
  AdminOrganizerListResponse,
  ApiErrorPayload,
  EntitlementDto,
  GrantEntitlementRequest,
  RevokeEntitlementRequest,
  ThemePackageListResponse,
} from '../types/api';
import { handleApiResponse, parseApiErrorPayload } from '../utils/apiErrorHandler';

function formatAdminError(payload: ApiErrorPayload | null, fallback: string): string {
  if (!payload) return fallback;
  if (payload.code === 'entitlement_already_active') {
    return 'Пакет уже выдан этому организатору и активен.';
  }
  if (payload.code === 'entitlement_already_revoked') {
    return 'Доступ уже отозван ранее.';
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
  return payload.detail || payload.message || fallback;
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

    const response = await fetch(
      getApiUrl(`${API_ENDPOINTS.ADMIN.ORGANIZERS}?${searchParams.toString()}`),
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache',
      },
    );

    return handleApiResponse<AdminOrganizerListResponse>(response, 'Ошибка загрузки организаторов');
  }

  async getOrganizerById(organizerId: string): Promise<AdminOrganizerDetailDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.ADMIN.ORGANIZER_BY_ID(organizerId)), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<AdminOrganizerDetailDto>(response, 'Ошибка загрузки организатора');
  }

  async getThemePackages(): Promise<ThemePackageListResponse> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.ADMIN.THEME_PACKAGES), {
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
    const response = await fetch(
      getApiUrl(API_ENDPOINTS.ADMIN.ORGANIZER_ENTITLEMENTS(organizerId)),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const payload = await parseApiErrorPayload<ApiErrorPayload>(response);
      throw new Error(formatAdminError(payload, 'Ошибка выдачи пакета'));
    }

    return response.json() as Promise<EntitlementDto>;
  }

  async revokeEntitlement(
    organizerId: string,
    entitlementId: string,
    request: RevokeEntitlementRequest,
  ): Promise<void> {
    const response = await fetch(
      getApiUrl(API_ENDPOINTS.ADMIN.ORGANIZER_ENTITLEMENT_BY_ID(organizerId, entitlementId)),
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const payload = await parseApiErrorPayload<ApiErrorPayload>(response);
      throw new Error(formatAdminError(payload, 'Ошибка отзыва доступа'));
    }
  }
}

export const adminApiService = new AdminApiService();
