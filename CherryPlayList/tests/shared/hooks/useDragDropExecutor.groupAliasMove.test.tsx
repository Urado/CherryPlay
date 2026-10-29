import { act, renderHook } from '@testing-library/react';

import {
  DEFAULT_PLAYER_WORKSPACE_ID,
  DEFAULT_PLAYLIST_WORKSPACE_ID,
} from '../../../src/core/constants/workspace';
import { useDragDropExecutor } from '../../../src/shared/hooks/useDragDropExecutor';
import {
  ensureProjectStore,
  initializeGlobalHistory,
  initializeProjectStoreHistory,
  removeProjectStore,
  useProjectStore,
} from '../../../src/shared/stores';
import { useGlobalHistoryStore } from '../../../src/shared/stores/globalHistoryStore';

const createItems = () => [
  {
    id: 'source-group',
    name: 'Source group',
    items: [
      {
        id: 'nested-group',
        name: 'Nested group',
        items: [{ id: 'nested-track', path: 'nested.mp3', name: 'Nested track' }],
      },
    ],
  },
  {
    id: 'target-group',
    name: 'Target group',
    items: [{ id: 'target-track', path: 'target.mp3', name: 'Target track' }],
  },
];

describe('useDragDropExecutor moves between aliased workspace ids', () => {
  beforeEach(() => {
    initializeProjectStoreHistory();
    initializeGlobalHistory();
    useGlobalHistoryStore.getState().clearHistory();
    useProjectStore.setState({ items: createItems() });
  });

  afterEach(() => {
    useGlobalHistoryStore.getState().clearHistory();
    useProjectStore.setState({ items: [] });
  });

  it.each(['source-group', 'nested-group'])(
    'rejects moving a group into itself or its descendant (%s) without losing tracks',
    (targetParentId) => {
      const { result } = renderHook(() => useDragDropExecutor());

      let moved = true;
      act(() => {
        moved = result.current.executeMove({
          type: 'move',
          itemIds: ['source-group'],
          sourceWorkspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
          targetWorkspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
          targetParentId,
          targetIndex: 0,
        });
      });

      expect(moved).toBe(false);
      expect(useProjectStore.getState().items).toEqual(createItems());
    },
  );

  it('moves groups between aliased workspace ids and preserves their nested tracks', () => {
    const { result } = renderHook(() => useDragDropExecutor());

    let moved = false;
    act(() => {
      moved = result.current.executeMove({
        type: 'move',
        itemIds: ['source-group'],
        sourceWorkspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
        targetWorkspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
        targetParentId: 'target-group',
        targetIndex: 1,
      });
    });

    const [targetGroup] = useProjectStore.getState().items;
    expect(moved).toBe(true);
    expect(targetGroup).toMatchObject({ id: 'target-group' });
    expect('items' in targetGroup ? targetGroup.items : []).toEqual([
      { id: 'target-track', path: 'target.mp3', name: 'Target track' },
      {
        id: 'source-group',
        name: 'Source group',
        items: [
          {
            id: 'nested-group',
            name: 'Nested group',
            items: [{ id: 'nested-track', path: 'nested.mp3', name: 'Nested track' }],
          },
        ],
      },
    ]);
  });

  it('records source changes after a successful cross-store move', () => {
    const sourceWorkspaceId = 'move-history-source';
    const targetWorkspaceId = 'move-history-target';
    const sourceStore = ensureProjectStore({ workspaceId: sourceWorkspaceId, persist: false });
    const targetStore = ensureProjectStore({ workspaceId: targetWorkspaceId, persist: false });
    sourceStore.setState({ items: [createItems()[0]] });
    targetStore.setState({ items: [] });
    const { result } = renderHook(() => useDragDropExecutor());

    let moved = false;
    act(() => {
      moved = result.current.executeMove({
        type: 'move',
        itemIds: ['source-group'],
        sourceWorkspaceId,
        targetWorkspaceId,
        targetParentId: null,
        targetIndex: 0,
      });
    });

    expect(moved).toBe(true);
    act(() => {
      sourceStore.getState().addItem({ path: 'new.mp3', name: 'New track' });
    });

    act(() => {
      useGlobalHistoryStore.getState().undo();
    });

    expect(sourceStore.getState().items).toEqual([]);
    expect(targetStore.getState().items[0].name).toBe('Source group');

    removeProjectStore(sourceWorkspaceId);
    removeProjectStore(targetWorkspaceId);
  });
});
