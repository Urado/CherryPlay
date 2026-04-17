import React, { useMemo } from 'react';

import type { PartyThemeId } from '../../themes';
import { resolveBasicThemeCssSettings } from '../../themes/base/colors';
import { getThemeMetadata } from '../../themes/themeMetadata';

export function usePartyThemeVars(
  partyThemeId: PartyThemeId,
  customizationSettings?: Record<string, unknown>,
): React.CSSProperties {
  return useMemo(() => {
    const vars: Record<string, string> = {};
    const metadata = getThemeMetadata(partyThemeId, customizationSettings);

    if (!metadata) {
      return vars as React.CSSProperties;
    }

    const mergedSettings =
      partyThemeId === 'basic'
        ? resolveBasicThemeCssSettings(customizationSettings)
        : {
            ...metadata.defaultCustomizationSettings,
            ...(customizationSettings || {}),
          };

    const optionByKey = new Map(metadata.customizationOptions.map((o) => [o.key, o]));

    const allowedKeys =
      partyThemeId === 'basic'
        ? Object.keys(mergedSettings)
        : metadata.customizationOptions.map((option) => option.key);

    for (const key of allowedKeys) {
      const value = mergedSettings[key as keyof typeof mergedSettings];
      const option = optionByKey.get(key);
      if (value === undefined || value === null) continue;

      const transformedValue =
        option?.transform && (typeof value === 'string' || typeof value === 'number')
          ? option.transform(value)
          : String(value);

      vars[`--${key}`] = transformedValue;
    }

    return vars as React.CSSProperties;
  }, [partyThemeId, customizationSettings]);
}
