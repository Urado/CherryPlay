# Test Zone

Тестовый workspace-модуль для разработки и отладки layout системы.

## Описание

`TestZone` предоставляет простые тестовые workspace, которые используются для:

- проверки работы split containers и динамического layout;
- проверки регистрации workspace-модулей в реестре;
- визуальной отладки сложных конфигураций зон.

Модуль не предназначен для production-использования. Типы **`test1`…`test8`** регистрируются **всегда** (side-effect import `@workspaces/testZone` в `entry.tsx`). В picker «добавить зону» (`getWorkspacePickerOptions`) они **всегда скрыты** (даже в DEV) — discoverability only; уже открытые зоны в layout **продолжают рендериться**.

## Структура модуля

```
src/workspaces/testZone/
├── TestZoneView.tsx    # Компонент тестовой зоны
├── index.ts            # Регистрация всех test типов
└── README.md           # Документация модуля уровня workspace
```

## Основные компоненты

- **TestZoneView** (`src/workspaces/testZone/TestZoneView.tsx`) — простой компонент, отображающий `workspaceId` и `zoneId` для наглядной отладки.

## Регистрация и типы workspace

В `index.ts` регистрируются несколько тестовых workspace-типов:

- `test1` … `test8` — восемь различных workspace-типов, использующих один и тот же `TestZoneView`.

При импорте модуля регистрируются все эти типы в `WorkspaceRegistry`. Добавить их из UI picker в [режиме редактирования layout](../../layout-edit-mode.md) **нельзя**; зоны остаются доступны для фабрик/тестов и для уже сохранённых layout.

## Назначение и использование

- Используется для проверки:
  - корректной работы split-контейнеров;
  - динамического создания и удаления workspace-зон;
  - поведения layout при сложных вложенных структурах.
- Обычно применяется при разработке и отладке layout (типы всегда в реестре; см. [Layout System — минимальные размеры](../systems/layout-system.md#минимальные-размеры-зон) — `test1`…`test8`: **150×100** px).

В production-сборке модуль может быть отключён или удалён в будущем; сейчас скрытие — только из picker/меню, без удаления регистрации.

## См. также

- [Режим редактирования layout](../../layout-edit-mode.md) — типы `test1`…`test8` **не** в picker; registration/render сохранены
- [Layout System — минимальные размеры зон](../systems/layout-system.md#минимальные-размеры-зон)
