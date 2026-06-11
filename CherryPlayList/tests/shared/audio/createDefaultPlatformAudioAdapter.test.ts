jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: {
    getAudioFileUrl: jest.fn(),
    getAudioDuration: jest.fn(),
  },
}));

jest.mock('../../../src/shared/utils/audioDevices', () => ({
  setAudioSinkId: jest.fn().mockResolvedValue(undefined),
}));

import { createDefaultPlatformAudioAdapter } from '../../../src/shared/audio/playback/createDefaultPlatformAudioAdapter';
import { ipcService } from '../../../src/shared/services/ipcService';

const mockedGetAudioFileUrl = ipcService.getAudioFileUrl as jest.MockedFunction<
  typeof ipcService.getAudioFileUrl
>;

describe('createDefaultPlatformAudioAdapter', () => {
  const createObjectURL = jest.fn();

  beforeEach(() => {
    mockedGetAudioFileUrl.mockReset();
    mockedGetAudioFileUrl.mockResolvedValue({ url: 'cherryplay-audio:///mock-path' });
    createObjectURL.mockClear();
    // @ts-expect-error test stub for blob detection
    URL.createObjectURL = createObjectURL;
  });

  test('resolves filePath via getAudioFileUrl without blob', async () => {
    const adapter = createDefaultPlatformAudioAdapter();

    const result = await adapter.resolveSource({
      kind: 'filePath',
      path: 'D:/Music/track.flac',
    });

    expect(mockedGetAudioFileUrl).toHaveBeenCalledWith('D:/Music/track.flac', false);
    expect(result.url).toBe('cherryplay-audio:///mock-path');
    expect(result.revoke).toBeUndefined();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  test('passes through url and blobUrl sources unchanged', async () => {
    const adapter = createDefaultPlatformAudioAdapter();

    const urlResult = await adapter.resolveSource({
      kind: 'url',
      url: 'https://example.com/track.mp3',
    });
    expect(urlResult).toEqual({ url: 'https://example.com/track.mp3' });
    expect(mockedGetAudioFileUrl).not.toHaveBeenCalled();

    const blobResult = await adapter.resolveSource({
      kind: 'blobUrl',
      blobUrl: 'blob:existing',
    });
    expect(blobResult).toEqual({ url: 'blob:existing' });
    expect(mockedGetAudioFileUrl).not.toHaveBeenCalled();
  });
});
