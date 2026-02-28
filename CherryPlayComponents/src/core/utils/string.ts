/**
 * Removes only the last file extension from a string (substring after the last '.').
 * Examples: "track.v2.mp3" → "track.v2", "song.mp3" → "song", "noext" → "noext".
 */
export function stripLastExtension(name: string): string {
  if (typeof name !== 'string' || name.length === 0) return name;
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}
