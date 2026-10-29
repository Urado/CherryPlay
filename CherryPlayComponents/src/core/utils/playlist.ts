import type { PlayerItem } from '../../types';

export const sortItemsByDisplayOrder = (items: PlayerItem[]): PlayerItem[] => {
  return [...items].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
};

export const getFlatTracksInDisplayOrder = (items: PlayerItem[]): PlayerItem[] => {
  const result: PlayerItem[] = [];
  const sorted = sortItemsByDisplayOrder(items);
  for (const item of sorted) {
    if (item.type === 'track') {
      result.push(item);
    } else if (item.type === 'group' && item.items) {
      result.push(...getFlatTracksInDisplayOrder(item.items));
    }
  }
  return result;
};

export const findTrack = (items: PlayerItem[], trackId: string): PlayerItem | null => {
  for (const item of items) {
    if (item.id === trackId) {
      return item;
    }
    if (item.type === 'group' && item.items) {
      const found = findTrack(item.items, trackId);
      if (found) {
        return found;
      }
    }
  }

  return null;
};
