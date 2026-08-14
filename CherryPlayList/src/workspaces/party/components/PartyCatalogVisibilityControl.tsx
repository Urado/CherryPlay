import React from 'react';

import {
  PARTY_CATALOG_VISIBILITY_GROUP_LABEL,
  resolvePartyCatalogLabel,
  resolvePartyCatalogVisibilityHint,
} from '../partyCatalogLabels';

import './PartyCatalogVisibilityControl.css';

export interface PartyCatalogVisibilityControlProps {
  isListedInCatalog: boolean;
  disabled?: boolean;
  isUpdating?: boolean;
  networkOffline?: boolean;
  layout?: 'default' | 'header';
  onChange: (listed: boolean) => void;
}

export const PartyCatalogVisibilityControl: React.FC<PartyCatalogVisibilityControlProps> = ({
  isListedInCatalog,
  disabled = false,
  isUpdating = false,
  networkOffline = false,
  layout = 'default',
  onChange,
}) => {
  const isDisabled = disabled || isUpdating;
  const isHeader = layout === 'header';
  const currentLabel = resolvePartyCatalogLabel(isListedInCatalog);
  const selectionHint = resolvePartyCatalogVisibilityHint(isListedInCatalog);

  const disabledTitle = networkOffline ? 'Включите «Онлайн» в настройках' : undefined;

  const optionTitle = (listed: boolean) => {
    if (isDisabled) {
      return disabledTitle ?? resolvePartyCatalogVisibilityHint(listed);
    }
    return resolvePartyCatalogVisibilityHint(listed);
  };

  const selectOption = (listed: boolean) => {
    if (isDisabled || listed === isListedInCatalog) {
      return;
    }
    onChange(listed);
  };

  const options = (
    <div
      className={`party-catalog-visibility-options${isHeader ? ' party-catalog-visibility-options--header' : ''}${isDisabled ? ' party-catalog-visibility-options--disabled' : ''}`}
      role="radiogroup"
      aria-label={PARTY_CATALOG_VISIBILITY_GROUP_LABEL}
      aria-busy={isUpdating}
      title={isDisabled ? disabledTitle : `Сейчас: ${currentLabel}`}
    >
      <button
        type="button"
        role="radio"
        className={`party-catalog-visibility-option${!isListedInCatalog ? ' party-catalog-visibility-option--selected' : ''}`}
        aria-checked={!isListedInCatalog}
        disabled={isDisabled}
        title={optionTitle(false)}
        onClick={() => selectOption(false)}
      >
        {isUpdating && !isListedInCatalog ? '…' : 'По ссылке'}
      </button>
      <button
        type="button"
        role="radio"
        className={`party-catalog-visibility-option${isListedInCatalog ? ' party-catalog-visibility-option--selected party-catalog-visibility-option--listed' : ''}`}
        aria-checked={isListedInCatalog}
        disabled={isDisabled}
        title={optionTitle(true)}
        onClick={() => selectOption(true)}
      >
        {isUpdating && isListedInCatalog ? '…' : 'В каталоге'}
      </button>
    </div>
  );

  if (isHeader) {
    return (
      <div className="party-catalog-visibility party-catalog-visibility--header">{options}</div>
    );
  }

  return (
    <section className="party-catalog-visibility" aria-label={PARTY_CATALOG_VISIBILITY_GROUP_LABEL}>
      <div className="party-catalog-visibility-header">
        <span className="party-catalog-visibility-label">
          {PARTY_CATALOG_VISIBILITY_GROUP_LABEL}
        </span>
        <span className="party-catalog-visibility-hint">{selectionHint}</span>
      </div>
      {options}
    </section>
  );
};
