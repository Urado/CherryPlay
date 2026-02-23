import React, { useMemo } from 'react';

import type { PartyThemeId } from '../../themes';
import { getThemeMetadata } from '../../themes/themeMetadata';

export function usePartyThemeVars(
  partyThemeId: PartyThemeId,
  customizationSettings?: Record<string, string | number>,
): React.CSSProperties {
  return useMemo(() => {
    const vars: Record<string, string> = {};
    const metadata = getThemeMetadata(partyThemeId);

    if (!customizationSettings || !metadata) {
      return vars as React.CSSProperties;
    }

    for (const option of metadata.customizationOptions) {
      const value = customizationSettings[option.key];
      if (value !== undefined && value !== null) {
        if (option.transform) {
          vars[`--${option.key}`] = option.transform(value);
        } else {
          vars[`--${option.key}`] = String(value);
        }
      }
    }

    return vars as React.CSSProperties;
  }, [partyThemeId, customizationSettings]);
}
