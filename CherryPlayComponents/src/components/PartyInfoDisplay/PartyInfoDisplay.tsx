import React from 'react';

import { getPartyThemeOrDefault, PartyThemeId } from '../../themes';
import type { PartyInfoDisplayData } from '../../themes/base/PartyInfoDisplay';

export interface PartyInfoDisplayProps {
  data: PartyInfoDisplayData;
  className?: string;
}

export const PartyInfoDisplay: React.FC<PartyInfoDisplayProps> = ({ data, className = '' }) => {
  const theme = getPartyThemeOrDefault(data.themeId as PartyThemeId);
  const ThemePartyInfoDisplay = theme.components.PartyInfoDisplay;

  return <ThemePartyInfoDisplay data={data} className={className} />;
};

export type {
  BasePartyInfoDisplayProps,
  PartyInfoDisplayData,
} from '../../themes/base/PartyInfoDisplay';
