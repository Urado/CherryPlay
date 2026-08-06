import {
  getDefaultCustomizationSettings,
  normalizeBasicThemePaletteSettings,
  type PartyThemeId,
} from '@cherryplay/components';

import {
  ThemeAccessDto,
  LockedThemeDto,
  ThemeNotEntitledError,
} from '@shared/services/partyService';

export const RECONNECT_INTERVAL_MS = 60_000;
export { ERROR_PARTY_NOT_FOUND, ERROR_CONNECTION } from './partyWorkspaceConstants';
export const THEME_ACCESS_FALLBACK_ERROR =
  'Не удалось проверить доступ к темам. Доступны только базовая и текущая темы.';

export function resolveDisplayPartyName(
  partyName: string | null | undefined,
  projectName: string | null | undefined,
  fallback = 'Вечеринка',
): string {
  const trimmedParty = partyName?.trim() ?? '';
  if (trimmedParty.length > 0) {
    return trimmedParty;
  }
  const trimmedProject = projectName?.trim() ?? '';
  if (trimmedProject.length > 0) {
    return trimmedProject;
  }
  return fallback;
}

export const REVOKED_THEME_PACKAGE_CODE = 'revoked-current-theme';
export const REVOKED_THEME_PACKAGE_NAME = 'Не доступна в пакетах';

const UNAVAILABLE_PACKAGE_LABELS = new Set([
  REVOKED_THEME_PACKAGE_NAME,
  'Недоступно',
  'недоступно',
]);

export function isUnavailableThemePackageLabel(packageName: string | null | undefined): boolean {
  if (!packageName) {
    return false;
  }
  const trimmed = packageName.trim();
  return UNAVAILABLE_PACKAGE_LABELS.has(trimmed);
}

export function buildThemeLockInfoMessage(packageName: string): string {
  if (isUnavailableThemePackageLabel(packageName)) {
    return 'Тема не доступна в ваших пакетах';
  }
  return `Доступно в пакете ${packageName}`;
}

export function buildThemeLockAriaLabel(themeName: string, packageName: string): string {
  if (isUnavailableThemePackageLabel(packageName)) {
    return `${themeName}. Тема не доступна в ваших пакетах.`;
  }
  return `${themeName}. Требуется пакет ${packageName}.`;
}

export function isThemeGranted(themeId: string, access: ThemeAccessDto | null): boolean {
  if (!access) {
    return false;
  }
  return access.grantedThemeIds.some((id) => id === themeId);
}

export function isThemeNotEntitledError(error: unknown): error is ThemeNotEntitledError {
  return error instanceof ThemeNotEntitledError;
}

export function resolveLockedThemeByPackageCode(
  access: ThemeAccessDto | null,
  packageCode: string,
): LockedThemeDto | null {
  if (!access) {
    return null;
  }
  return access.visibleLockedThemes.find((item) => item.packageCode === packageCode) ?? null;
}

export function buildThemeNotEntitledMessage(
  error: ThemeNotEntitledError,
  access: ThemeAccessDto | null,
): string {
  const firstRequiredPackage = error.requiredPackageCodes[0] ?? null;
  const lockedThemeInfo = firstRequiredPackage
    ? resolveLockedThemeByPackageCode(access, firstRequiredPackage)
    : null;

  const resolvedPackageName = lockedThemeInfo?.packageName ?? null;
  if (resolvedPackageName) {
    if (!isUnavailableThemePackageLabel(resolvedPackageName)) {
      return `Тема доступна в пакете "${resolvedPackageName}".`;
    }
    return 'Тема не доступна в ваших пакетах';
  }

  if (firstRequiredPackage === REVOKED_THEME_PACKAGE_CODE) {
    return 'Тема не доступна в ваших пакетах';
  }

  return 'Тема не доступна в ваших пакетах';
}

export function resolveLoadedCustomizationSettings(
  resolvedThemeId: PartyThemeId,
  customizationSettings: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const defaults = getDefaultCustomizationSettings(resolvedThemeId);
  const hasMeaningful =
    customizationSettings &&
    typeof customizationSettings === 'object' &&
    !Array.isArray(customizationSettings) &&
    Object.keys(customizationSettings).length > 0;

  if (!hasMeaningful) {
    return defaults as Record<string, unknown>;
  }

  const raw = customizationSettings as Record<string, unknown>;
  if (resolvedThemeId === 'basic') {
    return normalizeBasicThemePaletteSettings({
      ...defaults,
      ...raw,
    }) as Record<string, unknown>;
  }

  return { ...defaults, ...raw } as Record<string, unknown>;
}

export function normalizeCustomizationSettings(
  settings: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!settings) {
    return undefined;
  }

  const normalized = Object.entries(settings).reduce(
    (acc, [key, value]) => {
      if (value === null || value === undefined) {
        return acc;
      }

      const valueType = typeof value;
      if (valueType === 'string') {
        acc[key] = value as string;
      } else if (valueType === 'number' && !isNaN(value as number) && isFinite(value as number)) {
        acc[key] = value as number;
      } else if (key === 'basicUserSavedPalettes' && Array.isArray(value)) {
        acc[key] = value;
      } else if (valueType === 'object' && !Array.isArray(value)) {
        acc[key] = value as Record<string, unknown>;
      }
      return acc;
    },
    {} as Record<string, unknown>,
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
