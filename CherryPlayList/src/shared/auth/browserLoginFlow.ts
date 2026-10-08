export type BrowserLoginFlowState = {
  status: 'idle' | 'waiting' | 'failed';
  error: string | null;
};

let state: BrowserLoginFlowState = { status: 'idle', error: null };
const listeners = new Set<() => void>();

function setState(next: BrowserLoginFlowState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getBrowserLoginFlowState(): BrowserLoginFlowState {
  return state;
}

export function subscribeBrowserLoginFlow(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function beginBrowserLoginFlow(): void {
  setState({ status: 'waiting', error: null });
}

export function completeBrowserLoginFlow(): void {
  setState({ status: 'idle', error: null });
}

export function failBrowserLoginFlow(message: string): void {
  setState({ status: 'failed', error: message });
}

export function resetBrowserLoginFlow(): void {
  setState({ status: 'idle', error: null });
}
