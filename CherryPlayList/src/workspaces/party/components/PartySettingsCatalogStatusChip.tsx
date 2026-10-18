import React from 'react';

import { resolvePartyCatalogLabel } from '../partyCatalogLabels';

import './PartySettingsCatalogStatusChip.css';

export interface PartySettingsCatalogStatusChipProps {
  isListedInCatalog: boolean;
  visible: boolean;
  onFocusVisibility?: () => void;
}

export const PartySettingsCatalogStatusChip: React.FC<PartySettingsCatalogStatusChipProps> = ({
  isListedInCatalog,
  visible,
  onFocusVisibility,
}) => {
  if (!visible) {
    return null;
  }

  const label = resolvePartyCatalogLabel(isListedInCatalog);
  const listed = isListedInCatalog;
  const ariaLabel = `${label}. Перейти к настройкам видимости`;

  return (
    <button
      type="button"
      className={`party-settings-catalog-status-chip${listed ? ' party-settings-catalog-status-chip--listed' : ''}`}
      onClick={onFocusVisibility}
      aria-label={ariaLabel}
      title="Перейти к настройкам видимости"
    >
      {label}
    </button>
  );
};
