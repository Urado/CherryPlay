import { useDragDropStore } from '../../src/shared/stores/dragDropStore';
import {
  ensureProjectStore,
  removeProjectStore,
} from '../../src/shared/stores/projectStoreFactory';

type TestTrack = {
  id: string;
  type: 'track';
  path: string;
  name: string;
  duration?: number;
};

const createTrack = (id: string, name: string): TestTrack => ({
  id,
  type: 'track',
  path: `/music/${name}.mp3`,
  name: `${name}.mp3`,
  duration: 120,
});

describe('dragDropStore', () => {
  const SOURCE = 'drag-source-workspace';
  const TARGET = 'drag-target-workspace';

  afterEach(() => {
    removeProjectStore(SOURCE);
    removeProjectStore(TARGET);
    useDragDropStore.getState().clearDragState();
  });

  describe('drag state management', () => {
    it('sets and clears drag state', () => {
      const store = useDragDropStore.getState();

      store.setDragging(true);
      expect(useDragDropStore.getState().dragging).toBe(true);

      store.setDraggedItems({ type: 'items', ids: new Set(['1', '2']), sourceWorkspaceId: SOURCE });
      expect(useDragDropStore.getState().draggedItems).toEqual({
        type: 'items',
        ids: new Set(['1', '2']),
        sourceWorkspaceId: SOURCE,
      });

      store.clearDragState();
      expect(useDragDropStore.getState().dragging).toBe(false);
      expect(useDragDropStore.getState().draggedItems).toBeNull();
    });

    it('updates draggedItems with function updater', () => {
      const store = useDragDropStore.getState();

      store.setDraggedItems({ type: 'items', ids: new Set(['1']), sourceWorkspaceId: SOURCE });
      store.setDraggedItems((current) => {
        if (current?.type === 'items') {
          return { ...current, isCopyMode: true };
        }
        return current;
      });

      const state = useDragDropStore.getState();
      expect(state.draggedItems?.type).toBe('items');
      expect(state.draggedItems).not.toBeNull();
      expect(state.draggedItems?.type === 'items' ? state.draggedItems.isCopyMode : null).toBe(
        true,
      );
    });

    it('sets and clears hoverWorkspaceId', () => {
      const store = useDragDropStore.getState();

      store.setHoverWorkspaceId(SOURCE);
      expect(useDragDropStore.getState().hoverWorkspaceId).toBe(SOURCE);

      store.setHoverWorkspaceId(TARGET);
      expect(useDragDropStore.getState().hoverWorkspaceId).toBe(TARGET);

      store.clearDragState();
      expect(useDragDropStore.getState().hoverWorkspaceId).toBeNull();
    });
  });

  describe('prepareMoveCommand', () => {
    it('creates valid move command', () => {
      const sourceStore = ensureProjectStore({
        workspaceId: SOURCE,
        initialName: 'Source',
        maxItems: null,
      });
      ensureProjectStore({
        workspaceId: TARGET,
        initialName: 'Target',
        maxItems: null,
      });

      sourceStore.setState({
        ...sourceStore.getState(),
        items: [createTrack('s-1', 'alpha'), createTrack('s-2', 'beta')],
      });

      const result = useDragDropStore.getState().prepareMoveCommand(['s-1'], SOURCE, TARGET, 0);

      expect(result.success).toBe(true);
      expect(result.command).toEqual({
        type: 'move',
        itemIds: ['s-1'],
        sourceWorkspaceId: SOURCE,
        targetWorkspaceId: TARGET,
        targetIndex: 0,
      });
    });

    it('rejects move when source and target are the same', () => {
      ensureProjectStore({
        workspaceId: SOURCE,
        initialName: 'Source',
      });

      const result = useDragDropStore.getState().prepareMoveCommand(['s-1'], SOURCE, SOURCE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('same workspace');
    });

    it('rejects move when target workspace is full', () => {
      const sourceStore = ensureProjectStore({
        workspaceId: SOURCE,
        maxItems: null,
      });
      const targetStore = ensureProjectStore({
        workspaceId: TARGET,
        maxItems: 1,
      });

      sourceStore.setState({
        ...sourceStore.getState(),
        items: [createTrack('s-1', 'alpha')],
      });

      targetStore.setState({
        ...targetStore.getState(),
        items: [createTrack('t-1', 'occupied')],
      });

      const result = useDragDropStore.getState().prepareMoveCommand(['s-1'], SOURCE, TARGET);

      expect(result.success).toBe(false);
      expect(result.error).toContain('full');
    });

    it('returns error when workspace is not found', () => {
      ensureProjectStore({ workspaceId: SOURCE });

      const result = useDragDropStore.getState().prepareMoveCommand(['missing'], SOURCE, TARGET);

      expect(result.success).toBe(false);
      expect(result.error).toContain('workspace not found');
    });

    it('returns error when track ids are empty', () => {
      ensureProjectStore({ workspaceId: SOURCE });
      ensureProjectStore({ workspaceId: TARGET });

      const result = useDragDropStore.getState().prepareMoveCommand([], SOURCE, TARGET);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No tracks selected');
    });
  });

  describe('prepareCopyCommand', () => {
    it('creates valid copy command', () => {
      const sourceStore = ensureProjectStore({
        workspaceId: SOURCE,
        initialName: 'Source',
        maxItems: null,
      });
      ensureProjectStore({
        workspaceId: TARGET,
        initialName: 'Target',
        maxItems: null,
      });

      sourceStore.setState({
        ...sourceStore.getState(),
        items: [createTrack('s-1', 'alpha')],
      });

      const result = useDragDropStore.getState().prepareCopyCommand(['s-1'], SOURCE, TARGET);

      expect(result.success).toBe(true);
      expect(result.command).toEqual({
        type: 'copy',
        itemIds: ['s-1'],
        sourceWorkspaceId: SOURCE,
        targetWorkspaceId: TARGET,
        targetIndex: 0,
      });
    });

    it('rejects copy when target workspace is full', () => {
      const sourceStore = ensureProjectStore({
        workspaceId: SOURCE,
        maxItems: null,
      });
      const targetStore = ensureProjectStore({
        workspaceId: TARGET,
        maxItems: 1,
      });

      sourceStore.setState({
        ...sourceStore.getState(),
        items: [createTrack('s-1', 'alpha')],
      });

      targetStore.setState({
        ...targetStore.getState(),
        items: [createTrack('t-1', 'occupied')],
      });

      const result = useDragDropStore.getState().prepareCopyCommand(['s-1'], SOURCE, TARGET);

      expect(result.success).toBe(false);
      expect(result.error).toContain('full');
    });
  });
});
