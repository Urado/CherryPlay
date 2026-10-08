import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  beginBrowserLoginFlow,
  completeBrowserLoginFlow,
  failBrowserLoginFlow,
  getBrowserLoginFlowState,
  resetBrowserLoginFlow,
  subscribeBrowserLoginFlow,
} from '../auth/browserLoginFlow';
import { getAppMode, getPlatform, isPlatformInitialized } from '../platform';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';

function cancelPendingAuthCallback(): void {
  if (!isPlatformInitialized() || getAppMode() !== 'electron') {
    return;
  }
  void getPlatform().invoke('auth:cancelCallback');
}

export function useBrowserLogin() {
  const flowState = useSyncExternalStore(
    subscribeBrowserLoginFlow,
    getBrowserLoginFlowState,
    getBrowserLoginFlowState,
  );
  const authenticated = useAuthStore((store) => store.isAuthenticated());

  useEffect(() => {
    if (authenticated && flowState.status === 'waiting') {
      completeBrowserLoginFlow();
    }
  }, [authenticated, flowState.status]);

  const startLogin = useCallback(async () => {
    cancelPendingAuthCallback();
    beginBrowserLoginFlow();
    try {
      await authService.startBrowserLogin();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Не удалось открыть браузер';
      failBrowserLoginFlow(message);
    }
  }, []);

  const retryLogin = useCallback(() => {
    resetBrowserLoginFlow();
    void startLogin();
  }, [startLogin]);

  const cancelWaiting = useCallback(() => {
    cancelPendingAuthCallback();
    resetBrowserLoginFlow();
  }, []);

  return {
    isWaiting: flowState.status === 'waiting',
    error: flowState.error,
    startLogin,
    retryLogin,
    cancelWaiting,
  };
}
