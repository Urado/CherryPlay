import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import type { ThemeAccessDto } from '../types/api';
import { handleApiResponse } from '../utils/apiErrorHandler';

class ThemeAccessService {
  async getMyThemeAccess(): Promise<ThemeAccessDto> {
    const response = await fetch(getApiUrl(API_ENDPOINTS.ORGANIZER.THEME_ACCESS), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
    });

    return handleApiResponse<ThemeAccessDto>(response, 'Ошибка загрузки доступа к темам');
  }
}

export const themeAccessService = new ThemeAccessService();
