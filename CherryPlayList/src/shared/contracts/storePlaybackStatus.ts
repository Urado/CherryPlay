/** Store-facing playback status mirrored from engine status (1:1 mapping). */
export type StorePlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';
