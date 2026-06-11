import { partyService } from '@shared/services/partyService';
import { useAuthStore } from '@shared/stores/authStore';

export function setAuthSessionToken(token: string | null): void {
  useAuthStore.getState().setToken(token);
  partyService.invalidateThemeAccessCache();
}

export function clearAuthSession(): void {
  useAuthStore.getState().clearAuth();
  partyService.invalidateThemeAccessCache();
}
