/// <reference types="jest" />

import { renderHook, act } from '@testing-library/react';
import type { DragEvent as ReactDragEvent } from 'react';

import { usePlaylistDragAndDrop } from '../../src/shared/hooks/useWorkspaceDragAndDrop';
import { useDragDropStore } from '../../src/shared/stores/dragDropStore';
import { flattenItemsForDisplay } from '../../src/shared/utils/playerItemsUtils';
import { createMockDragEvent, createTrack, flushPromises } from '../testUtils';

const baseTracks = [
  createTrack('1', '/track-1.mp3'),
  createTrack('2', '/track-2.mp3'),
  createTrack('3', '/track-3.mp3'),
];

const baseDisplayItems = flattenItemsForDisplay(baseTracks);

const createDragLeaveEvent = () =>
  ({
    currentTarget: {
      getBoundingClientRect: () => ({
        left: 0,
        right: 100,
        top: 0,
        bottom: 100,
      }),
      contains: () => false,
    },
    relatedTarget: null,
    clientX: 200,
    clientY: 200,
  }) as ReactDragEvent<Element>;

function createOptions() {
  return {
    displayItems: baseDisplayItems,
    items: baseTracks,
    tracks: baseTracks,
    selectedTrackIds: new Set<string>(),
    workspaceId: 'test-workspace' as const,
    isValidAudioFile: jest.fn((path: string) => path.endsWith('.mp3')),
    onAddTracks: jest.fn(),
    onAddTracksAt: jest.fn(),
    onTracksAdded: jest.fn(),
    loadFolderTracks: jest.fn().mockResolvedValue(['/folder/nested.mp3']),
    // Unified move/copy callbacks
    onMove: jest.fn().mockReturnValue(true),
    onCopy: jest.fn().mockReturnValue(true),
    onError: jest.fn(),
  };
}

const renderUsePlaylistDragAndDrop = (override: Partial<ReturnType<typeof createOptions>> = {}) => {
  const options = { ...createOptions(), ...override };
  const view = renderHook(() => usePlaylistDragAndDrop(options));
  return { ...view, options };
};

beforeEach(() => {
  jest.clearAllMocks();
  useDragDropStore.getState().clearDragState();
});

