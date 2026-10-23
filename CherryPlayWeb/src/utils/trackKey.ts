export const normalizeTrackKeyForComparison = (key: string): string => {
  const n = (s: string) => s.normalize('NFC').toLowerCase();
  if (key.startsWith('path:')) {
    const pathPart = key.slice(5).replace(/\//g, '\\');
    return 'path:' + n(pathPart);
  }
  if (key.startsWith('native:')) {
    return 'native:' + n(key.slice(7));
  }
  if (key.startsWith('title-duration:')) {
    return 'title-duration:' + n(key.slice('title-duration:'.length));
  }
  return n(key);
};

interface ItemWithId {
  id: string;
  type: string;
  items?: ItemWithId[];
}

export const resolveCurrentTrackIdFromPlaylist = (
  items: ItemWithId[],
  currentTrackId: string | null,
): string | null => {
  if (!currentTrackId) return null;
  const normalized = normalizeTrackKeyForComparison(currentTrackId);
  for (const item of items) {
    if (normalizeTrackKeyForComparison(item.id) === normalized) {
      return item.id;
    }
    if (item.type === 'group' && item.items?.length) {
      const resolved = resolveCurrentTrackIdFromPlaylist(item.items, currentTrackId);
      if (resolved) return resolved;
    }
  }
  return currentTrackId;
};
