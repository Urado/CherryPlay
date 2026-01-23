import type { PlayerItem } from '../../types';

export function sortItemsByDisplayOrder(items: PlayerItem[]): PlayerItem[] {
  return [...items].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
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


