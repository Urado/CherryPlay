import {
  DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  DEFAULT_PARTY_TRACK_STRIP_DELIMITER,
} from '../../src/core/types/project';
import {
  applyPartyTrackDisplayToTrackName,
  normalizePartyTrackDisplaySettings,
} from '../../src/shared/utils/partyUtils';

describe('normalizePartyTrackDisplaySettings', () => {
  test('defaults missing mode and delimiter for legacy settings', () => {
    expect(
      normalizePartyTrackDisplaySettings({
        stripLeadingCharsEnabled: true,
        stripLeadingCharsCount: 2,
      } as typeof DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS),
    ).toEqual({
      stripLeadingCharsEnabled: true,
      stripLeadingCharsMode: 'count',
      stripLeadingCharsCount: 2,
      stripLeadingCharsDelimiter: DEFAULT_PARTY_TRACK_STRIP_DELIMITER,
    });
  });

  test('truncates delimiter to single character', () => {
    expect(
      normalizePartyTrackDisplaySettings({
        ...DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
        stripLeadingCharsMode: 'untilDelimiter',
        stripLeadingCharsDelimiter: '---',
      }).stripLeadingCharsDelimiter,
    ).toBe('-');
  });
});

describe('applyPartyTrackDisplayToTrackName untilDelimiter mode', () => {
  test('strips prefix through first delimiter', () => {
    expect(
      applyPartyTrackDisplayToTrackName('01 — Название', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsMode: 'untilDelimiter',
        stripLeadingCharsCount: 0,
        stripLeadingCharsDelimiter: ' ',
      }),
    ).toBe('— Название');
  });

  test('uses custom delimiter such as hyphen', () => {
    expect(
      applyPartyTrackDisplayToTrackName('001-my_song', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsMode: 'untilDelimiter',
        stripLeadingCharsCount: 0,
        stripLeadingCharsDelimiter: '-',
      }),
    ).toBe('my_song');
  });

  test('returns original when delimiter is absent', () => {
    expect(
      applyPartyTrackDisplayToTrackName('no_delimiter_here', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsMode: 'untilDelimiter',
        stripLeadingCharsCount: 0,
        stripLeadingCharsDelimiter: '-',
      }),
    ).toBe('no_delimiter_here');
  });

  test('returns original when strip would remove entire string', () => {
    expect(
      applyPartyTrackDisplayToTrackName('-', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsMode: 'untilDelimiter',
        stripLeadingCharsCount: 0,
        stripLeadingCharsDelimiter: '-',
      }),
    ).toBe('-');
  });

  test('strips when delimiter is at start of name', () => {
    expect(
      applyPartyTrackDisplayToTrackName('-song', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsMode: 'untilDelimiter',
        stripLeadingCharsCount: 0,
        stripLeadingCharsDelimiter: '-',
      }),
    ).toBe('song');
  });

  test('strips leading segment when delimiter is first character', () => {
    expect(
      applyPartyTrackDisplayToTrackName(' title', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsMode: 'untilDelimiter',
        stripLeadingCharsCount: 0,
        stripLeadingCharsDelimiter: ' ',
      }),
    ).toBe('title');
  });
});

describe('applyPartyTrackDisplayToTrackName count mode backward compatibility', () => {
  test('still strips grapheme count when mode omitted in legacy object', () => {
    expect(
      applyPartyTrackDisplayToTrackName('01_hello', {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsCount: 3,
      } as typeof DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS),
    ).toBe('hello');
  });
});
