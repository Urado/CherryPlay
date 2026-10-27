const mockStatFile = jest.fn();

jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: {
    invoke: jest.fn(),
    statFile: (...args: unknown[]) => Promise.resolve(mockStatFile(...args)),
  },
}));

import { projectService } from '../../../src/shared/services/projectService';

describe('portable collection paths', () => {
  beforeEach(() => {
    mockStatFile.mockReset();
    mockStatFile.mockRejectedValue(new Error('File not found'));
  });

  it('rejects loading when a collection folder path no longer resolves', async () => {
    const file = projectService.serializeProject({
      name: 'Portable set',
      items: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: true,
      },
      trackSettings: new Map(),
      groupSettings: new Map(),
      collections: [
        {
          id: 'collection-id',
          name: 'Collection name',
          items: [
            {
              id: 'track-id',
              path: './collections/Renamed folder/song.mp3',
              name: 'Song',
            },
          ],
        },
      ],
    });

    await expect(
      projectService.loadProjectFromData(file, 'D:\\parties\\set.cherry'),
    ).rejects.toThrow('папка подборки не переименована');
  });
});
