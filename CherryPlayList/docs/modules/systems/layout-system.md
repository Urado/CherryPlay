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
| `BuiltinLayoutOverrides`       | `Partial<Record<LayoutPreset, Layout>>` — override поверх фабрики для builtin    |
| `UNNAMED_WORKSPACE_NAME`       | `'Без имени'` — базовое auto-имя (scratch → **Мои**)                             |
| `allocateUnnamedWorkspaceName` | Следующее свободное auto-имя в серии «Без имени» / «Без имени N»                 |
| `isUnnamedWorkspaceName`       | Проверка auto-имени (курсив в pill, ограничения при ручном rename)               |

**Дерево `layout`** — живое runtime-состояние зон. **Пользовательские workspace** хранят полные копии в `userWorkspaces[]`. Встроенные пресеты **не** становятся записями в `userWorkspaces`. `resolveBuiltinLayout(preset, overrides)`: если есть override для preset — **clone** этого layout целиком; иначе — `createLayoutByPreset(preset)` (`layoutPresetFactories.ts`). Это **не** field-merge фабрики с override.

### Именование пользовательских workspace (auto-save scratch)

| Шаг                                      | Имя в **Мои**      |
| ---------------------------------------- | ------------------ |
| 1-й auto-save scratch (нет «Без имени»)  | **Без имени**      |
| 2-й при занятом «Без имени»              | **Без имени 2**    |
| далее                                    | **Без имени 3**, … |

Реализация: `allocateUnnamedWorkspaceName()` в `workspacePreset.ts`, вызов из `saveCurrentWorkspaceAsUnnamed()` в `layoutStore` (только **scratch**, не builtin). После переименования единственного «Без имени» слот снова доступен.

Исторические **«Без имени»** от старого auto-fork builtin → **Мои** **не мигрируются**.

## Рабочие пространства

### Встроенные (built-in)

Фабрики пресетов — `layoutPresetFactories.ts` (`createLayoutByPreset`, `createSimpleLayout`, `createCollectionsLayout`, `createPartyLayout` и др.); сигнатуры сопоставления — `layoutPreset.ts` (`getLayoutPresetFromLayout`). Имена и one-line описания в UI — на русском (`LAYOUT_PRESET_DISPLAY_NAMES_RU` / `LAYOUT_PRESET_DESCRIPTIONS_RU` в `src/core/constants/layoutPresetDisplayNames.ts`). Меню / aria / секция встроенных — **«Рабочие окна»** (`WorkspaceMenu`); не продуктовый термин «Layout».

Список пунктов меню встроенных (`ALL_BUILTIN_PRESETS`): `simple`, `collections-vertical`, `player`, `party`. Id `complex` / `collections` / `aimp-party` в меню **не** перечисляются.

| `LayoutPreset`         | Отображаемое имя (RU) | Описание (`LAYOUT_PRESET_DESCRIPTIONS_RU`) / доступность |
| ---------------------- | --------------------- | -------------------------------------------------------- |
| `simple`               | **Простая сборка**    | «Плейлист и панель файлов — минимум панелей»; в меню |
| `collections`          | **Сборка плейлиста**  | без one-liner в map; legacy id — при rehydrate мигрирует на `collections-vertical`; в меню встроенных **не** отдельным пунктом |
| `collections-vertical` | **Сборка плейлиста**  | secondary — «Вертикальная раскладка: подборки (буфер) и файлы»; в меню; **`DEFAULT_BUILTIN_PRESET`** (first-run / fallback) |
| `player`               | **Играть и править**  | «Играть локально и править список / файлы в одной раскладке»; в меню |
| `party`                | **Играть для гостей** | «Вечеринка для гостей: настройка и превью страницы»; в меню (`partyDiscoverabilityEnabled`; офлайн — in-zone stub) |
| `complex`              | Сложный (display map) | без one-liner; **скрыт** всегда (ни prod, ни DEV); factory/id/render сохранены |
| `aimp-party`           | AIMP + Party          | без one-liner; **legacy:** не в меню; persist мигрирует на `party`; copy clarity **отложено** |

