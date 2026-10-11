export const PARTY_TRACK_DELIMITER_PRESET_SPACE = 'space';
export const PARTY_TRACK_DELIMITER_PRESET_HYPHEN = 'hyphen';
export const PARTY_TRACK_DELIMITER_PRESET_UNDERSCORE = 'underscore';
export const PARTY_TRACK_DELIMITER_PRESET_CUSTOM = 'custom';

export type PartyTrackDelimiterPresetId =
  | typeof PARTY_TRACK_DELIMITER_PRESET_SPACE
  | typeof PARTY_TRACK_DELIMITER_PRESET_HYPHEN
  | typeof PARTY_TRACK_DELIMITER_PRESET_UNDERSCORE
  | typeof PARTY_TRACK_DELIMITER_PRESET_CUSTOM;

export const PARTY_TRACK_DELIMITER_PRESETS: ReadonlyArray<{
  id: Exclude<PartyTrackDelimiterPresetId, typeof PARTY_TRACK_DELIMITER_PRESET_CUSTOM>;
  label: string;
  char: string;
}> = [
  { id: PARTY_TRACK_DELIMITER_PRESET_SPACE, label: 'Пробел', char: ' ' },
  { id: PARTY_TRACK_DELIMITER_PRESET_HYPHEN, label: 'Дефис', char: '-' },
  { id: PARTY_TRACK_DELIMITER_PRESET_UNDERSCORE, label: 'Подчёркивание', char: '_' },
];

export function resolvePartyTrackDelimiterPresetId(
  delimiter: string,
): PartyTrackDelimiterPresetId {
  const match = PARTY_TRACK_DELIMITER_PRESETS.find((preset) => preset.char === delimiter);
  return match?.id ?? PARTY_TRACK_DELIMITER_PRESET_CUSTOM;
}

export function partyTrackDelimiterCharFromPreset(
  presetId: PartyTrackDelimiterPresetId,
): string | null {
  if (presetId === PARTY_TRACK_DELIMITER_PRESET_CUSTOM) {
    return null;
  }
  return PARTY_TRACK_DELIMITER_PRESETS.find((preset) => preset.id === presetId)?.char ?? null;
}
