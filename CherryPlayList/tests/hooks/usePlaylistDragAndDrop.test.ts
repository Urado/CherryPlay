/// <reference types="jest" />

jest.mock('@shared/stores/projectStoreFactory', () => {
  const { createTrack } = jest.requireActual('../testUtils') as {
    createTrack: (id: string, path: string) => import('../../src/core/types/track').Track;
  };
  const t1 = createTrack('1', '/track-1.mp3');
  const t2 = createTrack('2', '/track-2.mp3');
  const t3 = createTrack('3', '/track-3.mp3');
  const mockStore = {
    getState: () => ({
      items: [t1, t2, t3],
    }),
  };
  return {
    getProjectStore: jest.fn(() => mockStore),
    getAllProjectStoreIds: jest.fn(() => ['test-workspace']),
  };
});

jest.mock('@shared/services/ipcService', () => ({
  ipcService: {
    statFile: jest.fn(),
  },
}));

import { renderHook, act } from '@testing-library/react';
import type { DragEvent as ReactDragEvent } from 'react';

import { ipcService } from '@shared/services/ipcService';

import { usePlaylistDragAndDrop } from '../../src/shared/hooks/useWorkspaceDragAndDrop';
import { useDragDropStore } from '../../src/shared/stores/dragDropStore';
import { flattenItemsForDisplay } from '../../src/shared/utils/playerItemsUtils';
import { createFileWithPath, createMockDragEvent, createTrack, flushPromises } from '../testUtils';

const baseTracks = [
  createTrack('1', '/track-1.mp3'),
  createTrack('2', '/track-2.mp3'),
  createTrack('3', '/track-3.mp3'),
];

const baseDisplayItems = flattenItemsForDisplay(baseTracks);

