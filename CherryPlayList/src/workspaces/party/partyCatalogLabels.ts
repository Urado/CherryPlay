export const PARTY_CATALOG_VISIBILITY_GROUP_LABEL = 'Видимость';

export const resolvePartyCatalogLabel = (isListedInCatalog: boolean): string => {
  return isListedInCatalog ? 'В каталоге' : 'По ссылке';
};

export const resolvePartyCatalogVisibilityHint = (isListedInCatalog: boolean): string => {
  return isListedInCatalog ? 'Гости найдут вечеринку в каталоге' : 'Только у кого есть ссылка';
};

export const resolvePartyCatalogToggleHint = (isListedInCatalog: boolean): string => {
  return isListedInCatalog
    ? 'Вечеринка в общем каталоге. Нажмите, чтобы оставить только по ссылке.'
    : 'Вечеринка только по ссылке. Нажмите, чтобы добавить в каталог.';
};
