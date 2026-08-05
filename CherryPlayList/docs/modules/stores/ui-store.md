# UI Store

Глобальный store для управления UI состоянием приложения.

## Описание

Централизованный store для управления модальными окнами, уведомлениями, состоянием drag-and-drop и реестром workspace.

## Основные компоненты

- **uiStore** (`src/shared/stores/uiStore.ts`) - Главный store UI состояния

## Функциональность

- **Модальные окна**: Управление открытием/закрытием модальных окон (settings, export, trackSettings)
- **Уведомления**: Система toast-уведомлений с автоматическим удалением через таймеры
- **Drag-and-Drop**: Глобальное состояние перетаскивания (`draggedItems`, `isCopyMode`)
- **Workspace Registry**: Реестр всех workspace в приложении (id, type, name, zoneId)
- **File Browser Focus**: Запрос фокуса на файл в FileBrowser (кнопка «Показать в файлах»); **один** инстанс на запрос
- **Active Source**: Текущий активный источник треков (`fileBrowser`, `playlists`, `db`) — глобальный; per-zone переключатель **вне MVP**

## Типы уведомлений

API `addNotification` принимает:

- `success` — зарезервирован в типе; **рутинные подтверждения успеха в UI не показывают**
- `error` — ошибка
- `info` — зарезервирован; **рутинные info-подтверждения не показывают**
- `warning` — предупреждение / проблема / blocked-feature (в т.ч. «Не доступно в демо»)

**Политика UX:** toast — для ошибок и проблемных предупреждений; успешные операции (save, add workspace, settings import, export) проходят молча.

## Модальные окна

- `settings` - Настройки приложения
- `export` - Настройки экспорта
- `trackSettings` - Настройки трека/группы

## File Browser Focus

Scoped focus для «Показать в файлах» / demo player:

```typescript
fileBrowserFocusRequest: {
  path: string;
  targetWorkspaceId: WorkspaceId; // уже разрешённый id
  timestamp: number;
} | null;
```

| Метод | Поведение |
|-------|-----------|
| `focusFileInBrowser(path, targetWorkspaceId?)` | Разрешает цель через `resolveFileBrowserFocusTarget`, выставляет request |
| `acknowledgeFileBrowserFocus()` | Сбрасывает request; вызывает matching `FileBrowser` после обработки |

**Порядок разрешения цели** (`resolveFileBrowserFocusTarget`):

1. Явный `targetWorkspaceId`, если такая `fileBrowser`-зона есть в layout;
2. зона с `DEFAULT_FILEBROWSER_WORKSPACE_ID`;
3. первая `fileBrowser`-зона в порядке `collectWorkspaceZones`.

Только `FileBrowser` с `workspaceId === targetWorkspaceId` реагирует на request. Типичный вызов без второго аргумента — `AppHeader` / demo player.

См. [File Browser](../workspaces/file-browser.md).
