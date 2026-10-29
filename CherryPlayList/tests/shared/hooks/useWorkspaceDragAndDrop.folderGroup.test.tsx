import { act, renderHook, waitFor } from '@testing-library/react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '../../../src/core/constants/workspace';
import { useWorkspaceDragAndDrop } from '../../../src/shared/hooks/useWorkspaceDragAndDrop';
import { flattenItemsForDisplay } from '../../../src/shared/utils/playerItemsUtils';

describe('useWorkspaceDragAndDrop folder drop into a group', () => {
  it('passes the target group and insertion index with expanded folder tracks', async () => {
    const items = [
      {
        id: 'target-group',
        name: 'Target group',
        items: [{ id: 'existing-track', path: 'existing.mp3', name: 'Existing' }],
      },
    ];
    const onAddTracks = jest.fn();
    const dataTransfer = {
      types: ['application/json'],
      getData: () => JSON.stringify({ type: 'fileBrowser', directories: ['music'] }),
    } as unknown as DataTransfer;
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      dataTransfer,
    } as unknown as React.DragEvent;
    const { result } = renderHook(() =>
      useWorkspaceDragAndDrop({
        displayItems: flattenItemsForDisplay(items),
        items,
        tracks: [],
        selectedItemIds: new Set(),
        workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
        isValidAudioFile: (path) => path.endsWith('.mp3'),
        onAddTracks,
        onAddTracksAt: jest.fn(),
        loadFolderTracks: jest.fn().mockResolvedValue(['first.mp3', 'second.mp3']),
      }),
    );

    act(() => result.current.handleDrop(event, 0));

    await waitFor(() =>
      expect(onAddTracks).toHaveBeenCalledWith(
        [
          { path: 'first.mp3', name: 'first.mp3' },
          { path: 'second.mp3', name: 'second.mp3' },
        ],
        'target-group',
        0,
      ),
    );
  });
});
