export type { WorkspaceId, WorkspaceType } from '@core/types/workspace';
import type { WorkspaceId } from '@core/types/workspace';

export interface ItemDragState {
  type: 'items';
  rootIds: string[];
  allFlatIndices: Set<number>;
  sourceWorkspaceId: WorkspaceId;
  isCopyMode?: boolean;
}

export interface FileDragState {
  type: 'files';
  paths: string[];
  directories: string[];
}

export type DraggedItems = ItemDragState | FileDragState | null;

export type InsertPosition = 'top' | 'bottom';

export interface HierarchyPosition {
  parentId: string | null;
  localIndex: number;
}

export interface DragDropCommand {
  type: 'move' | 'copy';
  itemIds: string[];
  sourceWorkspaceId: WorkspaceId;
  targetWorkspaceId: WorkspaceId;
  targetParentId: string | null;
  targetIndex: number;
}

export interface DragDropResult {
  success: boolean;
  command?: DragDropCommand;
  error?: string;
}
