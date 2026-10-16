import type { PartyPlaylistData } from '@cherryplay/components';

import type { PartyPlaylistDto, PlayerItemDto } from '../types/api';

const normalizePlaylistItems = (items: PlayerItemDto[]): PlayerItemDto[] => {
  const sorted = [...items].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return sorted.map((item) => {
    if (item.type === 'group' && item.items) {
      return {
        ...item,
        items: normalizePlaylistItems(item.items),
      };
    }
    return item;
  });
};

export const playlistDataFromDto = (dto: PartyPlaylistDto): PartyPlaylistData => {
  return {
    items: normalizePlaylistItems(dto.items),
    totalDuration: dto.totalDuration,
    totalTracks: dto.totalTracks,
  };
};
