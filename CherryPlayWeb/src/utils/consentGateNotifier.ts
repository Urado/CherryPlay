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

/** Opens (or refreshes) the consent gate; used by apiFetch on 403 consent_required. */
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

/** Сброс состояния для unit-тестов. */
export function resetConsentGateNotifier(): void {
  isOpen = false;
  pendingMissing = undefined;
  listeners.clear();
}
