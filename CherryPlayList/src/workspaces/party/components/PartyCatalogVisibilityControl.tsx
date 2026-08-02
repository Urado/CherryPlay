import { Button } from '@cherryplay/components';
import React from 'react';

import './PartyCatalogVisibilityControl.css';

export interface PartyCatalogVisibilityControlProps {
  isListedInCatalog: boolean;
  disabled?: boolean;
  isUpdating?: boolean;
  networkOffline?: boolean;
  layout?: 'default' | 'header';
  onChange: (listed: boolean) => void;
}

function getCatalogLabel(isListedInCatalog: boolean): string {
  return isListedInCatalog ? 'В каталоге' : 'По ссылке';
}

function getCatalogToggleHint(isListedInCatalog: boolean): string {
  return isListedInCatalog
    ? 'Вечеринка в общем каталоге. Нажмите, чтобы оставить только по ссылке.'
    : 'Вечеринка только по ссылке. Нажмите, чтобы добавить в каталог.';
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
  const label = getCatalogLabel(isListedInCatalog);

  const disabledTitle = networkOffline
    ? 'Включите «Онлайн» в настройках'
    : 'Недоступно без подключения к серверу';

  const toggleButton = (
    <Button
      type="button"
      className={`party-catalog-visibility-toggle${isListedInCatalog ? ' party-catalog-visibility-toggle--listed' : ''}${isHeader ? ' party-catalog-visibility-toggle--header' : ''}${isDisabled ? ' party-catalog-visibility-toggle--disabled' : ''}`}
      disabled={isDisabled}
      aria-pressed={isListedInCatalog}
      aria-label={`Каталог: ${label}`}
      aria-busy={isUpdating}
      title={isDisabled ? disabledTitle : getCatalogToggleHint(isListedInCatalog)}
      onClick={() => onChange(!isListedInCatalog)}
      variant="secondary"
      size="sm"
    >
      {isUpdating ? '…' : label}
    </Button>
  );

  if (isHeader) {
    return (
      <div className="party-catalog-visibility party-catalog-visibility--header">
        {toggleButton}
      </div>
    );
  }

  return (
    <section className="party-catalog-visibility" aria-label="Видимость в каталоге">
      <div className="party-catalog-visibility-header">
        <span className="party-catalog-visibility-label">Каталог</span>
        <span className="party-catalog-visibility-hint">
          Отдельно от статуса вечеринки на сайте
        </span>
      </div>
      {toggleButton}
    </section>
  );
};
