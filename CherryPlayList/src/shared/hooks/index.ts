export { useTrackDuration } from './useTrackDuration';
export { useTrackItemSize } from './useTrackItemSize';
export {
  useWorkspaceDragAndDrop,
  useTrackWorkspaceDragAndDrop,
  usePlaylistDragAndDrop,
} from './useWorkspaceDragAndDrop';
export type {
  WorkspaceDragDropOptions,
  TrackWorkspaceDragOptions,
  PlaylistDragOptions,
} from './useWorkspaceDragAndDrop';
export { useDragDropExecutor } from './useDragDropExecutor';

// Selection hooks
export { useItemSelection } from './useItemSelection';
export type { UseItemSelectionOptions, UseItemSelectionReturn } from './useItemSelection';
export { useSelectionWithModifiers } from './useSelectionWithModifiers';
export type {
  UseSelectionWithModifiersOptions,
  UseSelectionWithModifiersReturn,
} from './useSelectionWithModifiers';

// Playback preview
export { usePlaybackPreview } from './usePlaybackPreview';
export type { UsePlaybackPreviewOptions, UsePlaybackPreviewReturn } from './usePlaybackPreview';

// Note: Keyboard shortcuts have been moved to @shared/shortcuts module
// Use: import { useShortcuts, useListShortcuts, useGlobalShortcuts } from '@shared/shortcuts';
