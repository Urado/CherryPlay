import React from 'react';

import { resolvePartyCatalogLabel } from '../partyCatalogLabels';

import './PartySettingsCatalogStatusChip.css';

export interface PartySettingsCatalogStatusChipProps {
  isListedInCatalog: boolean;
  visible: boolean;
  onFocusCatalog?: () => void;
}

export const PartySettingsCatalogStatusChip: React.FC<PartySettingsCatalogStatusChipProps> = ({
  isListedInCatalog,
  visible,
  onFocusCatalog,
}) => {
  if (!visible) {
    return null;
  }

  const label = resolvePartyCatalogLabel(isListedInCatalog);
  const listed = isListedInCatalog;
  const ariaLabel = `${label}. Перейти к настройкам каталога`;

  return (
    <button
      type="button"
      className={`party-settings-catalog-status-chip${listed ? ' party-settings-catalog-status-chip--listed' : ''}`}
      onClick={onFocusCatalog}
      aria-label={ariaLabel}
      title="Перейти к настройкам каталога"
    >
      {label}
    </button>
  );
};
