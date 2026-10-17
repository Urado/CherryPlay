type ClientOutdatedListener = () => void;

let isOutdated = false;
const listeners = new Set<ClientOutdatedListener>();

export const isClientOutdated = (): boolean => {
  return isOutdated;
};

export const notifyClientOutdated = (): void => {
  if (isOutdated) {
    return;
  }

  isOutdated = true;
  listeners.forEach((listener) => listener());
};

export const subscribeClientOutdated = (listener: ClientOutdatedListener): (() => void) => {
  listeners.add(listener);

  if (isOutdated) {
    listener();
  }

  return () => {
    listeners.delete(listener);
  };
};

export const resetClientOutdatedNotifier = (): void => {
  isOutdated = false;
  listeners.clear();
};
