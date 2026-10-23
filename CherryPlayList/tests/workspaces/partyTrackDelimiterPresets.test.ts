import {
  PARTY_TRACK_DELIMITER_PRESET_CUSTOM,
  PARTY_TRACK_DELIMITER_PRESET_HYPHEN,
  PARTY_TRACK_DELIMITER_PRESET_SPACE,
  partyTrackDelimiterCharFromPreset,
  resolvePartyTrackDelimiterPresetId,
} from '../../src/workspaces/party/components/partyTrackDelimiterPresets';

describe('partyTrackDelimiterPresets', () => {
  test('maps known delimiter characters to presets', () => {
    expect(resolvePartyTrackDelimiterPresetId(' ')).toBe(PARTY_TRACK_DELIMITER_PRESET_SPACE);
    expect(resolvePartyTrackDelimiterPresetId('-')).toBe(PARTY_TRACK_DELIMITER_PRESET_HYPHEN);
    expect(resolvePartyTrackDelimiterPresetId('|')).toBe(PARTY_TRACK_DELIMITER_PRESET_CUSTOM);
  });

  test('returns preset characters', () => {
    expect(partyTrackDelimiterCharFromPreset(PARTY_TRACK_DELIMITER_PRESET_SPACE)).toBe(' ');
    expect(partyTrackDelimiterCharFromPreset(PARTY_TRACK_DELIMITER_PRESET_CUSTOM)).toBeNull();
  });
});
