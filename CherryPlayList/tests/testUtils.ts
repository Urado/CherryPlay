import type { DragEvent } from 'react';

import { Track } from '../src/core/types/track';

interface DragEventOptions {
  types?: string[];
  data?: Record<string, string>;
  rectHeight?: number;
  clientY?: number;
}

export function createMockDragEvent(options: DragEventOptions = {}): DragEvent<Element> {
  const { types = [], data = {}, rectHeight = 100, clientY = 0 } = options;
  const store = { ...data };

  const event = {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    dataTransfer: {
      types,
      getData: (key: string) => store[key] ?? '',
      setData: (key: string, value: string) => {
        store[key] = value;
      },
    },
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
