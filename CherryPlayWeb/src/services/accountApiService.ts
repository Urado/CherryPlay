import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import { createApiError } from '../utils/apiErrorHandler';
import { apiFetch } from '../utils/apiFetch';

export async function deleteOrganizerAccount(): Promise<void> {
  const response = await apiFetch(getApiUrl(API_ENDPOINTS.ORGANIZER.ACCOUNT), {
    method: 'DELETE',
    credentials: 'include',
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw await createApiError(response, 'Не удалось удалить аккаунт');
  }
}
