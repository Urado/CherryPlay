type ClientOutdatedListener = () => void;

let isOutdated = false;
const listeners = new Set<ClientOutdatedListener>();

export function isClientOutdated(): boolean {
  return isOutdated;
}

export function notifyClientOutdated(): void {
  if (isOutdated) {
    return;
  }

  isOutdated = true;
  listeners.forEach((listener) => listener());
}

export function subscribeClientOutdated(listener: ClientOutdatedListener): () => void {
  listeners.add(listener);

  if (isOutdated) {
    listener();
  }

  return () => {
    listeners.delete(listener);
  };
}

/** Сброс состояния для unit-тестов. */
export function resetClientOutdatedNotifier(): void {
  isOutdated = false;
  listeners.clear();
}
