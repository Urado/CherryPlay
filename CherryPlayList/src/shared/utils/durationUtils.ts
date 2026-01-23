import { Track } from '../../core/types/track';

/**
 * Format duration in seconds to "H:MM:SS" format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to "M:SS" format (for track display)
 */
export function formatTrackDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate total duration of tracks
 */
export function calculateTotalDuration(tracks: Track[]): number {
  return tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
}

/**
 * Format duration for player timeline (M:SS, zero-safe)
 */
export function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
