import type { Track, TrackLoudness } from './track';

export type ActionAfterTrack = 'next' | 'pauseAndNext' | 'pause';

export type ProjectSessionMode = 'preparation' | 'session';

export interface ProjectGroup {
  id: string;
  name: string;
  items: ProjectItem[];
}

export type ProjectItem = Track | ProjectGroup;

export function isProjectGroup(item: ProjectItem): item is ProjectGroup {
  return 'items' in item;
}

export function isProjectTrack(item: ProjectItem): item is Track {
  return !isProjectGroup(item);
}

export interface ProjectTrackSettings {
  pauseBetweenTracks?: number | null;
  actionAfterTrack?: ActionAfterTrack | null;
}

export interface ProjectGroupSettings {
  pauseBetweenTracks?: number | null;
  actionAfterTrack?: ActionAfterTrack | null;
}

export interface ProjectSettings {
  defaultPauseBetweenTracks: number;
  defaultActionAfterTrack: ActionAfterTrack;
  plannedEndTime: number | null;
  portableMode: boolean;
}

export interface ProjectSessionState {
  mode: ProjectSessionMode;
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  currentTrackId: string | null;
  sessionStartTime: number | null;
}

export interface LinkedParty {
  id: string;
  shortCode: string;
  url?: string;
}

export type PartyTrackStripLeadingMode = 'count' | 'untilDelimiter';

export interface PartyTrackDisplaySettings {
  stripLeadingCharsEnabled: boolean;
  stripLeadingCharsMode: PartyTrackStripLeadingMode;
  stripLeadingCharsCount: number;
  stripLeadingCharsDelimiter: string;
}

export const DEFAULT_PARTY_TRACK_STRIP_DELIMITER = ' ';

export const DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS: PartyTrackDisplaySettings = {
  stripLeadingCharsEnabled: false,
  stripLeadingCharsMode: 'count',
  stripLeadingCharsCount: 0,
  stripLeadingCharsDelimiter: DEFAULT_PARTY_TRACK_STRIP_DELIMITER,
};

export interface ProjectMeta {
  filePath: string | null;
  isDirty: boolean;
  lastSavedAt: number | null;
  linkedParty: LinkedParty | null;
  partyTrackDisplay: PartyTrackDisplaySettings;
  partyThemeId?: string;
  partyCustomizationSettings?: Record<string, unknown>;
}

export interface SavedProjectTrack {
  type: 'track';
  id: string;
  path: string;
  name: string;
  duration?: number;
  loudness?: TrackLoudness;
}

export interface SavedProjectGroup {
  type: 'group';
  id: string;
  name: string;
  items: string[];
}

export type SavedProjectItem = SavedProjectTrack | SavedProjectGroup;

export interface ProjectFile {
  version: '2.0';
  name: string;
  items: SavedProjectItem[];
  rootItems: string[];
  settings: ProjectSettings;
  trackSettings: Record<string, ProjectTrackSettings>;
  groupSettings: Record<string, ProjectGroupSettings>;
  sessionState?: ProjectSessionState;
  linkedParty?: Pick<LinkedParty, 'id' | 'shortCode'>;
  partyTrackDisplay?: PartyTrackDisplaySettings;
  partyThemeId?: string;
  partyCustomizationSettings?: Record<string, unknown>;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  defaultPauseBetweenTracks: 0,
  defaultActionAfterTrack: 'next',
  plannedEndTime: null,
  portableMode: false,
};

export const DEFAULT_SESSION_STATE: ProjectSessionState = {
  mode: 'preparation',
  playedTrackIds: [],
  disabledTrackIds: [],
  disabledGroupIds: [],
  currentTrackId: null,
  sessionStartTime: null,
};

export const DEFAULT_PROJECT_META: ProjectMeta = {
  filePath: null,
  isDirty: false,
  lastSavedAt: null,
  linkedParty: null,
  partyTrackDisplay: { ...DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS },
};
