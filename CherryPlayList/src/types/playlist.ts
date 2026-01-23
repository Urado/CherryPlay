/**
 * Playlist data structure for JSON serialization
 */
export interface PlaylistData {
  name: string;
  tracks: Array<{
    path: string;
    name: string;
    duration?: number;
  }>;
}

/**
 * Playlist file format (what gets saved to disk)
 */
export interface PlaylistFile {
  name: string;
  tracks: Array<{
    path: string;
    name: string;
    duration?: number;
  }>;
}
