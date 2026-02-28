import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import type { AppConfigResponse } from '../types/api';

export interface AppConfigState {
  oauthEnabled: boolean;
  partyInfoPageEnabled: boolean;
  isLoading: boolean;
}

const defaultState: AppConfigState = {
  oauthEnabled: false,
  partyInfoPageEnabled: false,
  isLoading: true,
};

const AppConfigContext = createContext<AppConfigState | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppConfigState>(defaultState);

  useEffect(() => {
    let cancelled = false;

    fetch(getApiUrl(API_ENDPOINTS.CONFIG), { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AppConfigResponse | null) => {
        if (cancelled) return;
        if (!data) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }
        setState({
          oauthEnabled: typeof data.oauthEnabled === 'boolean' ? data.oauthEnabled : false,
          partyInfoPageEnabled:
            typeof data.partyInfoPageEnabled === 'boolean' ? data.partyInfoPageEnabled : false,
          isLoading: false,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.warn('[AppConfigProvider] Failed to fetch app config, using defaults', err);
        }
        setState((prev) => ({ ...prev, isLoading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigState {
  const ctx = useContext(AppConfigContext);
  if (ctx == null) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }
  return ctx;
}
