# Settings Store

Store для хранения настроек приложения.

## Описание

Централизованное хранилище всех пользовательских настроек приложения. Данные сохраняются между сессиями через localforage.

## Основные компоненты

- **settingsStore** (`src/shared/stores/settingsStore.ts`) - Store настроек

## Настройки

- **Экспорт**: Путь для экспорта, стратегия экспорта (copyWithNumberPrefix, aimpPlaylist)
- **UI**: Размеры строк треков (small, medium, large), отсечки по времени (интервал, показывать/скрыть)
- **Аудио**: Выбор устройств для player и demo player; позиция и открытость плавающей панели предпрослушивания (`demoPlayerFloatingPosition`, `demoPlayerFloatingOpen`); опция `playerInAppHeader` для отображения основного плеера в шапке — см. [Demo Player](../systems/demo-player.md#размещение)
- **Нормализация громкости** (`loudnessNormalizationEnabled`, `loudnessTargetLufs`, `loudnessCompressionEnabled`) — см. [Нормализация громкости (loudness v1)](../audio/loudness-normalization.md). Toggles в `SettingsModal`; `loudnessCompressionEnabled` включает **адаптивную** компрессию (strength 0…1 per track). При `!supportsLoudnessAnalysis` (web demo, Capacitor stub) элементы disabled. По умолчанию: нормализация включена, target −18 LUFS, compression выключен.
- **Проекты**: Путь последнего открытого плейлиста
- **Файловый браузер:** `fileBrowserPathsByWorkspaceId` — map `Record<WorkspaceId, string>`; текущая папка **на каждую** зону `fileBrowser` по её `workspaceId`. Legacy `fileBrowserPath` persist для обратной совместимости и зеркала path default-зоны; при записи в default id обновляются оба поля.
- **Онлайн** (`enableStreaming`): связь с сервером и страницей для гостей; при выключении — **«Работа без сети»**. Код и persist — имя `enableStreaming`. Внутренний `networkEnabled` (`onlineNetworkPolicy`) зеркалит этот флаг, но в demo mode политика принудительно держит `networkEnabled=false`; отдельной настройки в UI нет. Party preset/зоны **не** скрываются — см. [Party](../workspaces/party.md).
- **Синхронизация с сайтом:** `streamingSource` — **«Источник состояния для гостей»** (CherryPlay или AIMP); на сайт уходит **состояние** воспроизведения, не аудиопоток.

> **Важно:** Настройки уровня проекта (например, `portableMode`) хранятся в `ProjectSettings` внутри `.cherry` файла и управляются через `projectStore.setPortableMode`. Они **не** являются частью `settingsStore`.

## File browser paths (multi-instance)

| API                                                 | Назначение                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `getFileBrowserPathForWorkspace(workspaceId)`       | Path для зоны; fallback `fileBrowserPath` только для `DEFAULT_FILEBROWSER_WORKSPACE_ID` |
| `setFileBrowserPathForWorkspace(workspaceId, path)` | Сохранить path; для default id также пишет `fileBrowserPath`                            |
| `removeFileBrowserPathForWorkspace(workspaceId)`    | Удалить запись (вызывается из `cleanupWorkspaceInstance` при удалении зоны)             |

**Миграция on rehydrate** (`migrateFileBrowserPathsOnRehydrate`): если в persist есть legacy `fileBrowserPath` и map пуст или без ключа `DEFAULT_FILEBROWSER_WORKSPACE_ID` — значение копируется в map под default id. Отдельный bump версии persist не требуется.

**Deprecated:** `setFileBrowserPath(path)` — делегирует в `setFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID, path)`.

См. [File Browser](../workspaces/file-browser.md), [клиентское persist](../systems/persisted-client-state.md).

## Размеры строк треков

- `small`: padding 8px, margin 2px
- `medium`: padding 12px, margin 4px (по умолчанию)
- `large`: padding 16px, margin 6px

## Отсечки по времени

Настраиваемый интервал (в секундах): 900 (15 мин), 1800 (30 мин), 3600 (1 час), 7200 (2 часа), 10800 (3 часа).

## Резервная копия настроек (экспорт / импорт)

Секция **«Резервная копия настроек»** в `SettingsModal`: кнопки **Экспорт…** / **Импорт…**.

Реализация: `src/shared/services/settingsExportService.ts`; в Electron — диалоги файлов через `ipcService` (`settings:saveBundle`, `settings:loadBundle`); в веб-демо без native FS — скачивание `Blob` / `<input type="file">`.

### Формат bundle (`schemaVersion: 1`)

Файл по умолчанию: `cherryplaylist-settings-bundle.json`.

```typescript
interface SettingsExportBundle {
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string; // ISO
  settings: SettingsExportPersistedState; // поля settingsStore (partialize)
  workspaces: {
    userWorkspaces: UserWorkspace[];
    activeWorkspace?: ActiveWorkspace; // опционально; scratch не экспортируется
  };
}
```

**Экспорт** включает все partialize-поля `settingsStore` (в т.ч. `fileBrowserPathsByWorkspaceId`, `demoPlayerFloatingPosition`, `demoPlayerFloatingOpen`); для совместимости v1 дублируется path default-зоны в `fileBrowserPath` (`pickSettingsExportFields`). Также экспортируются **сохранённые** `userWorkspaces` (снимки layout). Живое дерево `layout` попадает в bundle только если оно уже записано в user workspace (в т.ч. через **auto-commit** при выходе из edit mode или переключении workspace).

**Импорт:**

1. Парсинг JSON, проверка `schemaVersion === 1` и `validateSettingsExportBundle`.
2. Подтверждение в `SettingsImportConfirmDialog`.
3. `settings` — перезапись полей в `useSettingsStore`; `normalizeImportedSettings` мигрирует legacy `fileBrowserPath` → map под `DEFAULT_FILEBROWSER_WORKSPACE_ID`.
4. `userWorkspaces` — merge по `id` (входящий выигрывает; при коллизии имён — суффикс `(2)`, `(3)`, …; это не то же самое, что серия «Без имени N» при auto-save в приложении).
5. `activeWorkspace` применяется, если валиден и не edit mode; `scratch` игнорируется.

Toast после импорта: число полей настроек и сводка по workspace (новые / обновлённые).

### Безопасность

В bundle **нет** токена и сессии организатора — ключ `cherryplaylist-auth` не экспортируется. Валидатор отклоняет JSON с полями `accessToken`, `organizer`, `refreshToken`. См. [клиентское persist](../systems/persisted-client-state.md).

## См. также

- [Клиентское persist](../systems/persisted-client-state.md) — ключ `cherryplaylist-workspaces`
- [Layout System](../systems/layout-system.md) — пользовательские workspace presets
