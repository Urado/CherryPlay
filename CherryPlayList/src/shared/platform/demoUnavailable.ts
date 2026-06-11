import { getAppMode } from './appMode';
import type { IPCResponse } from './types';

export const DEMO_UNAVAILABLE_MESSAGE = 'Не доступно в демо';
export const PLATFORM_UNAVAILABLE_MESSAGE = 'Недоступно на этой платформе';

/** User-facing copy when a desktop-only feature is blocked (demo vs capacitor/other). */
export function getPlatformUnavailableMessage(): string {
  return getAppMode() === 'demo' ? DEMO_UNAVAILABLE_MESSAGE : PLATFORM_UNAVAILABLE_MESSAGE;
}

export function demoUnavailableResponse<T = void>(): IPCResponse<T> {
  return {
    success: false,
    error: DEMO_UNAVAILABLE_MESSAGE,
  };
}

export function platformUnavailableResponse<T = void>(): IPCResponse<T> {
  return {
    success: false,
    error: getPlatformUnavailableMessage(),
  };
}

export function throwDemoUnavailable(): never {
  throw new Error(DEMO_UNAVAILABLE_MESSAGE);
}

export function throwPlatformUnavailable(): never {
  throw new Error(getPlatformUnavailableMessage());
}
