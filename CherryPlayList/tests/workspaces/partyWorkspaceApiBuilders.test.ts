jest.mock('@cherryplay/components', () => ({
  convertLocalDateTimeToUtc: (value: string, tz: string) => `utc:${value}@${tz}`,
  getDefaultTimeZone: () => 'Europe/Moscow',
  getDefaultCustomizationSettings: () => ({}),
  DEFAULT_PARTY_THEME_ID: 'basic',
}));

jest.mock('../../src/workspaces/party/partyWorkspaceUtils', () => ({
  normalizeCustomizationSettings: (settings: Record<string, unknown> | undefined) => settings,
}));

import {
  buildCreatePartyDto,
  buildUpdatePartyDto,
} from '../../src/workspaces/party/partyWorkspaceApiBuilders';

const emptyPlaylist = { items: [], totalDuration: 0, totalTracks: 0 };

function buildStoreSlice(overrides: Record<string, unknown> = {}) {
  return {
    partyName: 'Test Party',
    partyTitle: 'Title',
    partySubtitle: 'Subtitle',
    themeId: 'cyberpunk' as const,
    customizationSettings: { accent: 'red' },
    eventDateTime: '2025-07-01T20:00',
    eventEndDateTime: '',
    hasInitialEventEndDateTime: false,
    eventEndDateTimeTouched: false,
    description: 'Desc',
    place: 'Place',
    city: 'City',
    schedule: 'Schedule',
    timeZone: 'Europe/Moscow',
    shortDescription: 'Short',
    externalLinkUrl: 'https://example.com',
    externalLinkText: 'Link',
    danceTags: ['salsa'],
    isListedInCatalog: true,
    ...overrides,
  };
}

describe('buildUpdatePartyDto', () => {
  it('omits eventEndDateTime when end date was not touched', () => {
    const dto = buildUpdatePartyDto(
      buildStoreSlice({
        eventEndDateTime: '2025-07-01T23:00',
        eventEndDateTimeTouched: false,
      }),
    );

    expect(dto.eventEndDateTime).toBeUndefined();
  });

  it('sends null when cleared end date had an initial server value', () => {
    const dto = buildUpdatePartyDto(
      buildStoreSlice({
        eventEndDateTime: '',
        eventEndDateTimeTouched: true,
        hasInitialEventEndDateTime: true,
      }),
    );

    expect(dto.eventEndDateTime).toBeNull();
  });

  it('omits eventEndDateTime when cleared and there was no initial value', () => {
    const dto = buildUpdatePartyDto(
      buildStoreSlice({
        eventEndDateTime: '',
        eventEndDateTimeTouched: true,
        hasInitialEventEndDateTime: false,
      }),
    );

    expect(dto.eventEndDateTime).toBeUndefined();
  });

  it('converts touched end date to UTC using party time zone', () => {
    const dto = buildUpdatePartyDto(
      buildStoreSlice({
        eventEndDateTime: '2025-07-01T23:00',
        eventEndDateTimeTouched: true,
        timeZone: 'Europe/Moscow',
      }),
    );

    expect(dto.eventEndDateTime).toBe('utc:2025-07-01T23:00@Europe/Moscow');
  });

  it('maps core metadata fields for update', () => {
    const dto = buildUpdatePartyDto(buildStoreSlice());

    expect(dto).toMatchObject({
      name: 'Test Party',
      title: 'Title',
      subtitle: 'Subtitle',
      partyThemeId: 'cyberpunk',
      shortDescription: 'Short',
      externalLinkUrl: 'https://example.com',
      externalLinkText: 'Link',
      danceTags: ['salsa'],
    });
  });
});

describe('buildCreatePartyDto', () => {
  it('includes playlist and converts event end date when set', () => {
    const dto = buildCreatePartyDto(
      buildStoreSlice({ eventEndDateTime: '2025-07-01T23:00' }),
      emptyPlaylist,
    );

    expect(dto.playlistData).toBe(emptyPlaylist);
    expect(dto.eventEndDateTime).toBe('utc:2025-07-01T23:00@Europe/Moscow');
    expect(dto.isListedInCatalog).toBe(true);
  });

  it('uses optional partyName override', () => {
    const dto = buildCreatePartyDto(buildStoreSlice(), emptyPlaylist, { partyName: 'Override' });

    expect(dto.name).toBe('Override');
  });
});
