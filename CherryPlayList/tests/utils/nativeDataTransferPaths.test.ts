/// <reference types="jest" />

import {
  classifyNativePathsWithStat,
  collectNativePathsFromDataTransfer,
  getPathForFileInRenderer,
  isOsNativeFileDataTransfer,
  tryParseInternalFileBrowserPayload,
} from '../../src/shared/utils/nativeDataTransferPaths';

function makeDataTransferWithFiles(files: File[], types: string[] = ['Files']): DataTransfer {
  const list: FileList = {
    ...files,
    length: files.length,
    item: (i: number) => files[i] ?? null,
  } as FileList;
  return {
    files: list,
    types,
    getData: () => '',
  } as unknown as DataTransfer;
}

describe('nativeDataTransferPaths', () => {
  beforeEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it('isOsNativeFileDataTransfer is true when files list is non-empty', () => {
    const dt = makeDataTransferWithFiles([new File(['x'], 'a.txt')], ['Files']);
    expect(isOsNativeFileDataTransfer(dt)).toBe(true);
  });

  it('isOsNativeFileDataTransfer is false when no files', () => {
    const dt = makeDataTransferWithFiles([], ['text/plain']);
    expect(isOsNativeFileDataTransfer(dt)).toBe(false);
  });

  it('collectNativePathsFromDataTransfer uses getPathForFile and normalizes', () => {
    const f = new File([''], 't.mp3');
    const dt = makeDataTransferWithFiles([f]);
    const getPath = jest.fn().mockReturnValue('D:\\Music\\t.mp3');
    expect(collectNativePathsFromDataTransfer(dt, getPath)).toEqual(['D:/Music/t.mp3']);
  });

  it('dedupes same path from duplicate File entries', () => {
    const a = new File([''], 'a.mp3');
    const b = new File([''], 'a.mp3');
    const dt = makeDataTransferWithFiles([a, b]);
    const getPath = jest.fn().mockReturnValue('C:/x/a.mp3');
    expect(collectNativePathsFromDataTransfer(dt, getPath)).toEqual(['C:/x/a.mp3']);
    expect(getPath).toHaveBeenCalledTimes(2);
  });

  it('getPathForFileInRenderer falls back to .path when api missing', () => {
    const f = new File([''], 'a.mp3') as File & { path: string };
    f.path = 'E:/a.mp3';
    expect(getPathForFileInRenderer(f)).toBe('E:/a.mp3');
  });

  it('getPathForFileInRenderer uses window.api.getPathForFile when present', () => {
    (window as unknown as { api: { getPathForFile: (f: File) => string } }).api = {
      getPathForFile: (file: File) => `R:/${file.name}`,
    };
    const f = new File([''], 'a.mp3');
    expect(getPathForFileInRenderer(f)).toBe('R:/a.mp3');
  });

  it('classifyNativePathsWithStat splits files and directories', async () => {
    const stat = jest.fn().mockImplementation(async (p: string) => ({
      isDirectory: p === 'C:/Folder',
    }));
    const r = await classifyNativePathsWithStat(['C:/a.mp3', 'C:/Folder'], stat);
    expect(r.files).toEqual(['C:/a.mp3']);
    expect(r.directories).toEqual(['C:/Folder']);
    expect(r.inputCount).toBe(2);
    expect(r.statFailureCount).toBe(0);
  });

  it('classifyNativePathsWithStat drops paths that throw on stat', async () => {
    const stat = jest.fn().mockRejectedValue(new Error('nope'));
    const r = await classifyNativePathsWithStat(['/bad'], stat);
    expect(r.files).toEqual([]);
    expect(r.directories).toEqual([]);
    expect(r.inputCount).toBe(1);
    expect(r.statFailureCount).toBe(1);
  });

  it('classifyNativePathsWithStat counts partial stat failures and keeps successful paths', async () => {
    const stat = jest.fn().mockImplementation(async (p: string) => {
      if (p === '/bad') {
        throw new Error('eacces');
      }
      return { isDirectory: p === '/okdir' };
    });
    const r = await classifyNativePathsWithStat(['/bad', '/ok.mp3', '/okdir'], stat);
    expect(r.files).toEqual(['/ok.mp3']);
    expect(r.directories).toEqual(['/okdir']);
    expect(r.inputCount).toBe(3);
    expect(r.statFailureCount).toBe(1);
  });

  it('tryParseInternalFileBrowserPayload returns fileBrowser paths when application/json is set', () => {
    const dt = makeDataTransferWithFiles([], ['application/json']);
    (dt as unknown as { getData: (k: string) => string }).getData = () =>
      JSON.stringify({ type: 'fileBrowser', paths: ['/a.mp3'], directories: ['/d'] });
    expect(tryParseInternalFileBrowserPayload(dt)).toEqual({
      files: ['/a.mp3'],
      directories: ['/d'],
    });
  });

  it('tryParseInternalFileBrowserPayload returns null for unrecognized JSON type', () => {
    const dt = makeDataTransferWithFiles([new File(['x'], 'n.txt')], ['application/json', 'Files']);
    (dt as unknown as { getData: (k: string) => string }).getData = () =>
      JSON.stringify({ type: 'other', paths: ['/x'] });
    expect(tryParseInternalFileBrowserPayload(dt)).toBeNull();
  });
});
