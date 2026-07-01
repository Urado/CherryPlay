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
export const ERROR_PARTY_NOT_FOUND = 'Вечеринка не найдена на сервере';
export const ERROR_CONNECTION = 'Ошибка соединения с сервером';
export const THEME_ACCESS_FALLBACK_ERROR =
  'Не удалось проверить доступ к темам. Для безопасности доступны только базовая и текущая темы.';

export const REVOKED_THEME_PACKAGE_CODE = 'revoked-current-theme';
export const REVOKED_THEME_PACKAGE_NAME = 'Не доступна в пакетах';

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
  const firstRequiredPackage = error.requiredPackageCodes[0];
  const lockedThemeInfo = firstRequiredPackage
    ? resolveLockedThemeByPackageCode(access, firstRequiredPackage)
    : null;
  const resolvedPackageLabel = lockedThemeInfo?.packageName ?? firstRequiredPackage ?? null;
  if (resolvedPackageLabel) {
    return `Тема доступна в пакете "${resolvedPackageLabel}".`;
  }

  return 'У вас нет доступа к выбранной теме.';
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
