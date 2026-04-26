import type { DragEvent } from 'react';

import { Track } from '../src/core/types/track';

interface DragEventOptions {
  types?: string[];
  data?: Record<string, string>;
  rectHeight?: number;
  clientY?: number;
  nativeFiles?: File[];
}

export function createFileWithPath(name: string, absolutePath: string): File & { path: string } {
  const f = new File([''], name) as File & { path: string };
  f.path = absolutePath;
  return f;
}

export function createMockDragEvent(options: DragEventOptions = {}): DragEvent<Element> {
  const { types = [], data = {}, rectHeight = 100, clientY = 0, nativeFiles } = options;
  const store = { ...data };

  const fileList: FileList | undefined =
    nativeFiles && nativeFiles.length > 0
      ? (Object.assign(nativeFiles, {
          length: nativeFiles.length,
          item: (i: number) => nativeFiles[i] ?? null,
        }) as FileList)
      : undefined;

  const mergedTypes =
    fileList && fileList.length > 0 && !types.includes('Files') ? [...types, 'Files'] : types;

  const emptyFileList = { length: 0, item: () => null } as FileList;

  const dataTransfer = {
    types: mergedTypes,
    files: fileList ?? emptyFileList,
    getData: (key: string) => store[key] ?? '',
    setData: (key: string, value: string) => {
      store[key] = value;
    },
  };

  const event = {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    dataTransfer,
    currentTarget: {
      getBoundingClientRect: () => ({
        top: 0,
        height: rectHeight,
      }),
      contains: () => false,
    },
    clientY,
  } as unknown as DragEvent<Element>;

  return event;
}

export function createTrack(id: string, path: string): Track {
  return {
    id,
    type: 'track',
    path,
    name: path.split('/').pop() ?? path,
    duration: undefined,
  };
}

export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
