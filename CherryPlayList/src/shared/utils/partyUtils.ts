import { PlayerItem as ComponentPlayerItem } from '@cherryplay/components/types';
import {
  DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  type PartyTrackDisplaySettings,
  ProjectItem,
  isProjectGroup,
  isProjectTrack,
} from '@core/types/project';

export interface PlayerItemForApi {
  id: string;
  type: 'track' | 'group';
  name: string;
  duration?: number;
  items?: PlayerItemForApi[];
  displayOrder: number;
  level: number;
}

export const normalizePartyTrackDisplaySettings = (
  settings: PartyTrackDisplaySettings,
): PartyTrackDisplaySettings => {
  const mode = settings.stripLeadingCharsMode === 'untilDelimiter' ? 'untilDelimiter' : 'count';
  const delimiterRaw = settings.stripLeadingCharsDelimiter;
  const delimiter =
    typeof delimiterRaw === 'string' && delimiterRaw.length > 0
      ? delimiterRaw.slice(0, 1)
      : DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS.stripLeadingCharsDelimiter;
  const count =
    Number.isFinite(settings.stripLeadingCharsCount) && settings.stripLeadingCharsCount > 0
      ? Math.max(0, Math.floor(settings.stripLeadingCharsCount))
      : 0;

  return {
    stripLeadingCharsEnabled: Boolean(settings.stripLeadingCharsEnabled),
    stripLeadingCharsMode: mode,
    stripLeadingCharsCount: count,
    stripLeadingCharsDelimiter: delimiter,
  };
};

export const applyPartyTrackDisplayToTrackName = (
  name: string,
  settings: PartyTrackDisplaySettings = DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
): string => {
  const normalized = normalizePartyTrackDisplaySettings(settings);
  if (!normalized.stripLeadingCharsEnabled) {
    return name;
  }

  if (normalized.stripLeadingCharsMode === 'untilDelimiter') {
    const delimiter = normalized.stripLeadingCharsDelimiter;
    const index = name.indexOf(delimiter);
    if (index === -1) {
      return name;
    }
    const rest = name.slice(index + delimiter.length);
    return rest.length > 0 ? rest : name;
  }

  if (normalized.stripLeadingCharsCount <= 0) {
    return name;
  }
  const chars = [...name];
  const n = Math.min(normalized.stripLeadingCharsCount, chars.length);
  const rest = chars.slice(n).join('');
  return rest.length > 0 ? rest : name;
};

export const applyPartyTrackDisplayToComponentPlaylist = (
  items: ComponentPlayerItem[],
  settings: PartyTrackDisplaySettings = DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
): ComponentPlayerItem[] => {
  return items.map((item) => {
    if (item.type === 'group') {
      const nested = item.items ?? [];
      return {
        ...item,
        items: applyPartyTrackDisplayToComponentPlaylist(nested, settings),
      };
    }
    return {
      ...item,
      name: applyPartyTrackDisplayToTrackName(item.name, settings),
    };
  });
};

export const convertToComponentPlayerItem = (
  item: ProjectItem,
  displayOrder: number = 0,
  level: number = 0,
): ComponentPlayerItem => {
  if (isProjectGroup(item)) {
    return {
      id: item.id,
      type: 'group',
      name: item.name || 'Группа',
      items: item.items.map((childItem, index) =>
        convertToComponentPlayerItem(childItem, index, level + 1),
      ),
      displayOrder,
      level,
    };
  } else {
    return {
      id: item.id,
      type: 'track',
      name: item.name,
      duration: item.duration,
      displayOrder,
      level,
    };
  }
};

export const convertToComponentPlayerItems = (items: ProjectItem[]): ComponentPlayerItem[] => {
  return items.map((item, index) => convertToComponentPlayerItem(item, index, 0));
};

export const calculateTotalDuration = (items: ProjectItem[]): number => {
  let total = 0;
  for (const item of items) {
    if (isProjectTrack(item)) {
      total += item.duration || 0;
    } else if (isProjectGroup(item)) {
      total += calculateTotalDuration(item.items);
    }
  }
  return total;
};

export const countTotalTracks = (items: ProjectItem[]): number => {
  let count = 0;
  for (const item of items) {
    if (isProjectTrack(item)) {
      count++;
    } else if (isProjectGroup(item)) {
      count += countTotalTracks(item.items);
    }
  }
  return count;
};

export const collectComponentPlaylistTrackIds = (items: ComponentPlayerItem[]): string[] => {
  const ids: string[] = [];
  for (const item of items) {
    if (item.type === 'track') {
      ids.push(item.id);
      continue;
    }
    if (item.type === 'group' && item.items) {
      ids.push(...collectComponentPlaylistTrackIds(item.items));
    }
  }
  return ids;
};

export const convertToApiPlayerItem = (
  item: ProjectItem,
  displayOrder: number = 0,
  level: number = 0,
  trackDisplay?: PartyTrackDisplaySettings,
): PlayerItemForApi => {
  if (isProjectGroup(item)) {
    return {
      id: item.id,
      type: 'group',
      name: item.name || 'Группа',
      items: item.items.map((childItem, index) =>
        convertToApiPlayerItem(childItem, index, level + 1, trackDisplay),
      ),
      displayOrder,
      level,
    };
  } else {
    const rawName = item.name;
    const name =
      trackDisplay !== undefined
        ? applyPartyTrackDisplayToTrackName(rawName, trackDisplay)
        : rawName;
    return {
      id: item.id,
      type: 'track',
      name,
      duration: item.duration,
      displayOrder,
      level,
    };
  }
};

export const convertToApiPlayerItems = (
  items: ProjectItem[],
  trackDisplay?: PartyTrackDisplaySettings,
): PlayerItemForApi[] => {
  return items.map((item, index) => convertToApiPlayerItem(item, index, 0, trackDisplay));
};

export const calculatePlaylistMetadata = (
  items: ProjectItem[],
): {
  totalTracks: number;
  totalDuration: number;
} => {
  return {
    totalTracks: countTotalTracks(items),
    totalDuration: calculateTotalDuration(items),
  };
};

export const convertPlaylistForApi = (
  items: ProjectItem[],
  trackDisplay?: PartyTrackDisplaySettings,
): {
  items: PlayerItemForApi[];
  totalTracks: number;
  totalDuration: number;
} => {
  const apiItems = convertToApiPlayerItems(items, trackDisplay);
  const metadata = calculatePlaylistMetadata(items);

  return {
    items: apiItems,
    totalTracks: metadata.totalTracks,
    totalDuration: metadata.totalDuration,
  };
};
