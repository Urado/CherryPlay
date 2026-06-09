/**
 * @jest-environment node
 */

import * as path from 'path';

import { parseFile } from 'music-metadata';

const handlers = new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>();
const handleMock = jest.fn(
  (channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) => {
    handlers.set(channel, handler);
  },
);
const statMock = jest.fn();
const accessMock = jest.fn();
const netFetchMock = jest.fn();
const protocolHandleMock = jest.fn();
const createReadStreamMock = jest.fn(() => ({ pipe: jest.fn() }));

jest.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
  },
  net: {
    fetch: netFetchMock,
  },
  protocol: {
    handle: protocolHandleMock,
    registerSchemesAsPrivileged: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  createReadStream: createReadStreamMock,
}));

jest.mock('fs/promises', () => ({
  stat: statMock,
  access: accessMock,
}));

jest.mock('music-metadata');

import { registerAudioHandlers } from '../../electron/ipc/audio';
import {
  decodePathFromCherryplayAudioUrl,
  encodePathToCherryplayAudioUrl,
  handleCherryplayAudioRequest,
  MAX_AUDIO_FILE_BYTES,
  parseByteRange,
  registerCherryplayAudioProtocolHandler,
} from '../../electron/protocol/cherryplayAudio';

describe('audio IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
    handleMock.mockClear();
    statMock.mockReset();
    accessMock.mockReset();
  });

  describe('audio:getDuration', () => {
    beforeEach(() => {
      registerAudioHandlers();
      (parseFile as jest.Mock).mockReset();
    });

    test('returns duration for valid audio file', async () => {
      const filePath = 'C:\\Music\\track.mp3';
      statMock.mockResolvedValue({ isFile: () => true, size: 1024 });
      accessMock.mockResolvedValue(undefined);
      (parseFile as jest.Mock).mockResolvedValue({ format: { duration: 245.7 } });

      const handler = handlers.get('audio:getDuration');
      const response = (await handler?.({}, { path: filePath })) as {
        success: boolean;
        data?: number;
      };

      expect(response).toEqual({ success: true, data: 245 });
      expect(statMock).toHaveBeenCalledWith(filePath);
      expect(accessMock).toHaveBeenCalledWith(filePath);
      expect(parseFile).toHaveBeenCalledWith(filePath);
    });

    test('rejects absurdly large audio files before parsing metadata', async () => {
      const filePath = 'C:\\Music\\huge.mp3';
      statMock.mockResolvedValue({
        isFile: () => true,
        size: MAX_AUDIO_FILE_BYTES + 1,
      });

      const handler = handlers.get('audio:getDuration');
      const response = await handler?.({}, { path: filePath });

      expect(response).toEqual({
        success: false,
        error: 'Audio file exceeds maximum allowed size',
      });
      expect(accessMock).not.toHaveBeenCalled();
      expect(parseFile).not.toHaveBeenCalled();
    });

    test('rejects non-audio files', async () => {
      const handler = handlers.get('audio:getDuration');
      const response = await handler?.({}, { path: 'C:\\Music\\readme.txt' });

      expect(response).toEqual({
        success: false,
        error: 'Path is not an audio file',
      });
      expect(accessMock).not.toHaveBeenCalled();
      expect(parseFile).not.toHaveBeenCalled();
    });
  });

  describe('audio:getFileUrl', () => {
    beforeEach(() => {
      registerAudioHandlers();
    });

    test('returns cherryplay-audio URL with base64url-encoded path', async () => {
      const filePath = 'C:\\Music\\track.mp3';
      statMock.mockResolvedValue({ isFile: () => true });

      const handler = handlers.get('audio:getFileUrl');
      const response = (await handler?.({}, { path: filePath })) as {
        success: boolean;
        data?: { url: string };
      };

      expect(response.success).toBe(true);
      expect(response.data?.url).toBe(encodePathToCherryplayAudioUrl(filePath));
      expect(response.data?.url).toMatch(/^cherryplay-audio:\/\/local\//);
      expect(decodePathFromCherryplayAudioUrl(response.data!.url)).toBe(filePath);
    });

    test('rejects path traversal attempts', async () => {
      const handler = handlers.get('audio:getFileUrl');

      const response = await handler?.({}, { path: '../../../etc/passwd' });

      expect(response).toEqual({
        success: false,
        error: 'Invalid path: path traversal detected',
      });
      expect(statMock).not.toHaveBeenCalled();
    });

    test('rejects non-file paths', async () => {
      statMock.mockResolvedValue({ isFile: () => false });

      const handler = handlers.get('audio:getFileUrl');
      const response = await handler?.({}, { path: 'C:\\Music\\track.mp3' });

      expect(response).toEqual({
        success: false,
        error: 'Path is not a file',
      });
    });

    test('rejects non-audio files', async () => {
      const handler = handlers.get('audio:getFileUrl');
      const response = await handler?.({}, { path: 'C:\\Music\\readme.txt' });

      expect(response).toEqual({
        success: false,
        error: 'Path is not an audio file',
      });
      expect(statMock).not.toHaveBeenCalled();
    });

    test('rejects absurdly large audio files without streaming', async () => {
      statMock.mockResolvedValue({
        isFile: () => true,
        size: MAX_AUDIO_FILE_BYTES + 1,
      });

      const handler = handlers.get('audio:getFileUrl');
      const response = await handler?.({}, { path: 'C:\\Music\\huge.mp3' });

      expect(response).toEqual({
        success: false,
        error: 'Audio file exceeds maximum allowed size',
      });
    });
  });

  describe('cherryplay-audio protocol handler', () => {
    beforeEach(() => {
      protocolHandleMock.mockClear();
      netFetchMock.mockReset();
      createReadStreamMock.mockClear();
      registerCherryplayAudioProtocolHandler();
    });

    test('registers protocol.handle for cherryplay-audio', () => {
      expect(protocolHandleMock).toHaveBeenCalledWith('cherryplay-audio', expect.any(Function));
    });

    test('streams full file with Accept-Ranges for valid paths', async () => {
      const filePath = 'C:\\Music\\track.mp3';
      const requestUrl = encodePathToCherryplayAudioUrl(filePath);

      statMock.mockResolvedValue({ isFile: () => true, size: 4096 });

      const response = await handleCherryplayAudioRequest(new Request(requestUrl));

      expect(response.status).toBe(200);
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
      expect(response.headers.get('Content-Length')).toBe('4096');
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(createReadStreamMock).toHaveBeenCalledWith(filePath);
    });

    test('preserves case-sensitive base64url payload in pathname', async () => {
      const filePath = 'C:\\Music\\track.mp3';
      const requestUrl = encodePathToCherryplayAudioUrl(filePath);
      const url = new URL(requestUrl);

      expect(url.hostname).toBe('local');
      expect(url.pathname).toMatch(/^\/[A-Za-z0-9_-]+$/);
      expect(requestUrl).toContain('Qzpc');
      expect(decodePathFromCherryplayAudioUrl(requestUrl)).toBe(filePath);
    });

    test('legacy hostname form breaks when Chromium lowercases base64url', async () => {
      const filePath = 'C:\\Music\\track.mp3';
      const payload = encodePathToCherryplayAudioUrl(filePath).split('/').pop()!;
      const legacyBrokenUrl = `cherryplay-audio://${payload.toLowerCase()}/`;

      expect(payload).toMatch(/[A-Z]/);
      expect(decodePathFromCherryplayAudioUrl(legacyBrokenUrl)).not.toBe(filePath);
    });

    test('returns 206 Partial Content for Range requests (seek support)', async () => {
      const filePath = 'C:\\Music\\track.mp3';
      const requestUrl = encodePathToCherryplayAudioUrl(filePath);

      statMock.mockResolvedValue({ isFile: () => true, size: 5000 });

      const request = new Request(requestUrl, {
        headers: { Range: 'bytes=1024-2047' },
      });
      const response = await handleCherryplayAudioRequest(request);

      expect(response.status).toBe(206);
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
      expect(response.headers.get('Content-Range')).toBe('bytes 1024-2047/5000');
      expect(response.headers.get('Content-Length')).toBe('1024');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(createReadStreamMock).toHaveBeenCalledWith(filePath, { start: 1024, end: 2047 });
    });

    test('includes CORS headers on error responses', async () => {
      const requestUrl = encodePathToCherryplayAudioUrl('C:\\Music\\track.mp3');
      statMock.mockResolvedValue({ isFile: () => true, size: 5000 });

      const forbidden = await handleCherryplayAudioRequest(
        new Request(encodePathToCherryplayAudioUrl('../../../etc/passwd')),
      );
      expect(forbidden.status).toBe(403);
      expect(forbidden.headers.get('Access-Control-Allow-Origin')).toBe('*');

      const rangeRequest = new Request(requestUrl, {
        headers: { Range: 'bytes=9000-9999' },
      });
      const unsatisfiable = await handleCherryplayAudioRequest(rangeRequest);
      expect(unsatisfiable.status).toBe(416);
      expect(unsatisfiable.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(unsatisfiable.headers.get('Content-Range')).toBe('bytes */5000');
    });

    test('returns 413 for files exceeding MAX_AUDIO_FILE_BYTES', async () => {
      const requestUrl = encodePathToCherryplayAudioUrl('C:\\Music\\huge.mp3');
      statMock.mockResolvedValue({
        isFile: () => true,
        size: MAX_AUDIO_FILE_BYTES + 1,
      });

      const response = await handleCherryplayAudioRequest(new Request(requestUrl));

      expect(response.status).toBe(413);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(createReadStreamMock).not.toHaveBeenCalled();
    });

    test('parseByteRange handles open-ended ranges', () => {
      expect(parseByteRange('bytes=1024-', 5000)).toEqual({ start: 1024, end: 4999 });
      expect(parseByteRange('bytes=-500', 5000)).toEqual({ start: 4500, end: 4999 });
    });

    test('returns 403 for path traversal in protocol URL', async () => {
      const requestUrl = encodePathToCherryplayAudioUrl('../../../etc/passwd');

      const response = await handleCherryplayAudioRequest(new Request(requestUrl));

      expect(response.status).toBe(403);
      expect(createReadStreamMock).not.toHaveBeenCalled();
    });

    test('returns 403 when path is not a file', async () => {
      const requestUrl = encodePathToCherryplayAudioUrl('C:\\Music\\track.mp3');
      statMock.mockResolvedValue({ isFile: () => false });

      const response = await handleCherryplayAudioRequest(new Request(requestUrl));

      expect(response.status).toBe(403);
      expect(createReadStreamMock).not.toHaveBeenCalled();
    });

    test('returns 403 for non-audio file extensions', async () => {
      const requestUrl = encodePathToCherryplayAudioUrl('C:\\Music\\readme.txt');

      const response = await handleCherryplayAudioRequest(new Request(requestUrl));

      expect(response.status).toBe(403);
      expect(statMock).not.toHaveBeenCalled();
      expect(createReadStreamMock).not.toHaveBeenCalled();
    });

    test('resolves relative paths before stat and stream', async () => {
      const relativePath = 'Music\\track.mp3';
      const resolvedPath = path.resolve(relativePath);
      const requestUrl = encodePathToCherryplayAudioUrl(relativePath);

      statMock.mockResolvedValue({ isFile: () => true, size: 2048 });

      await handleCherryplayAudioRequest(new Request(requestUrl));

      expect(statMock).toHaveBeenCalledWith(resolvedPath);
      expect(createReadStreamMock).toHaveBeenCalledWith(resolvedPath);
    });
  });
});
