import CloseIcon from '@mui/icons-material/Close';
import { APP_VERSION } from '@shared/config';
import { getWebBaseUrl } from '@shared/config/serverConfig';
import { getPlatform, getPlatformAppMode, isPlatformInitialized } from '@shared/platform';
import {
  checkLatestDesktopUpdate,
  compareDesktopVersions,
  getDesktopDownloadPageUrl,
} from '@shared/services/desktopUpdateService';
import { useClientOutdatedStore, useProjectStore } from '@shared/stores';
import React, { useEffect, useRef, useState } from 'react';

import './DesktopUpdateNotice.css';

const DISMISSED_VERSION_KEY = 'cherryplay-desktop-update-dismissed-version';
const LAST_CHECKED_KEY = 'cherryplay-desktop-update-last-checked';
const NEXT_RETRY_KEY = 'cherryplay-desktop-update-next-retry';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 5 * 60 * 1000;

const readStoredTimestamp = (key: string): number => {
  try {
    return Number(window.localStorage.getItem(key) ?? 0);
  } catch {
    return 0;
  }
};

const persistSuccessfulCheck = (timestamp: number): void => {
  try {
    window.localStorage.setItem(LAST_CHECKED_KEY, String(timestamp));
    window.localStorage.removeItem(NEXT_RETRY_KEY);
  } catch {
    return;
  }
};

const persistRetryTime = (timestamp: number): void => {
  try {
    window.localStorage.setItem(NEXT_RETRY_KEY, String(timestamp));
  } catch {
    return;
  }
};

export const DesktopUpdateNotice: React.FC = () => {
  const isPartySessionActive = useProjectStore(
    (state) => state.sessionState.mode === 'session' && Boolean(state.meta.linkedParty),
  );
  const isRequired = useClientOutdatedStore((state) => state.isOutdated);
  const requiredVersion = useClientOutdatedStore((state) => state.requiredVersion);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISSED_VERSION_KEY);
    } catch {
      return null;
    }
  });
  const lastCheckedAt = useRef(0);
  const nextRetryAt = useRef(0);

  useEffect(() => {
    if (!isPlatformInitialized() || getPlatformAppMode() !== 'electron') return undefined;

    let mounted = true;
    const checkUpdate = async () => {
      if (isPartySessionActive) return;
      const lastChecked = Math.max(
        lastCheckedAt.current,
        readStoredTimestamp(LAST_CHECKED_KEY),
      );
      const nextRetry = Math.max(nextRetryAt.current, readStoredTimestamp(NEXT_RETRY_KEY));
      const now = Date.now();
      if (now - lastChecked < CHECK_INTERVAL_MS || now < nextRetry) return;
      const result = await checkLatestDesktopUpdate();
      if (!mounted) return;
      if (!result.success) {
        nextRetryAt.current = now + FAILURE_RETRY_MS;
        persistRetryTime(nextRetryAt.current);
        return;
      }
      lastCheckedAt.current = now;
      nextRetryAt.current = 0;
      persistSuccessfulCheck(now);
      const comparison = result.update
        ? compareDesktopVersions(result.update.version, String(APP_VERSION))
        : null;
      setAvailableVersion(
        result.update && comparison !== null && comparison > 0 ? result.update.version : null,
      );
    };

    void checkUpdate();
    const interval = window.setInterval(() => void checkUpdate(), 60_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [isPartySessionActive]);

  const openDownloadPage = async () => {
    try {
      const webBaseUrl = await getWebBaseUrl();
      await getPlatform().invoke('system:openExternal', {
        url: getDesktopDownloadPageUrl(webBaseUrl),
      });
    } catch {
      return;
    }
  };

  const dismiss = () => {
    if (!availableVersion) return;
    setDismissedVersion(availableVersion);
    try {
      window.localStorage.setItem(DISMISSED_VERSION_KEY, availableVersion);
    } catch {
      return;
    }
  };

  if (!isPlatformInitialized() || getPlatformAppMode() !== 'electron') return null;

  if (isRequired) {
    return (
      <div className="desktop-update-notice desktop-update-notice--required" role="alert">
        <span>
          Требуется обновление приложения{requiredVersion ? ` до ${requiredVersion}` : ''}.
        </span>
        <button type="button" className="desktop-update-notice__download" onClick={() => void openDownloadPage()}>
          Скачать обновление
        </button>
      </div>
    );
  }

  if (isPartySessionActive) return null;
  if (!availableVersion || dismissedVersion === availableVersion) return null;

  return (
    <div className="desktop-update-notice" role="status" aria-live="polite">
      <span>Доступна новая версия: {availableVersion}</span>
      <button type="button" className="desktop-update-notice__download" onClick={() => void openDownloadPage()}>
        Скачать
      </button>
      <button
        type="button"
        className="desktop-update-notice__dismiss"
        onClick={dismiss}
        aria-label="Скрыть уведомление об обновлении"
      >
        <CloseIcon fontSize="small" />
      </button>
    </div>
  );
};
