# Settings Store

Store для хранения настроек приложения.

## Описание

Централизованное хранилище всех пользовательских настроек приложения. Данные сохраняются между сессиями через localforage.

## Основные компоненты

- **settingsStore** (`src/shared/stores/settingsStore.ts`) - Store настроек

## Настройки

- **Экспорт**: Путь для экспорта, стратегия экспорта (copyWithNumberPrefix, aimpPlaylist)
- **UI**: Размеры строк треков (small, medium, large), отсечки по времени (интервал, показывать/скрыть)
- **Аудио / воспроизведение** (порядок в `SettingsModal`, секция **«Проигрывание»**): сначала **«Источник проигрывания»** (`streamingSource` — CherryPlay или AIMP; пункт всегда виден, AIMP disabled вне десктопа / при недоступности моста; на сайт уходит **состояние** воспроизведения, не аудиопоток), затем устройства вывода («Куда играет CherryPlay» и demo player). Выбор устройств для player и demo player; позиция и открытость плавающей панели предпрослушивания (`demoPlayerFloatingPosition`, `demoPlayerFloatingOpen`) — см. [Demo Player](../systems/demo-player.md#размещение). Настройки «Показывать плеер в шапке» / `playerInAppHeader` **нет** (основной плеер только в layout-зоне `player`).
- **Нормализация громкости** (`loudnessNormalizationEnabled`, `loudnessTargetLufs`, `loudnessCompressionEnabled`, `loudnessQuietGapRangeLu`) — см. [Нормализация громкости (loudness v1)](../audio/loudness-normalization.md). UI в глобальном `TrackSettingsModal` плеера (шестерёнка, `isGlobal: true`), не в app `SettingsModal`. `loudnessCompressionEnabled` включает **адаптивную** компрессию (strength 0…1 per track). При `!supportsLoudnessAnalysis` (Capacitor stub) элементы disabled; в web demo скан симулируется фикстурами. По умолчанию: нормализация включена, target −18 LUFS, compression выключен.
- **Проекты**: Путь последнего открытого плейлиста. **Переносимый проект** — не чекбокс в настройках: в секции **«Настройки проекта»** текстовая подсказка на **Файл** → **Сохранить как…** → **«Переносимый проект»**; флаг `portableMode` хранится в `.cherry` ([Save/Load](../systems/save-load.md)).
- **Файлы** (`fileBrowser`): `fileBrowserPathsByWorkspaceId` — map `Record<WorkspaceId, string>`; текущая папка **на каждую** зону `fileBrowser` по её `workspaceId`. Legacy `fileBrowserPath` persist для обратной совместимости и зеркала path default-зоны; при записи в default id обновляются оба поля.
- **Онлайн** (`enableStreaming`): связь с сервером и страницей для гостей; при выключении — **«Работа без сети»**. Код и persist — имя `enableStreaming`. Внутренний `networkEnabled` (`onlineNetworkPolicy`) зеркалит этот флаг (в т.ч. в web demo fixtures/live); отдельной настройки в UI нет. SignalR hub стартует только при Online ON **и** `supportsRealAuth` (Electron или live demo) — fixtures не поднимают hub. Party preset/зоны **не** скрываются — см. [Party](../workspaces/party.md), [веб-демо](../../web-demo.md).

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
    builtinLayoutOverrides?: BuiltinLayoutOverrides; // Partial<Record<LayoutPreset, Layout>>
    activeWorkspace?: ActiveWorkspace; // опционально; scratch не экспортируется
  };
}
```

**Экспорт** включает все partialize-поля `settingsStore` (в т.ч. `fileBrowserPathsByWorkspaceId`, `demoPlayerFloatingPosition`, `demoPlayerFloatingOpen`); для совместимости v1 дублируется path default-зоны в `fileBrowserPath` (`pickSettingsExportFields`). Также экспортируются **сохранённые** `userWorkspaces` и **`builtinLayoutOverrides`** (structural-override встроенных пресетов). Живое дерево `layout` попадает в bundle через user workspace или через override (в т.ч. после **auto-commit** structural-правок builtin).

**Импорт:**

1. Парсинг JSON, проверка `schemaVersion === 1` и `validateSettingsExportBundle`.
2. Подтверждение в `SettingsImportConfirmDialog`.
3. `settings` — перезапись полей в `useSettingsStore`; `normalizeImportedSettings` мигрирует legacy `fileBrowserPath` → map под `DEFAULT_FILEBROWSER_WORKSPACE_ID`.
4. `userWorkspaces` — merge по `id` (входящий выигрывает; при коллизии имён — суффикс `(2)`, `(3)`, …; это не то же самое, что серия «Без имени N» при auto-save scratch).
5. `builtinLayoutOverrides` — merge по preset (входящий выигрывает; отсутствующее поле в старых bundle — без изменений текущих overrides).
6. `activeWorkspace` применяется, если валиден и не edit mode; `scratch` игнорируется.

Успешный импорт **без toast** (диалог закрывается, настройки и workspace применяются). Toast — только при **ошибке** чтения/разбора/применения bundle.

### Безопасность

В bundle **нет** токена и сессии организатора — ключ `cherryplaylist-auth` не экспортируется. Валидатор отклоняет JSON с полями `accessToken`, `organizer`, `refreshToken`. См. [клиентское persist](../systems/persisted-client-state.md).

## См. также

- [Клиентское persist](../systems/persisted-client-state.md) — ключ `cherryplaylist-workspaces` (`userWorkspaces`, `builtinLayoutOverrides`)
- [Layout System](../systems/layout-system.md) — builtin override + **Мои**
- [Веб-демо](../../web-demo.md) — Online / `networkEnabled` в fixtures и live
