type ConsentGateListener = (missing: string[] | undefined) => void;

let isOpen = false;
let pendingMissing: string[] | undefined;
const listeners = new Set<ConsentGateListener>();

export const isConsentGateOpen = (): boolean => {
  return isOpen;
};

export const getConsentGateMissing = (): string[] | undefined => {
  return pendingMissing;
};

export const notifyConsentRequired = (missing?: string[]): void => {
  isOpen = true;
  pendingMissing = missing;
  listeners.forEach((listener) => listener(missing));
};

export const clearConsentGateNotifier = (): void => {
  isOpen = false;
  pendingMissing = undefined;
};

export const subscribeConsentRequired = (listener: ConsentGateListener): (() => void) => {
  listeners.add(listener);

  if (isOpen) {
    listener(pendingMissing);
  }

  return () => {
    listeners.delete(listener);
  };
};

export const resetConsentGateNotifier = (): void => {
  isOpen = false;
  pendingMissing = undefined;
  listeners.clear();
};
