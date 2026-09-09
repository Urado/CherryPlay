type ConsentGateListener = (missing: string[] | undefined) => void;

let isOpen = false;
let pendingMissing: string[] | undefined;
const listeners = new Set<ConsentGateListener>();

export function isConsentGateOpen(): boolean {
  return isOpen;
}

export function getConsentGateMissing(): string[] | undefined {
  return pendingMissing;
}

export function notifyConsentRequired(missing?: string[]): void {
  isOpen = true;
  pendingMissing = missing;
  listeners.forEach((listener) => listener(missing));
}

export function clearConsentGateNotifier(): void {
  isOpen = false;
  pendingMissing = undefined;
}

export function subscribeConsentRequired(listener: ConsentGateListener): () => void {
  listeners.add(listener);

  if (isOpen) {
    listener(pendingMissing);
  }

  return () => {
    listeners.delete(listener);
  };
}

export function resetConsentGateNotifier(): void {
  isOpen = false;
  pendingMissing = undefined;
  listeners.clear();
}
