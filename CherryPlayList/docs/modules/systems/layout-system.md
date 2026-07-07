# Layout System

Универсальная система управления layout интерфейса с рекурсивными контейнерами.

## Описание

Гибкая система для создания сложных многооконных layout с вложенными контейнерами. Поддерживает горизонтальное и вертикальное разделение зон, изменение размеров через drag dividers.

Состояние layout — часть **рабочих пространств** (workspace presets, Premiere-style): встроенные пресеты, пользовательские именованные снимки и эфемерный scratch «с нуля». См. [клиентское persist](./persisted-client-state.md).

## Основные компоненты

- **layoutStore** (`src/shared/stores/layoutStore.ts`) — store дерева layout и рабочих пространств
- **WorkspaceMenu** (`src/app/components/WorkspaceMenu.tsx`) — pill + меню в шапке
- **SplitContainer** (`src/app/components/SplitContainer.tsx`) — рекурсивный контейнер
- **WorkspaceRenderer** (`src/app/WorkspaceRenderer.tsx`) — рендерер workspace в зонах

## Структура данных

- `Zone` — либо workspace zone, либо container zone
- `WorkspaceZone` — зона с workspace (id, workspaceId, workspaceType, size)
- `ContainerZone` — контейнер с вложенными зонами (direction, zones[], sizes[])

Типы — `src/core/types/workspacePreset.ts`:

| Тип                            | Описание                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `ActiveWorkspace`              | `{ kind: 'builtin'; preset }` \| `{ kind: 'user'; id }` \| `{ kind: 'scratch' }` |
| `UserWorkspace`                | `{ id, name, layout, createdAt?, updatedAt? }` — сохранённый снимок дерева       |
| `LayoutPreset`                 | Идентификатор встроенного пресета (`simple`, `collections`, …)                   |
| `UNNAMED_WORKSPACE_NAME`       | `'Без имени'` — базовое auto-имя                                                 |
| `allocateUnnamedWorkspaceName` | Следующее свободное auto-имя в серии «Без имени» / «Без имени N»                 |
| `isUnnamedWorkspaceName`       | Проверка auto-имени (курсив в pill, ограничения при ручном rename)               |

**Дерево `layout`** — живое runtime-состояние зон. **Пользовательские workspace** хранят полные копии в `userWorkspaces[]`. Встроенные пресеты **не** персистятся как записи — при активации дерево строится через `createLayoutByPreset(preset)` (`layoutPresetFactories.ts`).

### Именование пользовательских workspace (auto-save)

| Шаг                             | Имя в **Мои**      |
| ------------------------------- | ------------------ |
| 1-й auto-save (нет «Без имени») | **Без имени**      |
| 2-й при занятом «Без имени»     | **Без имени 2**    |
| далее                           | **Без имени 3**, … |

Реализация: `allocateUnnamedWorkspaceName()` в `workspacePreset.ts`, вызов из `saveCurrentWorkspaceAsUnnamed()` в `layoutStore`. После переименования единственного «Без имени» слот снова доступен.

## Рабочие пространства

### Встроенные (built-in)

Фабрики пресетов — `layoutPresetFactories.ts` (`createLayoutByPreset`, `createSimpleLayout`, `createCollectionsLayout`, `createPartyLayout` и др.); сигнатуры сопоставления — `layoutPreset.ts` (`getLayoutPresetFromLayout`). Имена в UI — на русском (`LAYOUT_PRESET_DISPLAY_NAMES_RU` в `src/core/constants/layoutPresetDisplayNames.ts`, меню `WorkspaceMenu`).

| `LayoutPreset`         | Отображаемое имя      | Доступность                                                      |
| ---------------------- | --------------------- | ---------------------------------------------------------------- |
| `simple`               | Плейлист + источники  | всегда                                                           |
| `complex`              | Сложный               | только `import.meta.env.DEV`                                     |
| `collections`          | Сборка плейлиста      | всегда; **по умолчанию** при первом запуске                      |
| `collections-vertical` | Коллекции вертикально | всегда                                                           |
| `player`               | Проигрывание          | всегда                                                           |
| `party`                | Онлайн-вечеринка      | если `enableStreaming` (в UI — **Онлайн** включён)               |
| `aimp-party`           | AIMP + Party          | **legacy:** не показывается в меню; persist мигрирует на `party` |

Встроенные layout **нельзя перезаписать**. При auto-commit с dirty built-in/scratch вызывается `saveCurrentWorkspaceAsUnnamed()` (имя по `allocateUnnamedWorkspaceName`).

### Пользовательские (Мои)

- Создаются автоматически при правке built-in/scratch (часто с именем **«Без имени»**) или при явном именовании scratch в pill.
- **Переименование:** клик по имени в pill (inline) или ⋯ → «Переименовать…» в меню.
- **Удаление:** ⋯ → «Удалить…» (с подтверждением). При удалении активного — fallback на built-in `collections`.
- Имена уникальны при ручном переименовании. Auto-save: первый — **«Без имени»**, далее **«Без имени 2»**, **«Без имени 3»**, …