describe('usePlaylistDragAndDrop', () => {
  it('marks dragging state on start and clears on drag end', () => {
    const { result } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    expect(useDragDropStore.getState().dragging).toBe(true);

    act(() => {
      result.current.handleDragEnd();
    });

    expect(useDragDropStore.getState().dragging).toBe(false);
    expect(result.current.draggedItems).toBeNull();
  });

  it('updates insertion indicators on drag over and clears them on leave', () => {
    const { result } = renderUsePlaylistDragAndDrop();

    // First start a drag to set up draggedItems
    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDragOver(createMockDragEvent({ types: ['text/plain'], clientY: 80 }), {
        module: 'playlistItem',
        targetId: '2',
      });
    });

    expect(result.current.dragOverId).toBe('2');
    expect(result.current.insertPosition).toBe('bottom');

    act(() => {
      result.current.handleDragLeave(createDragLeaveEvent());
    });

    expect(result.current.dragOverId).toBeNull();
    expect(result.current.insertPosition).toBeNull();
  });

  it('moves a single track when dropped on another item', () => {
    const { result, options } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDragOver(createMockDragEvent({ types: ['text/plain'], clientY: 10 }), {
        module: 'playlistItem',
        targetId: '2',
      });
    });

    act(() => {
      result.current.handleDrop(createMockDragEvent({ types: ['text/plain'] }), {
        module: 'playlistItem',
        targetId: '2',
      });
    });

    // Now uses unified onMove executor
    expect(options.onMove).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'move',
        itemIds: ['1'],
        sourceWorkspaceId: 'test-workspace',
        targetWorkspaceId: 'test-workspace',
        targetParentId: null,
        targetIndex: 0,
      }),
    );
  });

  it('moves grouped selection preserving order', () => {
    const selectedIds = new Set<string>(['1', '2']);
    const { result, options } = renderUsePlaylistDragAndDrop({ selectedTrackIds: selectedIds });

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDragOver(createMockDragEvent({ types: ['text/plain'], clientY: 90 }), {
        module: 'playlistItem',
        targetId: '3',
      });
    });

    act(() => {
      result.current.handleDrop(createMockDragEvent({ types: ['text/plain'] }), {
        module: 'playlistItem',
        targetId: '3',
      });
    });

    // Now uses unified onMove executor
    expect(options.onMove).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'move',
        itemIds: ['1', '2'],
        sourceWorkspaceId: 'test-workspace',
        targetWorkspaceId: 'test-workspace',
        targetParentId: null,
        targetIndex: 1,
      }),
    );
  });

  it('adds files dropped on playlist item at correct index', () => {
    const { result, options } = renderUsePlaylistDragAndDrop();

    // Set up a file drag state
    act(() => {
      useDragDropStore.getState().setDraggedItems({ type: 'files', paths: [] });
    });

    act(() => {
      result.current.handleDragOver(
        createMockDragEvent({ types: ['application/json'], clientY: 90 }),
        {
          module: 'playlistItem',
          targetId: '2',
        },
      );
    });

    act(() => {
      const event = createMockDragEvent({
        types: ['application/json'],
        data: {
          'application/json': JSON.stringify({ type: 'fileBrowser', paths: ['/new/song.mp3'] }),
        },
        clientY: 90,
      });
      result.current.handleDrop(event, { module: 'playlistItem', targetId: '2' });
    });

    expect(options.onAddTracksAt).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          path: '/new/song.mp3',
          name: 'song.mp3',
        }),
      ],
      2,
    );
    expect(options.onTracksAdded).toHaveBeenCalledWith(['/new/song.mp3']);
  });

  it('adds folders recursively when dropped', async () => {
    const loadFolderTracks = jest.fn().mockResolvedValue(['/folder/inner.mp3']);
    const { result, options } = renderUsePlaylistDragAndDrop({ loadFolderTracks });

    // Set up a file drag state
    act(() => {
      useDragDropStore.getState().setDraggedItems({ type: 'files', paths: [] });
    });

    await act(async () => {
      const event = createMockDragEvent({
        types: ['application/json'],
        data: {
          'application/json': JSON.stringify({
            type: 'fileBrowser',
            paths: [],
            directories: ['/folder'],
          }),
        },
      });
      result.current.handleDrop(event, { module: 'playlistContainer' });
      await flushPromises();
    });

    expect(loadFolderTracks).toHaveBeenCalledWith('/folder');
    expect(options.onAddTracks).toHaveBeenCalledWith([
      expect.objectContaining({ path: '/folder/inner.mp3' }),
    ]);
  });

  it('moves a single track to the end when dropped on container', () => {
    const { result, options } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDrop(createMockDragEvent({ types: ['text/plain'] }), {
        module: 'playlistContainer',
      });
    });

    // Now uses unified onMove executor
    // When dropped on container, it goes to the end
    expect(options.onMove).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'move',
        itemIds: ['1'],
        sourceWorkspaceId: 'test-workspace',
        targetWorkspaceId: 'test-workspace',
        targetParentId: null,
        targetIndex: baseTracks.length - 1,
      }),
    );
  });

  it('adds only valid files dropped on the container and reports added paths', () => {
    const isValidAudioFile = jest.fn((path: string) => path.endsWith('.mp3'));
    const { result, options } = renderUsePlaylistDragAndDrop({ isValidAudioFile });

    // Set up a file drag state
    act(() => {
      useDragDropStore.getState().setDraggedItems({ type: 'files', paths: [] });
    });

    act(() => {
      const event = createMockDragEvent({
        types: ['application/json'],
        data: {
          'application/json': JSON.stringify({
            type: 'fileBrowser',
            paths: ['/valid.mp3', '/skip.txt'],
          }),
        },
      });
      result.current.handleDrop(event, { module: 'playlistContainer' });
    });

    expect(options.onAddTracks).toHaveBeenCalledTimes(1);
    const drafts = options.onAddTracks.mock.calls[0][0];
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toEqual(
      expect.objectContaining({
        path: '/valid.mp3',
        name: 'valid.mp3',
      }),
    );
    expect(options.onTracksAdded).toHaveBeenCalledWith(['/valid.mp3']);
    expect(isValidAudioFile).toHaveBeenCalledWith('/skip.txt');
  });

  it('stores source workspace in draggedItems for cross-workspace tracking', () => {
    const { result } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    const draggedItems = result.current.draggedItems;
    expect(draggedItems?.type).toBe('items');
    expect(draggedItems).not.toBeNull();
    expect(draggedItems?.type === 'items' ? draggedItems.sourceWorkspaceId : null).toBe(
      'test-workspace',
    );
  });
});
