const projectState = {
  name: 'Project',
  items: [] as Array<Record<string, unknown>>,
  trackSettings: new Map<string, Record<string, unknown>>(),
  groupSettings: new Map<string, Record<string, unknown>>(),
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
import {
  addPlayedGroupNext,
  addPlayedTrackNext,
} from '../../../src/workspaces/player/addPlayedTrackNext';

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
  projectState.trackSettings = new Map([
    ['played', { actionAfterTrack: 'pause', pauseBetweenTracks: 4 }],
    ['g1', { actionAfterTrack: 'pauseAndNext', pauseBetweenTracks: 2 }],
    ['nested-track', { actionAfterTrack: 'next', pauseBetweenTracks: 1 }],
  ]);
  projectState.groupSettings = new Map([
    ['played-group', { actionAfterTrack: 'pause', pauseBetweenTracks: 3 }],
    ['nested-group', { actionAfterTrack: 'pauseAndNext', pauseBetweenTracks: 5 }],
  ]);
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
          const nested = find(item.items as Array<Record<string, unknown>>, [
            ...path,
            item.id as string,
          ]);
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
    expect(pushCommand).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(AddItemsAtPositionsCommand),
      expect.any(String),
    );
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
    const first = (projectState.items[0].items as Array<Record<string, unknown>>)[1].id;
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
    const undo = command.undo({
      items: projectState.items as never,
      name: 'Project',
      trackSettings: projectState.trackSettings,
      groupSettings: projectState.groupSettings,
    });
    expect(undo.newState?.items).toHaveLength(2);
    expect(undo.newState?.trackSettings?.has(insertedId)).toBe(false);

    const redo = command.execute({
      items: projectState.items as never,
      name: 'Project',
      trackSettings: projectState.trackSettings,
      groupSettings: projectState.groupSettings,
    });
    expect(redo.newState?.items?.[1].id).toBe(insertedId);
    expect(redo.newState?.trackSettings?.get(insertedId)).toEqual({
      actionAfterTrack: 'pause',
      pauseBetweenTracks: 4,
    });
  });
});

describe('addPlayedGroupNext', () => {
  const playedGroup = () => ({
    id: 'played-group',
    name: 'Played Set',
    items: [
      makeTrack('g1'),
      {
        id: 'nested-group',
        name: 'Nested',
        items: [makeTrack('nested-track')],
      },
      makeTrack('g2'),
    ],
  });

  beforeEach(() => resetStore([makeTrack('current'), playedGroup()]));

  it('inserts a deep copy of the group with nested subgroups and tracks after the current track', () => {
    const added = addPlayedGroupNext('played-group', 'current');

    expect(added).toBe(true);
    expect(projectState.items).toHaveLength(3);
    const inserted = projectState.items[1] as {
      id: string;
      name: string;
      items: Array<Record<string, unknown>>;
    };
    expect(inserted.name).toBe('Played Set');
    expect(inserted.id).not.toBe('played-group');
    expect(inserted.items).toHaveLength(3);
    expect(inserted.items[0]).toMatchObject({
      path: 'C:/music/g1.mp3',
      name: 'g1',
    });
    expect(inserted.items[0].id).not.toBe('g1');
    const nested = inserted.items[1] as { id: string; name: string; items: Array<Record<string, unknown>> };
    expect(nested.name).toBe('Nested');
    expect(nested.id).not.toBe('nested-group');
    expect(nested.items[0]).toMatchObject({
      path: 'C:/music/nested-track.mp3',
      name: 'nested-track',
    });
    expect(nested.items[0].id).not.toBe('nested-track');
    expect(inserted.items[2]).toMatchObject({ name: 'g2' });
    expect(inserted.items[2].id).not.toBe('g2');

    const allIds = [
      inserted.id,
      inserted.items[0].id,
      nested.id,
      nested.items[0].id,
      inserted.items[2].id,
      'current',
      'played-group',
      'g1',
      'nested-group',
      'nested-track',
      'g2',
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('copies nested track and group settings onto the duplicated ids', () => {
    addPlayedGroupNext('played-group', 'current');
    const inserted = projectState.items[1] as {
      id: string;
      items: Array<Record<string, unknown>>;
    };
    const nested = inserted.items[1] as { id: string; items: Array<Record<string, unknown>> };

    expect(projectState.groupSettings.get(inserted.id)).toEqual({
      actionAfterTrack: 'pause',
      pauseBetweenTracks: 3,
    });
    expect(projectState.groupSettings.get(nested.id)).toEqual({
      actionAfterTrack: 'pauseAndNext',
      pauseBetweenTracks: 5,
    });
    expect(projectState.trackSettings.get(inserted.items[0].id as string)).toEqual({
      actionAfterTrack: 'pauseAndNext',
      pauseBetweenTracks: 2,
    });
    expect(projectState.trackSettings.get(nested.items[0].id as string)).toEqual({
      actionAfterTrack: 'next',
      pauseBetweenTracks: 1,
    });
  });

  it('keeps successive group additions FIFO after the same active track', () => {
    addPlayedGroupNext('played-group', 'current');
    const firstId = projectState.items[1].id;
    addPlayedGroupNext('played-group', 'current');

    expect(projectState.items.map((item) => item.name)).toEqual([
      'current',
      'Played Set',
      'Played Set',
      'Played Set',
    ]);
    expect(projectState.items[1].id).toBe(firstId);
    expect(projectState.items[2].id).not.toBe(firstId);
  });

  it('returns false for non-group sources', () => {
    const initialItems = projectState.items;
    expect(addPlayedGroupNext('current', 'current')).toBe(false);
    expect(addPlayedGroupNext('missing', 'current')).toBe(false);
    expect(projectState.items).toBe(initialItems);
    expect(pushCommand).not.toHaveBeenCalled();
  });

  it('supports undo and redo for group copies including nested settings', () => {
    addPlayedGroupNext('played-group', 'current');
    const command = (pushCommand.mock.calls as [string, AddItemsAtPositionsCommand, string][])[0][1];
    const inserted = projectState.items[1] as {
      id: string;
      items: Array<Record<string, unknown>>;
    };
    const nested = inserted.items[1] as { id: string; items: Array<Record<string, unknown>> };
    const trackId = inserted.items[0].id as string;
    const nestedTrackId = nested.items[0].id as string;

    const undo = command.undo({
      items: projectState.items as never,
      name: 'Project',
      trackSettings: projectState.trackSettings,
      groupSettings: projectState.groupSettings,
    });
    expect(undo.newState?.items).toHaveLength(2);
    expect(undo.newState?.trackSettings?.has(trackId)).toBe(false);
    expect(undo.newState?.trackSettings?.has(nestedTrackId)).toBe(false);
    expect(undo.newState?.groupSettings?.has(inserted.id)).toBe(false);
    expect(undo.newState?.groupSettings?.has(nested.id)).toBe(false);

    const redo = command.execute({
      items: projectState.items as never,
      name: 'Project',
      trackSettings: projectState.trackSettings,
      groupSettings: projectState.groupSettings,
    });
    expect(redo.newState?.items?.[1].id).toBe(inserted.id);
    expect(redo.newState?.trackSettings?.get(trackId)).toEqual({
      actionAfterTrack: 'pauseAndNext',
      pauseBetweenTracks: 2,
    });
    expect(redo.newState?.groupSettings?.get(inserted.id)).toEqual({
      actionAfterTrack: 'pause',
      pauseBetweenTracks: 3,
    });
  });
});
