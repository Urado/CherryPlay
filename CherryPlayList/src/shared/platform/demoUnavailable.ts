import { getAppMode } from './appMode';
import type { IPCResponse } from './types';

export const DEMO_UNAVAILABLE_MESSAGE = 'Не доступно в демо';
export const PLATFORM_UNAVAILABLE_MESSAGE = 'Недоступно на этой платформе';

export const getPlatformUnavailableMessage = (): string => {
  return getAppMode() === 'demo' ? DEMO_UNAVAILABLE_MESSAGE : PLATFORM_UNAVAILABLE_MESSAGE;
};

export const demoUnavailableResponse = <T = void>(): IPCResponse<T> => {
  return {
    success: false,
    error: DEMO_UNAVAILABLE_MESSAGE,
  };
};

export const platformUnavailableResponse = <T = void>(): IPCResponse<T> => {
  return {
    success: false,
    error: getPlatformUnavailableMessage(),
  };
};

export const throwDemoUnavailable = (): never => {
  throw new Error(DEMO_UNAVAILABLE_MESSAGE);
};

export const throwPlatformUnavailable = (): never => {
  throw new Error(getPlatformUnavailableMessage());
};
