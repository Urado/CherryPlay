import type { PlayerItem } from '../../types';

export function sortItemsByDisplayOrder(items: PlayerItem[]): PlayerItem[] {
  return [...items].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

/**
 * Returns a flat array of tracks in display order (depth-first, siblings sorted by displayOrder).
 * Groups are recursed into; only items with type === 'track' are included.
 */
export function getFlatTracksInDisplayOrder(items: PlayerItem[]): PlayerItem[] {
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
}

export function findTrack(items: PlayerItem[], trackId: string): PlayerItem | null {
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
}
