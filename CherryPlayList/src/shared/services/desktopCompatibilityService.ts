import { compareDesktopVersions } from './desktopUpdateService';

export interface DesktopCompatibilityWarning {
  minVersion: string;
  serverVersion: string;
}

export type DesktopCompatibilityResult =
  | {
      success: true;
      warning: DesktopCompatibilityWarning | null;
      updateVersion: string | null;
    }
  | { success: false };

const POLICY_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const parseCompatibilityVersion = (version: string): number[] | null => {
  const separator = version.indexOf('-');
  const core = separator < 0 ? version : version.slice(0, separator);
  if (
    separator >= 0 &&
    !version
      .slice(separator + 1)
      .split('.')
      .every((part) => /^[0-9A-Za-z-]+$/.test(part))
  )
    return null;
  const match = POLICY_VERSION_PATTERN.exec(core);
  if (!match) return null;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  return parts.every((part) => Number.isSafeInteger(part) && part <= 2147483647) ? parts : null;
};

export const isDesktopCompatibilityAffected = (current: string, minimum: string): boolean => {
  const currentVersion = parseCompatibilityVersion(current);
  const minimumVersion = parseCompatibilityVersion(minimum);
  if (!currentVersion || !minimumVersion) return false;
  return (
    currentVersion[0] < minimumVersion[0] ||
    (currentVersion[0] === minimumVersion[0] && currentVersion[1] < minimumVersion[1])
  );
};

const parseUpdateVersion = (value: unknown): string | null =>
  typeof value === 'string' && compareDesktopVersions(value, '0.0.0') !== null ? value : null;

const parseWarningPayload = (warning: unknown): DesktopCompatibilityWarning | null => {
  if (warning === null || warning === undefined) return null;
  if (typeof warning !== 'object' || Array.isArray(warning)) return null;
  const { minVersion, serverVersion } = warning as Record<string, unknown>;
  if (
    typeof minVersion !== 'string' ||
    typeof serverVersion !== 'string' ||
    !POLICY_VERSION_PATTERN.test(minVersion) ||
    !POLICY_VERSION_PATTERN.test(serverVersion) ||
    !parseCompatibilityVersion(minVersion) ||
    !parseCompatibilityVersion(serverVersion)
  )
    return null;
  return { minVersion, serverVersion };
};

const parseWarning = (data: unknown): DesktopCompatibilityResult => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { success: false };
  const config = data as Record<string, unknown>;
  return {
    success: true,
    warning: parseWarningPayload(config.desktopCompatibilityWarning),
    updateVersion: parseUpdateVersion(config.desktopUpdateVersion),
  };
};

export const checkDesktopCompatibility = async (
  serverUrl: string,
  signal: AbortSignal,
  fetchConfig: typeof fetch = fetch,
): Promise<DesktopCompatibilityResult> => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 10_000);
  try {
    if (signal.aborted) return { success: false };
    const response = await fetchConfig(`${serverUrl.replace(/\/$/, '')}/api/config`, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok || controller.signal.aborted) return { success: false };
    const data: unknown = await response.json();
    return controller.signal.aborted ? { success: false } : parseWarning(data);
  } catch {
    return { success: false };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
};