### Scratch («Создать с нуля…»)

`activeWorkspace: { kind: 'scratch' }`, пустое дерево. В pill — **«Без имени»**. **Сразу включается edit mode.** В persist **не** попадает (`normalizeWorkspacePersistSlice` → `collections` при rehydrate). Сохранение — через auto-commit при выходе/переключении или через ввод имени в pill (`saveCurrentWorkspaceAs`).

### Переключение и автосохранение

| API                            | Поведение                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `activateWorkspace(ref)`       | Смена workspace; cleanup/prepare lifecycle для зон                                          |
| `autoCommitWorkspaceChanges()` | При dirty: user → `saveCurrentWorkspace`; builtin/scratch → `saveCurrentWorkspaceAsUnnamed` |
| `requestActivateWorkspace`     | Auto-commit, затем switch (`useWorkspaceDirtyGuard`)                                        |
| `isWorkspaceDirty()`           | `getLayoutZoneSignature(layout)` ≠ baseline (runtime)                                       |

Переключение через **▾** **заблокировано** в `isLayoutEditMode`. Вне edit mode при dirty — **тихий** auto-commit перед switch (без диалогов).

### Коллекции и `workspaceId`

Данные коллекций (`cherryplaylist-<workspaceId>`) привязаны к **`workspaceId` в дереве**, не к имени workspace. См. [persisted-client-state.md](./persisted-client-state.md).

## Функциональность

- Рекурсивная структура (до 6 уровней вложенности)
- Процентное распределение размеров (сумма = 100%)
- Минимальный размер зоны: 10px
- Автоматическая очистка контейнеров с 1 дочерним элементом
- Persist `cherryplaylist-workspaces` — [persisted-client-state.md](./persisted-client-state.md)
- **Режим редактирования** — [layout-edit-mode.md](../../layout-edit-mode.md)

## UI в шапке

```
[ Имя (210px)  ▾ ]  [ ✎ ]
```

| Элемент | Назначение                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Имя** | Активный workspace; клик → inline rename (user/scratch, в т.ч. в edit mode); серия «Без имени» / «Без имени N» — курсивом |
| **▾**   | Меню: **Мои** / **Встроенные** / **Создать с нуля…** (disabled в edit mode)                                               |
| **✎**   | Вход/выход из edit mode; выход с auto-commit при dirty                                                                    |

Ручных пунктов **Сохранить** / **Сбросить** нет. При переключении workspace и auto-commit блокирующих диалогов нет.

## Режим редактирования (кратко)

- **✎** или **Создать с нуля…**; **Esc** — выход с auto-commit.
- `isLayoutEditMode` **не** персистится.
- **`LayoutEditModeBanner`** — полоса над шапкой («Редактирование окон — Esc для выхода») при активном режиме (`App.tsx`).
- Рендер: `LayoutWorkspaceArea` (см. дерево решений ниже) → `SplitContainer` (+ `WorkspaceLayoutEditContainerShell` при 2+ зонах) / `WorkspaceLayoutEditShell` / `LayoutEmptyWorkspaceState`.

### `LayoutWorkspaceArea`: дерево рендера

```
isLayoutEmpty(layout)?
├─ да + isLayoutEditMode → LayoutEmptyWorkspaceState (центральный +, picker key 'empty')
├─ да + !isLayoutEditMode → placeholder «Layout пуст» (без +)
└─ нет
   ├─ rootZone.type === 'workspace' → layout-workspace-root
   │  ├─ edit mode → WorkspaceLayoutEditShell
   │  └─ обычный → WorkspaceRenderer
   └─ rootZone.type === 'container' → SplitContainer (рекурсия)
```

Подробности — **[layout-edit-mode.md](../../layout-edit-mode.md)**.

## Дополнительные компоненты (edit mode)

- **LayoutEditModeBanner** — индикатор активного edit mode над шапкой
- **LayoutWorkspaceArea** — корневой роутер области workspace
- **WorkspaceLayoutEditShell** — оболочка одной workspace-зоны (air-регионы, content-frame, diagonals, удаление)
- **WorkspaceLayoutEditContainerShell** — span-полосы контейнера (flex-полосы **24px**; вся полоса кликабельна для добавления над/под или слева/справа от всего ряда)
- **WorkspaceLayoutEditAirControl** — кнопка air-зоны workspace (вся сторона кликабельна) или span-полоса контейнера (`iconPlacement="band-center"`); picker
- **Удаление зоны (×):** при удалении последней workspace-зоны или единственного singleton-типа — `window.confirm` с текстом из `getRemoveWorkspaceConfirmMessage` (`WorkspaceLayoutEditShell.tsx`)
- **LayoutEmptyWorkspaceState** — пустой layout, первая зона через picker

## См. также

- [Режим редактирования layout](../../layout-edit-mode.md)
- [Клиентское persist](./persisted-client-state.md)
- [Settings Store](../stores/settings-store.md) — экспорт bundle с `userWorkspaces`
- `src/core/types/workspacePreset.ts` — `allocateUnnamedWorkspaceName`, `isUnnamedWorkspaceName`
