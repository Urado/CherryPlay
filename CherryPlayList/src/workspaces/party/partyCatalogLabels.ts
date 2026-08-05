export function resolvePartyCatalogLabel(isListedInCatalog: boolean): string {
  return isListedInCatalog ? 'В каталоге' : 'По ссылке';
}

export function resolvePartyCatalogToggleHint(isListedInCatalog: boolean): string {
  return isListedInCatalog
    ? 'Вечеринка в общем каталоге. Нажмите, чтобы оставить только по ссылке.'
    : 'Вечеринка только по ссылке. Нажмите, чтобы добавить в каталог.';
}
