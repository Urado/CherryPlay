import { createWithEqualityFn } from 'zustand/traditional';

import { WorkspaceId, WorkspaceType } from '@core/types/workspace';

import {
  DEFAULT_PLAYLIST_WORKSPACE_ID,
  registerWorkspaceType,
  unregisterWorkspaceType,
} from '../../core/constants/workspace';
import { getActiveLayoutSnapshotForFocus } from '../utils/layoutFocusBridge';
import { resolveFileBrowserFocusTarget } from '../utils/resolveFileBrowserFocusTarget';

const notificationTimers = new Map<string, NodeJS.Timeout>();

export type ModalType = 'settings' | 'export' | 'trackSettings' | 'account' | 'linkParty' | null;

export interface TrackSettingsModalContext {
  trackId: string | null;
  groupId: string | null;
  isGlobal: boolean;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  action?: { label: string; onAction: () => void };
}

export interface WorkspaceInfo {
  id: WorkspaceId;
  type: WorkspaceType;
  name: string;
  zoneId?: string;
}

const DEFAULT_WORKSPACES: WorkspaceInfo[] = [
  {
    id: DEFAULT_PLAYLIST_WORKSPACE_ID,
    type: 'playlist',
    name: 'Main Playlist',
  },
];

DEFAULT_WORKSPACES.forEach((workspace) => {
  registerWorkspaceType(workspace.id, workspace.type);
});

interface UIState {
  activeSource: 'fileBrowser' | 'playlists' | 'db';
  modal: ModalType;
  trackSettingsContext: TrackSettingsModalContext;
  notifications: Notification[];
  fileBrowserFocusRequest: {
    path: string;
    targetWorkspaceId: WorkspaceId;
    timestamp: number;
  } | null;

  workspaces: WorkspaceInfo[];
  activeWorkspaceId: WorkspaceId | null;

  setActiveSource: (source: 'fileBrowser' | 'playlists' | 'db') => void;
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  openTrackSettingsModal: (context: TrackSettingsModalContext) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;

  addWorkspace: (workspace: WorkspaceInfo) => void;
  removeWorkspace: (id: WorkspaceId) => void;
  setActiveWorkspace: (id: WorkspaceId | null) => void;
  getWorkspace: (id: WorkspaceId) => WorkspaceInfo | undefined;
  getWorkspaceByZoneId: (zoneId: string) => WorkspaceInfo | undefined;
  setWorkspaceZoneId: (workspaceId: WorkspaceId, zoneId: string) => void;

  focusFileInBrowser: (path: string, targetWorkspaceId?: WorkspaceId) => void;
  acknowledgeFileBrowserFocus: () => void;
}

export const useUIStore = createWithEqualityFn<UIState>((set, get) => ({
  activeSource: 'fileBrowser',
  modal: null,
  trackSettingsContext: { trackId: null, groupId: null, isGlobal: false },
  notifications: [],
  fileBrowserFocusRequest: null,

  workspaces: [...DEFAULT_WORKSPACES],
  activeWorkspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,

  setActiveSource: (source) => set({ activeSource: source }),

  openModal: (type) => set({ modal: type }),

  closeModal: () =>
    set({ modal: null, trackSettingsContext: { trackId: null, groupId: null, isGlobal: false } }),

  openTrackSettingsModal: (context) =>
    set({ modal: 'trackSettings', trackSettingsContext: context }),

  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration || 3000,
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    if (newNotification.duration && newNotification.duration > 0) {
      const timeoutId = setTimeout(() => {
        notificationTimers.delete(id);
        set((state) => {
          if (state.notifications.some((n) => n.id === id)) {
            return {
              notifications: state.notifications.filter((n) => n.id !== id),
            };
          }
          return state;
        });
      }, newNotification.duration);
      notificationTimers.set(id, timeoutId);
    }
  },

  removeNotification: (id) => {
    const timeoutId = notificationTimers.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      notificationTimers.delete(id);
    }
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  addWorkspace: (workspace) => {
    const state = get();
    if (state.workspaces.some((w) => w.id === workspace.id)) {
      return;
    }
    registerWorkspaceType(workspace.id, workspace.type);
    set({
      workspaces: [...state.workspaces, workspace],
    });
  },

  removeWorkspace: (id) => {
    const state = get();
    unregisterWorkspaceType(id);
    set({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
    });
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  getWorkspace: (id) => {
    const state = get();
    return state.workspaces.find((w) => w.id === id);
  },

  getWorkspaceByZoneId: (zoneId) => {
    const state = get();
    return state.workspaces.find((w) => w.zoneId === zoneId);
  },

  setWorkspaceZoneId: (workspaceId, zoneId) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === workspaceId ? { ...w, zoneId } : w)),
    }));
  },

  focusFileInBrowser: (path, targetWorkspaceId) => {
    if (!path) {
      return;
    }
    const layout = getActiveLayoutSnapshotForFocus();
    if (!layout) {
      return;
    }
    const resolvedTarget = resolveFileBrowserFocusTarget(layout, {
      path,
      targetWorkspaceId,
    });
    if (!resolvedTarget) {
      return;
    }
    set({
      activeSource: 'fileBrowser',
      fileBrowserFocusRequest: {
        path,
        targetWorkspaceId: resolvedTarget,
        timestamp: Date.now(),
      },
    });
  },

  acknowledgeFileBrowserFocus: () => set({ fileBrowserFocusRequest: null }),
}));
