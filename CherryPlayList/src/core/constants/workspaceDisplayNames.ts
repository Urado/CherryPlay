const WORKSPACE_DISPLAY_NAMES_RU: Readonly<Record<string, string>> = {
  playlist: 'Плейлист',
  collection: 'Коллекция',
  fileBrowser: 'Браузер',
  player: 'Проигрывание',
  'demo-player': 'Демо-плеер',
  aimp: 'AIMP',
  'party-editor': 'Настройка вечеринки',
  'party-preview': 'Как видят гости',
  drafts: 'Черновики',
  database: 'База данных',
  rules: 'Правила',
  autogenerator: 'Автогенератор',
};

/**
 * Returns a Russian display name for a workspace type.
 * Falls back to module name or raw type when no alias is defined.
 */
export function getWorkspaceDisplayNameRu(type: string, fallbackName?: string): string {
  const knownName = WORKSPACE_DISPLAY_NAMES_RU[type];
  if (knownName) {
    return knownName;
  }

  const testZoneMatch = /^test(\d)$/.exec(type);
  if (testZoneMatch) {
    return `Тестовая зона ${testZoneMatch[1]}`;
  }

  return fallbackName ?? type;
}
