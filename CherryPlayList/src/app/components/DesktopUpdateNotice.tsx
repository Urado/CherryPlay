import CloseIcon from '@mui/icons-material/Close';
import { APP_VERSION } from '@shared/config';
import { getWebBaseUrl } from '@shared/config/serverConfig';
import {
  isDesktopCompatibilitySupported,
  useDesktopCompatibilityWarning,
} from '@shared/hooks/useDesktopCompatibilityWarning';
import {
  getPlatform,
  getPlatformAppMode,
  isPlatformInitialized,
} from '@shared/platform/platformContext';
import { isDesktopCompatibilityAffected } from '@shared/services/desktopCompatibilityService';
import {
  checkLatestDesktopUpdate,
  compareDesktopVersions,
  getDesktopDownloadPageUrl,
} from '@shared/services/desktopUpdateService';
import { useClientOutdatedStore } from '@shared/stores/clientOutdatedStore';
import { useProjectStore } from '@shared/stores/projectStore';
import { useUIStore } from '@shared/stores/uiStore';
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

interface DesktopUpdateNoticeProps {
  children?: (notices: {
    releaseNotice: React.ReactNode;
    compatibilityNotice: React.ReactNode;
  }) => React.ReactNode;
}

export const DesktopUpdateNotice: React.FC<DesktopUpdateNoticeProps> = ({ children }) => {
  const isPartySessionActive = useProjectStore(
    (state) => state.sessionState.mode === 'session' && Boolean(state.meta.linkedParty),
  );
  const isRequired = useClientOutdatedStore((state) => state.isOutdated);
  const requiredVersion = useClientOutdatedStore((state) => state.requiredVersion);
  const compatibility = useDesktopCompatibilityWarning(isPartySessionActive);
  const addNotification = useUIStore((state) => state.addNotification);
  const appMode = getPlatformAppMode();
  const isElectron = isPlatformInitialized() && appMode === 'electron';
  const isBrowserLive =
    isPlatformInitialized() && appMode === 'demo' && isDesktopCompatibilitySupported();
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
    if (!isElectron) return undefined;

    let mounted = true;
    const checkUpdate = async () => {
      if (isPartySessionActive) return;
      const lastChecked = Math.max(lastCheckedAt.current, readStoredTimestamp(LAST_CHECKED_KEY));
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
  }, [isElectron, isPartySessionActive]);

  const openDownloadPage = async () => {
    try {
      const webBaseUrl = await getWebBaseUrl();
      await getPlatform().invoke('system:openExternal', {
        url: getDesktopDownloadPageUrl(webBaseUrl),
      });
    } catch {
      addNotification({
        type: 'error',
        message: 'Не удалось открыть страницу загрузки',
      });
    }
  };

  const dismiss = (version = availableVersion) => {
    if (!version) return;
    setDismissedVersion(version);
    try {
      window.localStorage.setItem(DISMISSED_VERSION_KEY, version);
    } catch {
      return;
    }
  };

  const renderNotices = (
    releaseNotice: React.ReactNode = null,
    compatibilityNotice: React.ReactNode = null,
  ) => {
    if (children) return children({ releaseNotice, compatibilityNotice });
    if (releaseNotice && compatibilityNotice) {
      return (
        <div className="desktop-update-notices">
          {compatibilityNotice}
          {releaseNotice}
        </div>
      );
    }
    return compatibilityNotice ?? releaseNotice;
  };

  if (!isDesktopCompatibilitySupported()) return renderNotices();

  if (isRequired) {
    return renderNotices(
      null,
      <div className="desktop-update-notice desktop-update-notice--required" role="alert">
        <span>
          Требуется обновление приложения{requiredVersion ? ` до ${requiredVersion}` : ''}.
        </span>
        <button
          type="button"
          className="desktop-update-notice__download"
          onClick={() => void openDownloadPage()}
        >
          Скачать обновление
        </button>
      </div>,
    );
  }

  if (isPartySessionActive) return renderNotices();
  const showCompatibilityWarning = Boolean(
    compatibility.warning &&
    isDesktopCompatibilityAffected(String(APP_VERSION), compatibility.warning.minVersion),
  );
  const releaseVersion = isBrowserLive ? compatibility.updateVersion : availableVersion;
  const releaseComparison = releaseVersion
    ? compareDesktopVersions(releaseVersion, String(APP_VERSION))
    : null;
  const showReleaseNotice = Boolean(
    releaseVersion &&
    releaseComparison !== null &&
    releaseComparison > 0 &&
    dismissedVersion !== releaseVersion &&
    (!isBrowserLive || compatibility.canCheck),
  );
  const compatibilityNotice =
    showCompatibilityWarning && !compatibility.dismissed ? (
      <div
        className="desktop-update-notice desktop-update-notice--compatibility"
        role="status"
        aria-live="polite"
      >
        <span>
          С версии сайта {compatibility.warning?.serverVersion} нужны приложения от{' '}
          {compatibility.warning?.minVersion}. У вас {APP_VERSION}.
        </span>
        <button
          type="button"
          className="desktop-update-notice__download"
          onClick={() => void openDownloadPage()}
        >
          Скачать обновление
        </button>
        <button
          type="button"
          className="desktop-update-notice__dismiss"
          onClick={compatibility.dismiss}
          aria-label="Скрыть предупреждение до следующего запуска"
        >
          <CloseIcon fontSize="small" />
        </button>
      </div>
    ) : null;
  const releaseNotice =
    showReleaseNotice && (!showCompatibilityWarning || isBrowserLive) ? (
      <div
        className="desktop-update-notice desktop-update-notice--release"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          className="desktop-update-notice__download"
          onClick={() => void openDownloadPage()}
          aria-label={`Скачать обновление ${releaseVersion}`}
          title="Скачать новую версию приложения"
        >
          {children ? `Обновление ${releaseVersion}` : `Доступна новая версия: ${releaseVersion}`}
        </button>
        <button
          type="button"
          className="desktop-update-notice__dismiss"
          onClick={() => dismiss(releaseVersion)}
          aria-label="Скрыть уведомление об обновлении"
        >
          <CloseIcon fontSize="small" />
        </button>
      </div>
    ) : null;

  return renderNotices(releaseNotice, compatibilityNotice);
};
