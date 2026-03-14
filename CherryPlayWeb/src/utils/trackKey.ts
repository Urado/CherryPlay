/**
 * Normalize a track key for comparison (case-insensitive, consistent path separators, NFC).
 * Used so playback currentTrackId from SignalR can match playlist item ids regardless of casing.
 */
export function normalizeTrackKeyForComparison(key: string): string {
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
}

interface ItemWithId {
  id: string;
  type: string;
  items?: ItemWithId[];
}

/**
 * Resolve currentTrackId to the exact id of a playlist item so findTrack() matches.
 * When server/desktop send currentTrackId in different casing than playlist item ids, the block "сейчас" won't show.
 */
export function resolveCurrentTrackIdFromPlaylist(
  items: ItemWithId[],
  currentTrackId: string | null,
): string | null {
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
}
