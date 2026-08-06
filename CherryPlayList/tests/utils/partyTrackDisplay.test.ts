import { DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS } from '../../src/core/types/project';
import {
  applyPartyTrackDisplayToTrackName,
  convertPlaylistForApi,
} from '../../src/shared/utils/partyUtils';

describe('applyPartyTrackDisplayToTrackName', () => {
  test('returns original when disabled', () => {
    expect(
      applyPartyTrackDisplayToTrackName('01_hello', DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS),
    ).toBe('01_hello');
  });

  test('strips leading graphemes when enabled', () => {
    expect(
      applyPartyTrackDisplayToTrackName('01_hello', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsCount: 3,
      }),
    ).toBe('hello');
  });

  test('handles emoji as single grapheme', () => {
    expect(
      applyPartyTrackDisplayToTrackName('🎵track', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsCount: 1,
      }),
    ).toBe('track');
  });

  test('returns original if strip would remove entire string', () => {
    expect(
      applyPartyTrackDisplayToTrackName('ab', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsCount: 10,
      }),
    ).toBe('ab');
  });
});

describe('convertPlaylistForApi + party track display', () => {
  test('sends modified track names when stripping is enabled', () => {
    const items = [
      {
        type: 'track' as const,
        id: 't1',
        path: '/x/a.flac',
        name: '001_my_song',
        duration: 60,
      },
    ];
    const result = convertPlaylistForApi(items, {
      stripLeadingCharsEnabled: true,
      stripLeadingCharsCount: 4,
    });
    const firstItem = result.items[0];
    expect(firstItem).toBeDefined();
    expect(firstItem).toMatchObject({
      type: 'track',
      name: 'my_song',
    });
  });
});
