import { useEffect, useState } from 'react';

import { getServerUrl } from '../config/serverConfig';
import { isDemoLiveMode } from '../platform/demoLiveMode';
import { getPlatformAppMode, isPlatformInitialized } from '../platform/platformContext';
import {
  checkDesktopCompatibility,
  type DesktopCompatibilityWarning,
} from '../services/desktopCompatibilityService';
import { useSettingsStore } from '../stores/settingsStore';

let lastWarning: DesktopCompatibilityWarning | null = null;
let lastUpdateVersion: string | null = null;
const dismissedPolicies = new Set<string>();
const policyKey = (warning: DesktopCompatibilityWarning) =>
  `${warning.minVersion}:${warning.serverVersion}`;

export const resetDesktopCompatibilityWarningForTests = (): void => {
  lastWarning = null;
  lastUpdateVersion = null;
  dismissedPolicies.clear();
};

export const isDesktopCompatibilitySupported = (): boolean => {
  if (!isPlatformInitialized()) return false;
  const mode = getPlatformAppMode();
  return mode === 'electron' || (mode === 'demo' && isDemoLiveMode());
};

export const useDesktopCompatibilityWarning = (isPartySessionActive: boolean) => {
  const enabled = useSettingsStore((state) => state.enableStreaming && state._hasHydrated);
  const supported = isDesktopCompatibilitySupported();
  const [warning, setWarning] = useState(lastWarning);
  const [updateVersion, setUpdateVersion] = useState(lastUpdateVersion);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [, updateDismissal] = useState(0);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !online || isPartySessionActive || !supported) return undefined;
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (checking || controller.signal.aborted) return;
      checking = true;
      try {
        const serverUrl = await getServerUrl();
        if (controller.signal.aborted) return;
        const result = await checkDesktopCompatibility(serverUrl, controller.signal);
        if (!controller.signal.aborted && result.success) {
          lastWarning = result.warning;
          setWarning(result.warning);
          if (result.updateVersion !== null || lastUpdateVersion === null) {
            lastUpdateVersion = result.updateVersion;
            setUpdateVersion(result.updateVersion);
          }
        }
      } catch {
        return;
      } finally {
        checking = false;
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 5 * 60_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [enabled, online, isPartySessionActive, supported]);

  return {
    warning: supported && enabled && online ? warning : null,
    updateVersion: supported && enabled && online ? updateVersion : null,
    canCheck: supported && enabled && online && !isPartySessionActive,
    dismissed: warning !== null && dismissedPolicies.has(policyKey(warning)),
    dismiss: () => {
      if (!warning) return;
      dismissedPolicies.add(policyKey(warning));
      updateDismissal((revision) => revision + 1);
    },
  };
};
