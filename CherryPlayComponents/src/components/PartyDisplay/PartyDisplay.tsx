import React from 'react';

import { getPartyThemeOrDefault, PartyThemeId } from '../../themes';
import { PartyDisplayData } from '../../types';

export interface PartyDisplayProps {
  data: PartyDisplayData;
  className?: string;
  showPlayer?: boolean;
}

export const PartyDisplay: React.FC<PartyDisplayProps> = ({
  data,
  className = '',
  showPlayer = true,
}) => {
  const theme = getPartyThemeOrDefault(data.themeId as PartyThemeId);
  const ThemePartyDisplay = theme.components.PartyDisplay;

  return <ThemePartyDisplay data={data} className={className} showPlayer={showPlayer} />;
};