Structural-правки встроенного пресета **не** создают запись в **Мои**: upsert в `builtinLayoutOverrides[preset]`, активный workspace остаётся `{ kind: 'builtin', preset }`. Политика dirty — **Variant A** (только структура; sizes alone → discard к baseline). Сброс: **«Сбросить к исходному»** → `clearBuiltinOverride`. Подробности — [layout-edit-mode.md](../../layout-edit-mode.md#builtin-variant-a-structure-only).

### Пользовательские (Мои)

- Создаются при auto-commit **scratch**, при явном именовании scratch в pill (`saveCurrentWorkspaceAs`), или остаются как legacy-копии (в т.ч. старые «Без имени» от прежнего auto-fork builtin).
- **Переименование:** клик по имени в pill (inline) или ⋯ → «Переименовать…» в меню.
- **Удаление:** ⋯ → «Удалить…» (с подтверждением). При удалении активного — fallback на built-in `collections-vertical` (`DEFAULT_BUILTIN_PRESET`).
- Имена уникальны при ручном переименовании. Auto-save scratch: первый — **«Без имени»**, далее **«Без имени 2»**, **«Без имени 3»**, …

### Scratch («Создать с нуля…»)

`activeWorkspace: { kind: 'scratch' }`, пустое дерево. В pill — **«Без имени»**. **Сразу включается edit mode.** В persist **не** попадает (`normalizeWorkspacePersistSlice` → builtin `collections-vertical` / `DEFAULT_BUILTIN_PRESET` при rehydrate). Сохранение — через auto-commit при выходе/переключении или через ввод имени в pill (`saveCurrentWorkspaceAs`).

### Переключение и автосохранение

| API                            | Поведение                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `activateWorkspace(ref)`       | Builtin: `resolveBuiltinLayout` (override → clone целиком, иначе фабрика); user/scratch — снимок / пустое дерево; cleanup/prepare lifecycle |
| `autoCommitWorkspaceChanges()` | **user** dirty → `saveCurrentWorkspace`; **builtin** structure dirty → upsert override (иначе discard sizes к baseline); **scratch** dirty → `saveCurrentWorkspaceAsUnnamed` |
| `clearBuiltinOverride(preset)` | Всегда удаляет override из map; live layout / baseline пересобираются фабрикой **только** если этот builtin сейчас активен; для неактивного preset — только map |
| `requestActivateWorkspace`     | Auto-commit, затем switch (`useWorkspaceDirtyGuard`)                                                                                      |
| `isWorkspaceDirty()`           | Builtin: `structureOnly` (`getLayoutStructureDirtySignature`); user/scratch: полная `getLayoutZoneSignature` vs baseline                  |

Переключение через **▾** **заблокировано** в `isLayoutEditMode`. Вне edit mode при dirty — **тихий** auto-commit перед switch (без диалогов).

### Коллекции и `workspaceId`

Данные коллекций (`cherryplaylist-<workspaceId>`) привязаны к **`workspaceId` в дереве**, не к имени workspace. См. [persisted-client-state.md](./persisted-client-state.md).

## Функциональность

- Рекурсивная структура (до 6 уровней вложенности)
- Процентное распределение размеров (сумма = 100%)
- **Минимальные размеры зон** — per-type `minWidth` / `minHeight` на `IWorkspaceModule`; см. § «Минимальные размеры зон»
- Автоматическая очистка контейнеров с 1 дочерним элементом
- Persist `cherryplaylist-workspaces` — [persisted-client-state.md](./persisted-client-state.md)
- **Режим редактирования** — [layout-edit-mode.md](../../layout-edit-mode.md)

## Минимальные размеры зон

Каждый workspace-модуль в `workspaceRegistry` объявляет **`minWidth`** и **`minHeight`** (пиксели) на контракте `IWorkspaceModule` (`src/core/interfaces/IWorkspaceModule.ts`). Значения **одинаковы для всех зон одного `workspaceType`**; в JSON layout **не** персистятся — при runtime берутся из реестра через `getWorkspaceMinSize()` (`src/shared/utils/layoutWorkspaceMins.ts`). Legacy-тип **`aimp`** при lookup нормализуется в **`player`**.

Минимумы описывают **итоговый выделенный размер контентной области зоны** (flex-ребёнок `split-zone` внутри split-цепочки), **без** chrome приложения (шапка, футер, баннеры).

### Placeholder-значения (могут уточняться продуктом)

| `workspaceType` | `minWidth` | `minHeight` | Примечание                  |
| --------------- | ---------- | ----------- | --------------------------- |
| `playlist`      | 280        | 200         | Список треков               |
| `fileBrowser`   | 240        | 200         | UI **«Файлы»** (id `fileBrowser`) |
| `collection`    | 200        | 150         | UI **«Подборка»**           |
| `player`        | 360        | 120         | UI **«Проигрывание»**       |
| `demo-player`   | 280        | 100         | UI **«Предпросмотр (только у вас)»** |
| `party-editor`  | 400        | 300         | Редактор вечеринки          |
| `party-preview` | 320        | 240         | Превью                      |
| `test1`…`test8` | 150        | 100         | Зарегистрированы всегда (`entry.tsx`); **не** в picker «добавить зону» (даже DEV); уже открытые зоны рендерятся |

Неизвестный тип → консервативный fallback **200×150** (`DEFAULT_WORKSPACE_MIN_SIZE`) + предупреждение в dev.

> **`aimp`:** в реестре объявлен **360×120** (`src/workspaces/aimp/index.ts`); при lookup mins нормализуется в **`player`** (`getWorkspaceMinSize`).

Полный список в рантайме: `getAllRegisteredWorkspaceTypesWithMins()`.

### Enforcement (только JS)

Ограничения **не** задаются CSS `minWidth` / `minHeight` на `split-zone`. Вместо прежнего глобального пола **10px**:

| Место                        | Поведение                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`SplitContainer`**         | При drag divider — `getMinSizePercentsForContainer()` по subtree каждого соседа; **жёсткий clamp** (обновление не применяется, если нарушен min слева или справа)                  |
| **Edit mode — add adjacent** | Симуляция дерева с 50/50 split → `computeMinLayoutSize(proposedTree)` ≤ текущий layout viewport; иначе `min_size_violation` — см. [layout-edit-mode.md](../../layout-edit-mode.md) |
| **Edit mode — add initial**  | Первая зона на пустом layout: та же `enforceMinSizeFeasibility` по предлагаемому дереву (одна workspace-зона) и текущему viewport                                                  |
| **Минимум окна (Electron)**  | `computeMinWindowSize(layout, chrome)` + IPC `system:setMinimumWindowSize`; пол `max(800×600, computed)`                                                                           |

Утилиты: `computeMinLayoutSize`, `getMinSizePercentsForContainer`, `computeMinWindowSize` — `layoutWorkspaceMins.ts`.

### Модель расчёта минимума (`computeMinLayoutSize`)

Рекурсивная **min-content** модель: минимум — это размер, при котором дерево **можно** разложить (дивайдеры подвижны), поэтому **доли (`sizes`) на минимум не влияют**. На каждом уровне контейнера:

| Ось относительно контейнера   | Агрегация дочерних минимумов |
| ----------------------------- | ---------------------------- |
| **вдоль** направления split   | **сумма** (`Σ`)              |
| **поперёк** направления split | **максимум** (`max`)         |

- Горизонтальный контейнер: `minWidth = Σ minWidth(детей)`, `minHeight = max minHeight(детей)`.
- Вертикальный контейнер: `minHeight = Σ minHeight(детей)`, `minWidth = max minWidth(детей)`.
- Workspace-лист: `minWidth`/`minHeight` из реестра. Пустой контейнер: `0×0`.

За счёт рекурсии «max по поперечной оси» применяется на любой глубине: например, две зоны, сложенные **вертикально** внутри горизонтального ряда, занимают по ширине **одну** колонку `= max` их ширин (а по высоте — сумму).

> Пример (горизонтальный ряд: `playlist` · [верт. стек `collection`+`collection`] · `fileBrowser` · `fileBrowser`):
> `minWidth = 280 + max(200, 200) + 240 + 240 = 960`; `minHeight = max(200, 150+150, 200, 200) = 300`.

### Диагностика в консоли

При отклонении **user-triggered** добавления по `min_size_violation` в консоль пишется подробный **рекурсивный расчёт по обеим осям** (`explainMinLayoutSize` → `logAddAdjacentMinSizeViolation`, `layoutWorkspaceOperations.ts`): текущая область layout, вклад каждой зоны, суммы/max по уровням и вывод «помещается / НЕ ПОМЕЩАЕТСЯ» отдельно по ширине и высоте.

**Availability probing** (`canAddAdjacentWorkspace` — решение, показывать ли air **+**) использует тот же `enforceMinSizeFeasibility`, в т.ч. при `viewport === null`, но **не логирует** в консоль (вызов на каждом рендере). Toast — только при реальном действии пользователя (picker / air / центральный **+**).

### Минимальный размер окна

**Electron** (`useWindowMinSize` в `App.tsx`):

1. Измеряется viewport области layout (хост `.app-content-main`) и chrome-insets (разница `window` vs viewport — шапка, футер, inline edit hint в шапке, in-app player и т.д.).
2. `computeMinWindowSize` = insets + `computeMinLayoutSize(rootZone)`.
3. В main process: `setMinimumSize(max(appFloor 800×600, computed))`.

Пересчёт при смене `layout`, resize окна, toggle `isLayoutEditMode` и прочих изменений chrome.

Chrome шапки учитывает pill **Рабочие окна**, **HeaderPartyStatus** (при **Онлайн**: lifecycle UI labels + **«Играть для гостей»** → preset `party`), **HeaderPlaybackPill** (session + CherryPlay; без prep/readiness; **не** gate от `enableStreaming`) и прочий UI; отдельного host основного плеера в шапке **нет** (зона **Проигрывание** — только в layout). Детали: [party.md — Шапка](../workspaces/party.md#шапка-appheader-статус-и-pill). Плотность шапки зоны `player` — см. [Player](../workspaces/player.md#шапка-зоны).

**Веб-демо** (`npm run dev:web`): IPC нет; гарантия — clamp divider в `SplitContainer` + add-adjacent pre-check. Опциональный CSS-min на контейнере приложения не является основным механизмом.

**Пустой layout** (scratch): `computeMinLayoutSize` → **0×0**; окно держит только app floor **800×600**.

### Невалидные сохранённые layout

Если при текущем размере окна какая-то зона **уже меньше** своего min (например, после смены mins в коде или уменьшения окна до пересчёта):

- Layout **загружается без ошибки**, без toast и **без** авто-перераспределения.
- Исправление — только при **перетаскивании divider**: clamp не даёт ухудшить нарушение на границе drag (нельзя сжать соседа ниже min).

См. также § «Изменение размеров» в [layout-edit-mode.md](../../layout-edit-mode.md).

## UI в шапке

```
[ Имя (210px)  ▾ ]  [ ✎ ]
```

| Элемент | Назначение                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Имя** | Активный workspace; клик → inline rename (user/scratch, в т.ч. в edit mode); серия «Без имени» / «Без имени N» — курсивом; при builtin override — eyebrow **«Рабочие окна · изменено»** |
| **▾**   | Меню: **Рабочие окна** (built-in; метка **«изменено»** + ⋯ → **«Сбросить к исходному»**) / **Мои** / **Создать с нуля…** (disabled в edit mode) |
| **✎**   | Вход/выход из edit mode; выход с auto-commit при dirty                                                                    |

Отдельного пункта **Сохранить** нет. Для изменённых builtin — **«Сбросить к исходному»**. При переключении workspace и auto-commit блокирующих диалогов нет.

## Режим редактирования (кратко)

- **✎** или **Создать с нуля…**; **Esc** — выход с auto-commit.
- `isLayoutEditMode` **не** персистится.
- **Inline edit hint** в шапке (`WorkspaceMenu`, `app-header-workspace-edit-hint`): «Редактирование окон — Esc для выхода» рядом с **✎** / **✓**.
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

- **WorkspaceMenu** — inline edit hint (`app-header-workspace-edit-hint`) при активном режиме
- **LayoutWorkspaceArea** — корневой роутер области workspace
- **WorkspaceLayoutEditShell** — оболочка одной workspace-зоны (air-регионы, content-frame, diagonals, удаление)
- **WorkspaceLayoutEditContainerShell** — span-полосы контейнера (flex-полосы **24px**; вся полоса кликабельна для добавления над/под или слева/справа от всего ряда)
- **WorkspaceLayoutEditAirControl** — кнопка air-зоны workspace (вся сторона кликабельна) или span-полоса контейнера (`iconPlacement="band-center"`); picker
- **Удаление зоны (×):** при удалении последней workspace-зоны или единственного singleton-типа — `window.confirm` с текстом из `getRemoveWorkspaceConfirmMessage` (`WorkspaceLayoutEditShell.tsx`)
- **LayoutEmptyWorkspaceState** — пустой layout, первая зона через picker

## См. также

- [Режим редактирования layout](../../layout-edit-mode.md)
- [Клиентское persist](./persisted-client-state.md) — `builtinLayoutOverrides` в `cherryplaylist-workspaces`
- [Settings Store](../stores/settings-store.md) — экспорт bundle с `userWorkspaces` и `builtinLayoutOverrides`
- `src/shared/utils/layoutWorkspaceMins.ts` — `computeMinLayoutSize`, lookup mins
- `src/shared/utils/layoutSignature.ts` — structure vs full zone signatures
- `src/core/types/workspacePreset.ts` — `BuiltinLayoutOverrides`, `allocateUnnamedWorkspaceName`
