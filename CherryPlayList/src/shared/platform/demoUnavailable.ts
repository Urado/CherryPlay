import type { IPCResponse } from './types';

export const DEMO_UNAVAILABLE_MESSAGE = 'Не доступно в демо';

export function demoUnavailableResponse<T = void>(): IPCResponse<T> {
  return {
    success: false,
    error: DEMO_UNAVAILABLE_MESSAGE,
  };
}

export function throwDemoUnavailable(): never {
  throw new Error(DEMO_UNAVAILABLE_MESSAGE);
}
