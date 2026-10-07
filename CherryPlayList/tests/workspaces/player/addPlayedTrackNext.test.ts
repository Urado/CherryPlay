const projectState = {
  name: 'Project',
  items: [] as Array<Record<string, unknown>>,
  trackSettings: new Map<string, Record<string, unknown>>(),
  meta: { filePath: null as string | null, isDirty: false },
  sessionState: { sessionStartTime: 1 },
  findItemById: jest.fn(),
  getItemPath: jest.fn(),
};

const pushCommand = jest.fn();

jest.mock('../../../src/shared/stores', () => ({
  useProjectStore: {
    getState: () => projectState,
    setState: (nextState: Record<string, unknown>) => Object.assign(projectState, nextState),
  },
}));

jest.mock('../../../src/shared/stores/globalHistoryStore', () => ({
  useGlobalHistoryStore: { getState: () => ({ pushCommand }) },
}));

import { AddItemsAtPositionsCommand } from '../../../src/shared/commands';
import { addPlayedTrackNext } from '../../../src/workspaces/player/addPlayedTrackNext';

const makeTrack = (id: string, name = id) => ({
  id,
  path: `C:/music/${name}.mp3`,
  name,
  duration: 180,
  isMissing: false,
  loudness: { status: 'ok', integratedLufs: -12 },
});

const resetStore = (items: Array<Record<string, unknown>>) => {
  projectState.items = items;
  projectState.trackSettings = new Map([['played', { actionAfterTrack: 'pause', pauseBetweenTracks: 4 }]]);
  projectState.meta = { filePath: null, isDirty: false };
  projectState.sessionState = { sessionStartTime: 1 };
  projectState.findItemById.mockImplementation((id: string) => {
    const find = (values: Array<Record<string, unknown>>): Record<string, unknown> | null => {
      for (const item of values) {
        if (item.id === id) return item;
        if (Array.isArray(item.items)) {
          const nested = find(item.items as Array<Record<string, unknown>>);
          if (nested) return nested;
        }
      }
      return null;
    };
    return find(projectState.items);
  });
  projectState.getItemPath.mockImplementation((id: string) => {
    const find = (values: Array<Record<string, unknown>>, path: string[]): string[] => {
      for (const item of values) {
        if (item.id === id) return [...path, id];
        if (Array.isArray(item.items)) {
          const nested = find(item.items as Array<Record<string, unknown>>, [...path, item.id as string]);
          if (nested.length) return nested;
        }
      }
      return [];
    };
    return find(projectState.items, []);
  });
  pushCommand.mockClear();
};

describe('addPlayedTrackNext', () => {
  beforeEach(() => resetStore([makeTrack('current'), makeTrack('played')]));

  it('inserts a source copy after the current track with a unique id and copied playback settings', () => {
    const added = addPlayedTrackNext('played', 'current');

    expect(added).toBe(true);
    const inserted = projectState.items[1];
    expect(inserted).toMatchObject({
      path: 'C:/music/played.mp3',
      name: 'played',
      duration: 180,
      isMissing: false,
      loudness: { status: 'ok', integratedLufs: -12 },
    });
    expect(inserted.id).not.toBe('played');
    expect(new Set(projectState.items.map((item) => item.id)).size).toBe(3);
    expect(projectState.trackSettings.get(inserted.id as string)).toEqual({
      actionAfterTrack: 'pause',
      pauseBetweenTracks: 4,
    });
    expect(pushCommand).toHaveBeenCalledWith(expect.any(String), expect.any(AddItemsAtPositionsCommand), expect.any(String));
  });

  it('uses the queue start when the active pointer is absent or invalid', () => {
    addPlayedTrackNext('played', null);
    expect(projectState.items[0].name).toBe('played');

    resetStore([makeTrack('current'), makeTrack('played')]);
    addPlayedTrackNext('played', 'missing-current');
    expect(projectState.items[0].name).toBe('played');
  });

  it('inserts within the active track group and keeps successive additions FIFO', () => {
    resetStore([
      { id: 'group', name: 'Set', items: [makeTrack('current'), makeTrack('played')] },
      makeTrack('outside'),
    ]);

    addPlayedTrackNext('played', 'current');
    const first = ((projectState.items[0].items as Array<Record<string, unknown>>)[1]).id;
    addPlayedTrackNext('played', 'current');

    const nested = projectState.items[0].items as Array<Record<string, unknown>>;
    expect(nested.map((item) => item.name)).toEqual(['current', 'played', 'played', 'played']);
    expect(nested[1].id).toBe(first);
  });

  it('does not change playback state and ignores source ids absent from the project queue', () => {
    const initialItems = projectState.items;
    const added = addPlayedTrackNext('aimp-only-source', 'current');

    expect(added).toBe(false);
    expect(projectState.items).toBe(initialItems);
    expect(pushCommand).not.toHaveBeenCalled();
  });

  it('supports undo and redo while preserving copied settings', () => {
    addPlayedTrackNext('played', 'current');
    const command = (pushCommand.mock.calls as [string, AddItemsAtPositionsCommand, string][])[0][1];
    const insertedId = projectState.items[1].id as string;
    const undo = command.undo({ items: projectState.items as never, name: 'Project', trackSettings: projectState.trackSettings });
    expect(undo.newState?.items).toHaveLength(2);
    expect(undo.newState?.trackSettings?.has(insertedId)).toBe(false);

    const redo = command.execute({ items: projectState.items as never, name: 'Project', trackSettings: projectState.trackSettings });
    expect(redo.newState?.items?.[1].id).toBe(insertedId);
    expect(redo.newState?.trackSettings?.get(insertedId)).toEqual({
      actionAfterTrack: 'pause',
      pauseBetweenTracks: 4,
    });
  });
});
