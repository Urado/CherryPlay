import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import type { ThemeAccessDto } from '../types/api';
import { handleApiResponse } from '../utils/apiErrorHandler';
import { apiFetch } from '../utils/apiFetch';

class ThemeAccessService {
  async getMyThemeAccess(): Promise<ThemeAccessDto> {
    const response = await apiFetch(getApiUrl(API_ENDPOINTS.ORGANIZER.THEME_ACCESS), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<ThemeAccessDto>(response, 'Ошибка загрузки доступа к темам');
  }
}

export const themeAccessService = new ThemeAccessService();
