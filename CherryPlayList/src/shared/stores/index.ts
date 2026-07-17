export { useDemoPlayerStore } from './demoPlayerStore';
export type { PlayerStatus } from './demoPlayerStore';
export { useDragDropStore } from './dragDropStore';
export { useLayoutStore } from './layoutStore';
export type { LayoutPreset } from './layoutStore';
export {
  WORKSPACE_PERSIST_KEY,
  LEGACY_LAYOUT_PERSIST_KEY,
  migratePersistedWorkspaceState,
  createDefaultWorkspacePersistSlice,
  computeIsWorkspaceDirty,
} from './layoutStore';
export type {
  ActiveWorkspace,
  UserWorkspace,
  WorkspacePersistSlice,
  WorkspaceRef,
  BuiltinWorkspaceId,
} from '@core/types/workspacePreset';
export {
  DEFAULT_BUILTIN_PRESET,
  UNNAMED_WORKSPACE_NAME,
  allocateUnnamedWorkspaceName,
  isUnnamedWorkspaceName,
  toBuiltinWorkspaceId,
} from '@core/types/workspacePreset';
export { useAimpStore } from './aimpStore';
export { useSettingsStore } from './settingsStore';
export { useUIStore } from './uiStore';
export type { ModalType, Notification, WorkspaceInfo, TrackSettingsModalContext } from './uiStore';
export { usePlayerAudioStore } from './playerAudioStore';
export type { PlayerAudioStatus } from './playerAudioStore';
export { useAuthStore } from './authStore';
export { useClientOutdatedStore } from './clientOutdatedStore';
export {
  useProjectStore,
  initializeProjectStoreHistory,
  PROJECT_WORKSPACE_ID,
} from './projectStore';

// Global history store for unified undo/redo
export {
  useGlobalHistoryStore,
  createMoveDescription,
  createCopyDescription,
} from './globalHistoryStore';
export type { CompositeAction, CommandPart } from './globalHistoryStore';

// Project store factory for Collections and other workspaces
export {
  ensureProjectStore,
  getProjectStore,
  removeProjectStore,
  getAllProjectStoreIds,
  registerProjectStore,
  useProjectStoreSelector,
  initializeGlobalHistory,
  registerExternalApplyHandler,
} from './projectStoreFactory';
export type { ProjectStoreOptions, ProjectStoreState, ProjectStore } from './projectStoreFactory';

// Shared utility functions for working with ProjectItem
export {
  findItemRecursive,
  getAllTracksRecursive,
  getItemPathRecursive,
  getFlatItemList,
  removeItemFromItems,
  updateTrackInItems,
  updateTrackLoudnessInItems,
  markTrackMissingInItems,
  updateGroupInItems,
  collectAllItemIds,
  findItemWithParent,
  insertItemAtPath,
  removeItemAtPath,
  removeItemsById,
  collectItemsById,
  insertIntoGroup,
} from './projectStoreCore';
export type { ItemPositionInfo, FlatListItem } from './projectStoreCore';