const flatIndexForTrackId = (id: string) =>
  baseDisplayItems.find((d) => d.item.id === id)?.flatIndex ?? 0;

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
    selectedItemIds: new Set<string>(),
    workspaceId: 'test-workspace' as const,
    isValidAudioFile: jest.fn((path: string) => path.endsWith('.mp3')),
    onAddTracks: jest.fn(),
    onAddTracksAt: jest.fn(),
    onTracksAdded: jest.fn(),
    loadFolderTracks: jest.fn().mockResolvedValue(['/folder/nested.mp3']),
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
  (ipcService.statFile as jest.Mock).mockReset();
  (ipcService.statFile as jest.Mock).mockImplementation(async (path: string) => ({
    isDirectory: /[/\\]dir$/i.test(path) || path.includes('__dir__') || path.endsWith('Folder'),
  }));
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
    const idx2 = flatIndexForTrackId('2');

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDragOver(
        createMockDragEvent({ types: ['text/plain'], clientY: 80 }),
        idx2,
      );
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
    const idx2 = flatIndexForTrackId('2');

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDragOver(
        createMockDragEvent({ types: ['text/plain'], clientY: 10 }),
        idx2,
      );
    });

    act(() => {
      result.current.handleDrop(createMockDragEvent({ types: ['text/plain'] }), idx2);
    });

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
    const { result, options } = renderUsePlaylistDragAndDrop({ selectedItemIds: selectedIds });
    const idx3 = flatIndexForTrackId('3');

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDragOver(
        createMockDragEvent({ types: ['text/plain'], clientY: 90 }),
        idx3,
      );
    });

    act(() => {
      result.current.handleDrop(createMockDragEvent({ types: ['text/plain'] }), idx3);
    });

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

  it('adds files dropped on playlist item at correct index', async () => {
    const { result, options } = renderUsePlaylistDragAndDrop();
    const idx2 = flatIndexForTrackId('2');

    act(() => {
      useDragDropStore.getState().setDraggedItems({ type: 'files', paths: [], directories: [] });
    });

    act(() => {
      result.current.handleDragOver(
        createMockDragEvent({ types: ['application/json'], clientY: 90 }),
        idx2,
      );
    });

    await act(async () => {
      const event = createMockDragEvent({
        types: ['application/json'],
        data: {
          'application/json': JSON.stringify({ type: 'fileBrowser', paths: ['/new/song.mp3'] }),
        },
        clientY: 90,
      });
      result.current.handleDrop(event, idx2);
      await flushPromises();
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
  });

  it('adds folders recursively when dropped on container', async () => {
    const loadFolderTracks = jest.fn().mockResolvedValue(['/folder/inner.mp3']);
    const { result, options } = renderUsePlaylistDragAndDrop({ loadFolderTracks });

    act(() => {
      useDragDropStore.getState().setDraggedItems({ type: 'files', paths: [], directories: [] });
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
      result.current.handleDropOnContainer(event);
      await flushPromises();
    });

    expect(loadFolderTracks).toHaveBeenCalledWith('/folder');
    expect(options.onAddTracksAt).toHaveBeenCalledWith(
      [expect.objectContaining({ path: '/folder/inner.mp3' })],
      expect.any(Number),
    );
  });

  it('moves a single track to the end when dropped on container', () => {
    const { result, options } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDropOnContainer(createMockDragEvent({ types: ['text/plain'] }));
    });

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

  it('adds only valid files dropped on the container', () => {
    const isValidAudioFile = jest.fn((path: string) => path.endsWith('.mp3'));
    const { result, options } = renderUsePlaylistDragAndDrop({ isValidAudioFile });

    act(() => {
      useDragDropStore.getState().setDraggedItems({ type: 'files', paths: [], directories: [] });
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
      result.current.handleDropOnContainer(event);
    });

    expect(options.onAddTracksAt).toHaveBeenCalledTimes(1);
    const drafts = options.onAddTracksAt.mock.calls[0][0] as { path: string; name: string }[];
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toEqual(
      expect.objectContaining({
        path: '/valid.mp3',
        name: 'valid.mp3',
      }),
    );
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

  it('adds external OS files: stats paths, filters audio, supports mixed file + folder', async () => {
    (ipcService.statFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path === 'C:/mix/__dir__') {
        return { isDirectory: true };
      }
      if (path === 'C:/mix/skip.txt') {
        return { isDirectory: false };
      }
      if (path === 'C:/mix/ok.mp3') {
        return { isDirectory: false };
      }
      return { isDirectory: false };
    });

    const loadFolderTracks = jest.fn().mockResolvedValueOnce(['C:/mix/from-folder.mp3']);
    const { result, options } = renderUsePlaylistDragAndDrop({ loadFolderTracks });
    const targetFlat = flatIndexForTrackId('2');

    await act(async () => {
      const event = createMockDragEvent({
        types: ['Files'],
        nativeFiles: [
          createFileWithPath('ok.mp3', 'C:/mix/ok.mp3'),
          createFileWithPath('skip.txt', 'C:/mix/skip.txt'),
          createFileWithPath('__dir__', 'C:/mix/__dir__'),
        ],
        clientY: 10,
      });
      result.current.handleDrop(event, targetFlat);
      await flushPromises();
    });

    expect(ipcService.statFile).toHaveBeenCalled();
    expect(loadFolderTracks).toHaveBeenCalledWith('C:/mix/__dir__');
    expect(options.onAddTracksAt).toHaveBeenCalledTimes(2);
    const fromCalls = options.onAddTracksAt.mock.calls.flatMap((call) =>
      (call[0] as { path: string }[]).map((d) => d.path),
    );
    expect(fromCalls.sort()).toEqual(['C:/mix/from-folder.mp3', 'C:/mix/ok.mp3'].sort());
  });

  it('surfaces onError when native drop yields no resolvable paths', async () => {
    const { result, options } = renderUsePlaylistDragAndDrop();

    await act(async () => {
      const f = new File([''], 'blob.mp3');
      const event = createMockDragEvent({ types: ['Files'], nativeFiles: [f] });
      result.current.handleDrop(event, 0);
      await flushPromises();
    });

    expect(options.onError).toHaveBeenCalled();
  });

  it('uses window.api.getPathForFile when File has no legacy .path', async () => {
    const getPathForFile = jest.fn().mockReturnValue('C:/from-preload/track.mp3');
    (window as unknown as { api: { getPathForFile: (f: File) => string } }).api = {
      getPathForFile,
    };

    try {
      const { result, options } = renderUsePlaylistDragAndDrop();
      const targetFlat = flatIndexForTrackId('2');

      await act(async () => {
        const event = createMockDragEvent({
          types: ['Files'],
          nativeFiles: [new File([''], 'track.mp3')],
          clientY: 10,
        });
        result.current.handleDrop(event, targetFlat);
        await flushPromises();
      });

      expect(getPathForFile).toHaveBeenCalledTimes(1);
      expect(options.onAddTracksAt).toHaveBeenCalledWith(
        [expect.objectContaining({ path: 'C:/from-preload/track.mp3' })],
        expect.any(Number),
      );
    } finally {
      delete (window as unknown as { api?: unknown }).api;
    }
  });

  it('surfaces onError when paths were collected but every stat fails', async () => {
    (ipcService.statFile as jest.Mock).mockRejectedValue(new Error('stat failed'));
    const { result, options } = renderUsePlaylistDragAndDrop();
    const targetFlat = flatIndexForTrackId('2');

    await act(async () => {
      const event = createMockDragEvent({
        types: ['Files'],
        nativeFiles: [createFileWithPath('x.mp3', 'C:/x/x.mp3')],
        clientY: 10,
      });
      result.current.handleDrop(event, targetFlat);
      await flushPromises();
    });

    expect(options.onError).toHaveBeenCalledWith(expect.stringMatching(/failed stat|validation/i));
    expect(options.onAddTracksAt).not.toHaveBeenCalled();
  });

  it('warns via onError when some native paths fail stat but others are added', async () => {
    (ipcService.statFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path === 'C:/x/bad.mp3') {
        throw new Error('stat failed');
      }
      return { isDirectory: false };
    });

    const { result, options } = renderUsePlaylistDragAndDrop();
    const targetFlat = flatIndexForTrackId('2');

    await act(async () => {
      const event = createMockDragEvent({
        types: ['Files'],
        nativeFiles: [
          createFileWithPath('bad.mp3', 'C:/x/bad.mp3'),
          createFileWithPath('ok.mp3', 'C:/x/ok.mp3'),
        ],
        clientY: 10,
      });
      result.current.handleDrop(event, targetFlat);
      await flushPromises();
    });

    expect(options.onAddTracksAt).toHaveBeenCalledWith(
      [expect.objectContaining({ path: 'C:/x/ok.mp3' })],
      expect.any(Number),
    );
    expect(options.onError).toHaveBeenCalledWith(
      'Some dropped items could not be read and were skipped',
    );
  });

  it('prefers internal application/json fileBrowser payload over native DataTransfer.files', async () => {
    const { result, options } = renderUsePlaylistDragAndDrop();
    const targetFlat = flatIndexForTrackId('2');

    await act(async () => {
      const event = createMockDragEvent({
        types: ['application/json', 'Files'],
        data: {
          'application/json': JSON.stringify({
            type: 'fileBrowser',
            paths: ['/from-json/pick-me.mp3'],
            directories: [],
          }),
        },
        nativeFiles: [createFileWithPath('ignore.mp3', 'C:/from-explorer/ignore.mp3')],
        clientY: 10,
      });
      result.current.handleDrop(event, targetFlat);
      await flushPromises();
    });

    expect(ipcService.statFile).not.toHaveBeenCalled();
    expect(options.onAddTracksAt).toHaveBeenCalledTimes(1);
    expect(options.onAddTracksAt).toHaveBeenCalledWith(
      [expect.objectContaining({ path: '/from-json/pick-me.mp3' })],
      expect.any(Number),
    );
  });
});
