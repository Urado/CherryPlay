import { DEFAULT_PARTY_THEME_ID } from '@cherryplay/components';

import type { LinkedParty } from '@core/types/project';

import type {
  CreatePartyDto,
  PartyDto,
  PartyLifecycleState,
  PartyStateDto,
  ThemeAccessDto,
  UpdatePartyDto,
} from '../services/partyService';

export const DEMO_PARTY_ID = '00000000-0000-4000-8000-000000000099';
export const DEMO_PARTY_SHORT_CODE = 'DEMODK';

export const DEMO_LINKED_PARTY: LinkedParty = {
  id: DEMO_PARTY_ID,
  shortCode: DEMO_PARTY_SHORT_CODE,
};

const nowIso = '2025-06-01T12:00:00.000Z';

let demoPartySnapshot: PartyDto = buildDemoParty({
  name: 'Demo Party',
  title: 'Веб-демо вечеринка',
});

function buildDemoParty(overrides: Partial<PartyDto> & Pick<PartyDto, 'name'>): PartyDto {
  return {
    id: DEMO_PARTY_ID,
    name: overrides.name,
    title: overrides.title ?? overrides.name,
    subtitle: overrides.subtitle,
    shortCode: DEMO_PARTY_SHORT_CODE,
    partyThemeId: overrides.partyThemeId ?? DEFAULT_PARTY_THEME_ID,
    customizationSettings: overrides.customizationSettings ?? {},
    createdAt: overrides.createdAt ?? nowIso,
    hasActiveSession: false,
    partyLifecycleState: overrides.partyLifecycleState ?? 'draft',
    eventDateTime: overrides.eventDateTime,
    eventEndDateTime: overrides.eventEndDateTime,
    description: overrides.description ?? 'Фейковая вечеринка для веб-демо (без CherryPlayServer).',
    place: overrides.place,
    city: overrides.city,
    schedule: overrides.schedule,
    timeZone: overrides.timeZone ?? 'Europe/Moscow',
    shortDescription: overrides.shortDescription,
    externalLinkUrl: overrides.externalLinkUrl,
    externalLinkText: overrides.externalLinkText,
    danceTags: overrides.danceTags,
  };
}

export function getDemoPartySnapshot(): PartyDto {
  return { ...demoPartySnapshot };
}

export function demoCreateParty(data: CreatePartyDto): PartyDto {
  demoPartySnapshot = buildDemoParty({
    name: data.name,
    title: data.title,
    subtitle: data.subtitle,
    partyThemeId: data.partyThemeId,
    customizationSettings: data.customizationSettings as PartyDto['customizationSettings'],
    partyLifecycleState: 'draft',
    description: data.description,
    place: data.place,
    city: data.city,
    schedule: data.schedule,
    timeZone: data.timeZone,
    shortDescription: data.shortDescription,
    externalLinkUrl: data.externalLinkUrl,
    externalLinkText: data.externalLinkText,
    danceTags: data.danceTags,
  });
  return getDemoPartySnapshot();
}

export function demoUpdateParty(partyId: string, data: UpdatePartyDto): void {
  if (partyId !== DEMO_PARTY_ID) {
    return;
  }
  demoPartySnapshot = buildDemoParty({
    name: data.name ?? demoPartySnapshot.name,
    title: data.title ?? demoPartySnapshot.title,
    subtitle: data.subtitle ?? demoPartySnapshot.subtitle,
    partyThemeId: data.partyThemeId ?? demoPartySnapshot.partyThemeId,
    customizationSettings:
      (data.customizationSettings as PartyDto['customizationSettings']) ??
      demoPartySnapshot.customizationSettings,
    partyLifecycleState: demoPartySnapshot.partyLifecycleState,
    description: data.description ?? demoPartySnapshot.description,
    place: data.place ?? demoPartySnapshot.place,
    city: data.city ?? demoPartySnapshot.city,
    schedule: data.schedule ?? demoPartySnapshot.schedule,
    timeZone: data.timeZone ?? demoPartySnapshot.timeZone,
    shortDescription: data.shortDescription ?? demoPartySnapshot.shortDescription,
    externalLinkUrl: data.externalLinkUrl ?? demoPartySnapshot.externalLinkUrl,
    externalLinkText: data.externalLinkText ?? demoPartySnapshot.externalLinkText,
    danceTags: data.danceTags ?? demoPartySnapshot.danceTags,
  });
}

export function demoTransitionPartyLifecycle(targetState: PartyLifecycleState): PartyDto {
  demoPartySnapshot = {
    ...demoPartySnapshot,
    partyLifecycleState: targetState,
  };
  return getDemoPartySnapshot();
}

export const DEMO_THEME_ACCESS: ThemeAccessDto = {
  grantedThemeIds: [DEFAULT_PARTY_THEME_ID, 'cyberpunk', 'retro'],
  visibleLockedThemes: [],
  contactUrl: 'https://example.com/demo/themes',
};

export function getDemoPartyState(): PartyStateDto {
  return {
    partyId: DEMO_PARTY_ID,
    isSessionActive: false,
    playlist: { items: [], totalDuration: 0, totalTracks: 0 },
    serverTrackIds: [],
  };
}

export function getDemoPartyPublicUrl(shortCode: string): string {
  return `https://demo.cherryplay.local/party/${shortCode}`;
}
