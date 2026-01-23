import { v4 as uuidv4 } from 'uuid';
import { createWithEqualityFn } from 'zustand/traditional';

import { WorkspaceId } from '@core/types/workspace';

import { HistoryCommand } from '../commands';
import { logger } from '../utils/logger';

const DEFAULT_HISTORY_DEPTH = 50;

export interface CommandPart {
  workspaceId: WorkspaceId;
  command: HistoryCommand;
}

export interface CompositeAction {
  id: string;
  parts: CommandPart[];
  timestamp: number;
  description?: string;
}

export type ApplyCommandFn = (
  workspaceId: WorkspaceId,
  command: HistoryCommand,
  mode: 'execute' | 'undo',
) => boolean;

export type ErrorHandler = (message: string) => void;

interface GlobalHistoryState {
  history: CompositeAction[];
  historyIndex: number;
  maxDepth: number;
  _applyCommand: ApplyCommandFn | null;
  _onError: ErrorHandler | null;

  registerApplyCommand: (fn: ApplyCommandFn) => void;
  registerErrorHandler: (fn: ErrorHandler) => void;
  pushCompositeCommand: (parts: CommandPart[], description?: string) => void;
  pushCommand: (workspaceId: WorkspaceId, command: HistoryCommand, description?: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  getLastAction: () => CompositeAction | null;
  getNextRedoAction: () => CompositeAction | null;
}

export const useGlobalHistoryStore = createWithEqualityFn<GlobalHistoryState>((set, get) => ({
  history: [],
  historyIndex: -1,
  maxDepth: DEFAULT_HISTORY_DEPTH,
  _applyCommand: null,
  _onError: null,

  registerApplyCommand: (fn) => {
    set({ _applyCommand: fn });
  },

  registerErrorHandler: (fn) => {
    set({ _onError: fn });
  },

  pushCompositeCommand: (parts, description) => {
    if (parts.length === 0) return;

    const compositeAction: CompositeAction = {
      id: uuidv4(),
      parts,
      timestamp: Date.now(),
      description,
    };

    set((state) => {
      const hasFuture = state.historyIndex < state.history.length - 1;
      const baseHistory = hasFuture
        ? state.history.slice(0, state.historyIndex + 1)
        : state.history;
      const updatedHistory = [...baseHistory, compositeAction];

      if (updatedHistory.length > state.maxDepth) {
        return {
          history: updatedHistory.slice(-state.maxDepth),
          historyIndex: state.maxDepth - 1,
        };
      }

      return {
        history: updatedHistory,
        historyIndex: updatedHistory.length - 1,
      };
    });
  },

  pushCommand: (workspaceId, command, description) => {
    get().pushCompositeCommand([{ workspaceId, command }], description);
  },

  undo: () => {
    const state = get();
    if (state.historyIndex < 0) return false;

    const applyCommand = state._applyCommand;
    if (!applyCommand) {
      logger.error('GlobalHistoryStore: applyCommand not registered');
      return false;
    }

    const compositeAction = state.history[state.historyIndex];
    if (!compositeAction) return false;

    const reversedParts = [...compositeAction.parts].reverse();

    for (const part of reversedParts) {
      const success = applyCommand(part.workspaceId, part.command, 'undo');
      if (!success) {
        logger.error('GlobalHistoryStore: failed to undo', {
          workspaceId: part.workspaceId,
          command: part.command.type,
        });
        state._onError?.(`Undo failed: workspace "${part.workspaceId}" is not available`);
        return false;
      }
    }

    set({ historyIndex: state.historyIndex - 1 });
    return true;
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return false;

    const applyCommand = state._applyCommand;
    if (!applyCommand) {
      logger.error('GlobalHistoryStore: applyCommand not registered');
      return false;
    }

    const nextIndex = state.historyIndex + 1;
    const compositeAction = state.history[nextIndex];
    if (!compositeAction) return false;

    for (const part of compositeAction.parts) {
      const success = applyCommand(part.workspaceId, part.command, 'execute');
      if (!success) {
        logger.error('GlobalHistoryStore: failed to redo', {
          workspaceId: part.workspaceId,
          command: part.command.type,
        });
        state._onError?.(`Redo failed: workspace "${part.workspaceId}" is not available`);
        return false;
      }
    }

    set({ historyIndex: nextIndex });
    return true;
  },

  canUndo: () => {
    return get().historyIndex >= 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },

  clearHistory: () => {
    set({ history: [], historyIndex: -1 });
  },

  getLastAction: () => {
    const state = get();
    if (state.historyIndex < 0) return null;
    return state.history[state.historyIndex] || null;
  },

  getNextRedoAction: () => {
    const state = get();
    const nextIndex = state.historyIndex + 1;
    if (nextIndex >= state.history.length) return null;
    return state.history[nextIndex] || null;
  },
}));

export function createMoveDescription(
  sourceWorkspaceId: WorkspaceId,
  targetWorkspaceId: WorkspaceId,
  count: number,
): string {
  return `Move ${count} item(s) from ${sourceWorkspaceId} to ${targetWorkspaceId}`;
}

export function createCopyDescription(
  sourceWorkspaceId: WorkspaceId,
  targetWorkspaceId: WorkspaceId,
  count: number,
): string {
  return `Copy ${count} item(s) from ${sourceWorkspaceId} to ${targetWorkspaceId}`;
}
