export type BrowserLoginFlowState = {
  status: 'idle' | 'waiting' | 'failed';
  error: string | null;
};

let state: BrowserLoginFlowState = { status: 'idle', error: null };
const listeners = new Set<() => void>();

const setState = (next: BrowserLoginFlowState): void => {
  state = next;
  listeners.forEach((listener) => listener());
}

export const getBrowserLoginFlowState = (): BrowserLoginFlowState => {
  return state;
}

export const subscribeBrowserLoginFlow = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const beginBrowserLoginFlow = (): void => {
  setState({ status: 'waiting', error: null });
}

export const completeBrowserLoginFlow = (): void => {
  setState({ status: 'idle', error: null });
}

export const failBrowserLoginFlow = (message: string): void => {
  setState({ status: 'failed', error: message });
}

export const resetBrowserLoginFlow = (): void => {
  setState({ status: 'idle', error: null });
}
