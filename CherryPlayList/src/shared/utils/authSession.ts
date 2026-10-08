import { partyService } from '@shared/services/partyService';
import { useAuthStore } from '@shared/stores/authStore';

import { isTokenExpired } from './tokenUtils';

export function setAuthSessionToken(token: string | null): void {
  useAuthStore.getState().setToken(token);
  partyService.invalidateThemeAccessCache();
}

export function clearAuthSession(): void {
  useAuthStore.getState().clearAuth();
  partyService.invalidateThemeAccessCache();
}

export function clearExpiredAuthSession(token: string | null): boolean {
  if (!token || !isTokenExpired(token)) {
    return false;
  }

  clearAuthSession();
  return true;
}
