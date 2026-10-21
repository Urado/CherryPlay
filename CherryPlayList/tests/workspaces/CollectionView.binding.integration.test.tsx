import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { WorkspaceId } from '../../src/core/types/workspace';
import { useProjectStore } from '../../src/shared/stores/projectStore';
import { ensureCollectionWorkspaceStore } from '../../src/shared/stores/projectStoreFactory';
import { CollectionView } from '../../src/workspaces/collection/CollectionView';

jest.mock('@shared/components', () => {
  return {
    ItemList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropIndicator: () => null,
    ProjectItemRow: () => null,
    EmptyState: () => null,
    WorkspaceHeader: ({ titleControl }: { titleControl: React.ReactNode }) => <header>{titleControl}</header>,
  };
});

jest.mock('@shared/hooks', () => ({
  useWorkspaceDragAndDrop: () => ({
    handleDragOverContainer: jest.fn(),
    handleDragLeave: jest.fn(),
    handleDragEnd: jest.fn(),
    handleDropOnContainer: jest.fn(),
    draggedItems: null,
    dragOverIndex: null,
    insertPosition: null,
    handleDragStart: jest.fn(),
    handleDragOver: jest.fn(),
    handleDrop: jest.fn(),
  }),
  useTrackDuration: () => ({ loadDurationsForTracks: jest.fn() }),
  usePlaybackPreview: () => ({ activeTrackId: null, playerStatus: 'stopped', startPlayback: jest.fn(), pausePlayback: jest.fn() }),
  useSelectionWithModifiers: () => ({ handleToggleSelect: jest.fn() }),
  useDragDropExecutor: () => ({ executeMove: jest.fn(), executeCopy: jest.fn() }),
}));

jest.mock('@shared/platform', () => ({
  getPlatformCapabilities: () => ({ supportsNativeFileSystem: false }),
}));

jest.mock('@shared/services', () => ({
  fileService: { isValidAudioFile: jest.fn() },
  ipcService: { getAudioDuration: jest.fn(), findAudioFilesRecursive: jest.fn() },
}));

jest.mock('@shared/shortcuts', () => ({ useListShortcuts: jest.fn() }));

const workspaceId = 'collection-view-integration' as WorkspaceId;

const setupBoundView = (): void => {
  useProjectStore.getState().newProject();
  useProjectStore.getState().loadProject({
    name: 'Integration project',
    items: [],
    settings: useProjectStore.getState().settings,
    trackSettings: new Map(),
    groupSettings: new Map(),
    collections: [
      { id: 'evening', name: 'Вечерний сет', items: [] },
      { id: 'main', name: 'Основная программа', items: [] },
    ],
  });
  ensureCollectionWorkspaceStore(workspaceId, 'evening');
  useProjectStore.getState().bindCollectionToWorkspace(workspaceId, 'evening');
};

describe('CollectionView workspace binding integration', () => {
  beforeEach(() => {
    act(setupBoundView);
  });

  afterEach(() => {
    act(() => useProjectStore.getState().newProject());
  });

  it('binds the workspace to a selected collection and renders it immediately', async () => {
    const user = userEvent.setup();
    render(<CollectionView workspaceId={workspaceId} zoneId="collection-zone" />);

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Основная программа' }));

    await waitFor(() => {
      expect(useProjectStore.getState().collectionBindings[workspaceId]).toBe('main');
      expect(screen.getByRole('button', { name: 'Подборка: Основная программа' })).toBeInTheDocument();
    });
  });

  it('shows real collection names beside the delete controls in the open picker', async () => {
    const user = userEvent.setup();
    render(<CollectionView workspaceId={workspaceId} zoneId="collection-zone" />);

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));

    expect(screen.getByRole('menuitemradio', { name: 'Вечерний сет' })).toBeVisible();
    expect(screen.getByRole('menuitemradio', { name: 'Основная программа' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Удалить подборку Вечерний сет' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Удалить подборку Основная программа' })).toBeVisible();
  });

  it('creates a collection, binds the workspace to it, and switches to it immediately', async () => {
    const user = userEvent.setup();
    render(<CollectionView workspaceId={workspaceId} zoneId="collection-zone" />);

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));
    await user.click(screen.getByRole('menuitem', { name: 'Создать новую подборку' }));

    await waitFor(() => {
      const { collections, collectionBindings } = useProjectStore.getState();
      const createdCollection = collections.find(({ name }) => name === 'Подборка 1');
      expect(createdCollection).toBeDefined();
      expect(collectionBindings[workspaceId]).toBe(createdCollection?.id);
      expect(screen.getByRole('button', { name: 'Подборка: Подборка 1' })).toBeInTheDocument();
    });
  });
});
