# Settings Store

Store для хранения настроек приложения.

## Описание

Централизованное хранилище всех пользовательских настроек приложения. Данные сохраняются между сессиями через localforage.

## Основные компоненты

- **settingsStore** (`src/shared/stores/settingsStore.ts`) - Store настроек

## Настройки

- **Экспорт**: Путь для экспорта, стратегия экспорта (copyWithNumberPrefix, aimpPlaylist)
- **UI**: Размеры строк треков (small, medium, large), отсечки по времени (интервал, показывать/скрыть)
- **Аудио**: Выбор устройств для player и demo player
- **Проекты**: Путь последнего открытого плейлиста
- **Файловый браузер**: Текущая папка (fileBrowserPath) — одна на всё приложение, сохраняется при переключении воркспейсов и между сессиями
- **Стриминг**: Включение/выключение модуля стриминга (enableStreaming)

> **Важно:** Настройки уровня проекта (например, `portableMode`) хранятся в `ProjectSettings` внутри `.cherry` файла и управляются через `projectStore.setPortableMode`. Они **не** являются частью `settingsStore`.

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

**Экспорт** включает все partialize-поля `settingsStore` и **сохранённые** `userWorkspaces` (снимки layout). Живое дерево `layout` попадает в bundle только если оно уже записано в user workspace (в т.ч. через **auto-commit** при выходе из edit mode или переключении workspace).

**Импорт:**

1. Парсинг JSON, проверка `schemaVersion === 1` и `validateSettingsExportBundle`.
2. Подтверждение в `SettingsImportConfirmDialog`.
3. `settings` — перезапись полей в `useSettingsStore`.
4. `userWorkspaces` — merge по `id` (входящий выигрывает; при коллизии имён — суффикс `(2)`, `(3)`, …; это не то же самое, что серия «Без имени N» при auto-save в приложении).
5. `activeWorkspace` применяется, если валиден и не edit mode; `scratch` игнорируется.

Toast после импорта: число полей настроек и сводка по workspace (новые / обновлённые).

### Безопасность

В bundle **нет** токена и сессии организатора — ключ `cherryplaylist-auth` не экспортируется. Валидатор отклоняет JSON с полями `accessToken`, `organizer`, `refreshToken`. См. [клиентское persist](../systems/persisted-client-state.md).

## См. также

- [Клиентское persist](../systems/persisted-client-state.md) — ключ `cherryplaylist-workspaces`
- [Layout System](../systems/layout-system.md) — пользовательские workspace presets
