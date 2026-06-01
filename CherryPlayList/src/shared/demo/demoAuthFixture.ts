import type { OrganizerDto } from '@cherryplay/components';

import { useAuthStore } from '../stores/authStore';
import { setAuthSessionToken } from '../utils/authSession';

/** Stable fake JWT-like token for demo (not validated by server). */
export const DEMO_ACCESS_TOKEN = 'demo.cherryplaylist.access-token';

const DEMO_ORGANIZER_ID = '00000000-0000-4000-8000-000000000001';

export const DEMO_ORGANIZER_DTO: OrganizerDto = {
  id: DEMO_ORGANIZER_ID,
  name: 'Demo Organizer',
  logoUrl: null,
  links: { website: 'https://example.com/demo' },
  defaultPartyThemeId: 'cyberpunk',
  defaultCustomizationSettings: null,
  timeZone: 'Europe/Moscow',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

export function getDemoOrganizerDto(): OrganizerDto {
  return { ...DEMO_ORGANIZER_DTO };
}

/** Sets in-memory auth session for web demo (no HTTP). */
export function applyDemoAuthSession(): void {
  setAuthSessionToken(DEMO_ACCESS_TOKEN);
  useAuthStore.getState().setOrganizer({
    id: DEMO_ORGANIZER_DTO.id,
    name: DEMO_ORGANIZER_DTO.name,
  });
}
