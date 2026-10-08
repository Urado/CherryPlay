import { projectService } from '../../../src/shared/services/projectService';
import { useAuthStore } from '../../../src/shared/stores/authStore';
import { useGlobalHistoryStore } from '../../../src/shared/stores/globalHistoryStore';
import {
  ensureProjectStore,
  initializeGlobalHistory,
  removeProjectStore,
} from '../../../src/shared/stores/projectStoreFactory';
import { clearExpiredAuthSession, setAuthSessionToken } from '../../../src/shared/utils/authSession';
import { runProjectSaveTransaction } from '../../../src/shared/utils/projectSaveTransaction';

const mockInvoke = jest.fn();

jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: {
    invoke: (...args: unknown[]) => Promise.resolve(mockInvoke(...args)),
    statFile: jest.fn(),
  },
}));

describe('project store lifecycle', () => {
  const workspaceId = 'project-lifecycle-test' as never;

  afterEach(() => {
    removeProjectStore(workspaceId);
    useGlobalHistoryStore.getState().clearHistory();
    useAuthStore.getState().clearAuth();
  });

  it('restores the file path and party link when switching between projects', () => {
    const store = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    const linkedParty = { id: 'party-a', shortCode: 'alpha' };

    store.getState().loadData({
      name: 'Project A',
      items: [],
      filePath: 'D:/parties/a.cherry',
      linkedParty,
    });
    expect(store.getState().meta.filePath).toBe('D:/parties/a.cherry');
    expect(store.getState().meta.linkedParty).toEqual(linkedParty);

    store.getState().loadData({
      name: 'Project B',
      items: [],
      filePath: 'D:/parties/b.cherry',
    });
    expect(store.getState().meta.filePath).toBe('D:/parties/b.cherry');
    expect(store.getState().meta.linkedParty).toBeNull();

    store.getState().loadData({
      name: 'Project A',
      items: [],
      filePath: 'D:/parties/a.cherry',
      linkedParty,
    });
    expect(store.getState().name).toBe('Project A');
    expect(store.getState().meta.filePath).toBe('D:/parties/a.cherry');
    expect(store.getState().meta.linkedParty).toEqual(linkedParty);
  });

  it('clears project binding and restores default metadata', () => {
    const store = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    store.getState().loadData({
      name: 'Bound project',
      items: [],
      filePath: 'D:/parties/a.cherry',
      linkedParty: { id: 'party-a', shortCode: 'alpha' },
    });

    store.getState().clear();

    expect(store.getState().name).toBe('Playlist');
    expect(store.getState().meta.filePath).toBeNull();
    expect(store.getState().meta.linkedParty).toBeNull();
    expect(store.getState().items).toEqual([]);
  });

  it('keeps a party linked to the open project when an expired auth session is cleared and restored', () => {
    const store = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    const linkedParty = { id: 'party-a', shortCode: 'alpha' };
    const expiredToken = `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`;
    const renewedToken = `header.${btoa(JSON.stringify({ exp: 4102444800 }))}.signature`;

    store.getState().loadData({
      name: 'Project A',
      items: [],
      filePath: 'D:/parties/a.cherry',
      linkedParty,
    });
    setAuthSessionToken(expiredToken);
    useAuthStore.getState().setOrganizer({ id: 'organizer-a', name: 'Organizer A' });

    expect(clearExpiredAuthSession(useAuthStore.getState().accessToken)).toBe(true);

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().organizer).toBeNull();
    expect(store.getState().meta.filePath).toBe('D:/parties/a.cherry');
    expect(store.getState().meta.linkedParty).toEqual(linkedParty);

    setAuthSessionToken(renewedToken);
    useAuthStore.getState().setOrganizer({ id: 'organizer-a', name: 'Organizer A' });

    expect(useAuthStore.getState().accessToken).toBe(renewedToken);
    expect(useAuthStore.getState().organizer).toEqual({ id: 'organizer-a', name: 'Organizer A' });
    expect(store.getState().meta.filePath).toBe('D:/parties/a.cherry');
    expect(store.getState().meta.linkedParty).toEqual(linkedParty);
  });

  it('does not change a saved party binding when the signed-in organizer changes', () => {
    const store = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    const linkedParty = { id: 'party-a', shortCode: 'alpha' };
    store.getState().loadData({
      name: 'Project A',
      items: [],
      filePath: 'D:/parties/a.cherry',
      linkedParty,
    });

    useAuthStore.getState().setOrganizer({ id: 'organizer-a', name: 'Organizer A' });
    useAuthStore.getState().setOrganizer({ id: 'organizer-b', name: 'Organizer B' });

    expect(useAuthStore.getState().organizer?.id).toBe('organizer-b');
    expect(store.getState().meta.linkedParty).toEqual(linkedParty);
    expect(store.getState().meta.filePath).toBe('D:/parties/a.cherry');
  });

  it('keeps session playback state isolated when loading another project', () => {
    const store = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    const sessionState = {
      mode: 'session' as const,
      playedTrackIds: ['track-a'],
      disabledTrackIds: ['track-b'],
      disabledGroupIds: ['group-a'],
      currentTrackId: 'track-a',
      sessionStartTime: 1234,
    };
    store.getState().loadData({ name: 'Project A', items: [], sessionState });
    store.getState().loadData({ name: 'Project B', items: [] });

    expect(store.getState().sessionState).toEqual({
      mode: 'preparation',
      playedTrackIds: [],
      disabledTrackIds: [],
      disabledGroupIds: [],
      currentTrackId: null,
      sessionStartTime: null,
    });

    store.getState().loadData({ name: 'Project A', items: [], sessionState });
    expect(store.getState().sessionState).toEqual(sessionState);
  });

  it('applies undo to the project that owns the history action after another project is loaded', () => {
    const projectA = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    const projectBId = 'project-lifecycle-test-b' as never;
    const projectB = ensureProjectStore({ workspaceId: projectBId, initialName: 'Playlist' });
    initializeGlobalHistory();
    projectA.getState().loadData({ name: 'Project A', items: [] });
    projectB.getState().loadData({ name: 'Project B', items: [] });
    projectA.getState().setName('Project A renamed');
    projectB.getState().loadData({ name: 'Project B', items: [] });

    expect(useGlobalHistoryStore.getState().undo()).toBe(true);

    expect(projectA.getState().name).toBe('Project A');
    expect(projectB.getState().name).toBe('Project B');

    removeProjectStore(projectBId);
  });

  it('clears isDirty and binds the new path only after Save As succeeds', async () => {
    const store = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    const destination = 'D:/projects/New name.cherry';
    mockInvoke.mockResolvedValue({ success: true });
    store.getState().loadData({ name: 'Original name', items: [], filePath: 'D:/old.cherry' });
    store.getState().markAsDirty();
    const file = projectService.serializeProject({
      name: 'New name',
      items: [],
      settings: store.getState().settings,
      trackSettings: store.getState().trackSettings,
      groupSettings: store.getState().groupSettings,
      sessionState: store.getState().sessionState,
    });

    await runProjectSaveTransaction(
      () => projectService.saveProject(destination, file, { notifyOnIpcError: false }),
      () => {
        store.getState().setName('New name');
        store.getState().setFilePath(destination);
        store.getState().resetDirty();
      },
    );

    expect(mockInvoke).toHaveBeenCalledWith(
      'project:save',
      expect.objectContaining({ path: destination }),
      false,
    );
    expect(store.getState().name).toBe('New name');
    expect(store.getState().meta.filePath).toBe(destination);
    expect(store.getState().meta.isDirty).toBe(false);
  });

  it('retains dirty state and the previous path when Save As fails', async () => {
    const store = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    mockInvoke.mockRejectedValue(new Error('disk full'));
    store.getState().loadData({ name: 'Original name', items: [], filePath: 'D:/old.cherry' });
    store.getState().markAsDirty();
    const file = projectService.serializeProject({
      name: 'New name',
      items: [],
      settings: store.getState().settings,
      trackSettings: store.getState().trackSettings,
      groupSettings: store.getState().groupSettings,
      sessionState: store.getState().sessionState,
    });

    await expect(
      runProjectSaveTransaction(
        () =>
          projectService.saveProject('D:/projects/New name.cherry', file, {
            notifyOnIpcError: false,
          }),
        () => {
          store.getState().setName('New name');
          store.getState().setFilePath('D:/projects/New name.cherry');
          store.getState().resetDirty();
        },
      ),
    ).rejects.toThrow('disk full');

    expect(store.getState().meta.filePath).toBe('D:/old.cherry');
    expect(store.getState().meta.isDirty).toBe(true);
  });
});
