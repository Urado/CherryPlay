# Режим редактирования layout

Интерактивное добавление и удаление workspace-зон в дереве layout без правки пресетов в коде. Режим доступен в **Electron** и **веб-демо**.

**Персистентность дерева и workspace:**

| Среда | Поведение |
|-------|-----------|
| **Electron** (`npm run dev`) | Состояние workspace (`activeWorkspace`, `userWorkspaces`, живое `layout`) пишется в Zustand persist (`cherryplaylist-workspaces`, см. [клиентское persist](./modules/systems/persisted-client-state.md)) и **переживает перезапуск** приложения. |
| **Веб-демо** (`npm run dev:web`) | При каждом старте bootstrap **очищает** `cherryplaylist-workspaces` ([AC12](./web-demo.md#что-работает-в-демо), `resetDemoPersistStorage`). Правки **не переживают** полную перезагрузку страницы; **внутри одной сессии** (без F5) persist работает как обычно. |

Флаг **`isLayoutEditMode`** и **`baselineLayout`** между сессиями **не** сохраняются (ни в Electron, ни в веб-демо).

См. также: [Layout System](./modules/systems/layout-system.md), [Веб-демо](./web-demo.md), [Test Zone](./modules/workspaces/test-zone.md), [UI Store](./modules/stores/ui-store.md), [Keyboard Shortcuts](./modules/hooks-utils/keyboard-shortcuts.md).

---

## Как включить и выйти

1. В шапке нажмите **✎** (`WorkspaceMenu.tsx`, `requestToggleLayoutEditMode`).
2. Кнопка подсвечивается в активном режиме (`app-header-workspace-edit-btn--active`).
3. Выйти: снова **✎** или **Esc**. **Esc** (`App.tsx`, `capture: true`):
   - если фокус в поле переименования pill — только отмена ввода имени;
   - иначе закрывает открытый workspace-picker (`openLayoutEditPickerKey`);
   - затем `requestExitEditMode()` → при dirty вызывается `autoCommitWorkspaceChanges()`, режим выключается **без модальных диалогов**.

`isLayoutEditMode` в `partialize` persist **не** входит — после перезапуска режим всегда выключен.

**«Создать с нуля…»** в меню pill сразу создаёт пустой scratch-workspace **и включает** режим редактирования (`createScratchWorkspace` → `isLayoutEditMode: true`).

---

## Рабочие пространства в шапке

Вместо селектора пресетов — **workspace pill** (имя + ▾) и отдельная кнопка **✎** (`WorkspaceMenu`).

```
[ Имя workspace  ▾ ]  [ ✎ ]
```

| Элемент | Поведение в edit mode |
|---------|----------------------|
| **Имя в pill** | Кликабельно для **user** и **scratch** — inline-переименование (фиксированная ширина pill, длинный текст прокручивается внутри поля) |
| **▾ (меню)** | `disabled`; переключение workspace недоступно |
| **✎** | Активна; выход из режима с auto-commit при dirty |

Меню (только **вне** edit mode, по **▾**):

| Секция | Содержимое |
|--------|------------|
| **Мои** | Пользовательские workspace; ⋯ → переименовать / удалить |
| **Встроенные** | Built-in пресеты с RU-именами |
| — | **Создать с нуля…** |

Отдельных пунктов **Сохранить** / **Сбросить** в меню **нет** — сохранение автоматическое (см. ниже).

Подробнее о модели — [Layout System](./modules/systems/layout-system.md).

---

## Автосохранение изменений layout

Изменения дерева **не требуют ручного сохранения**. Блокирующих диалогов нет.

| Событие | Поведение |
|---------|-----------|
| **Выход из edit mode** (✎, Esc) | `autoCommitWorkspaceChanges()` |
| **Переключение workspace** (▾) | Сначала auto-commit, затем `activateWorkspace` |
| **Создать с нуля…** при dirty | Сначала auto-commit, затем пустой scratch + edit mode |

| Активный workspace | Auto-commit |
|--------------------|-------------|
| **user** | Обновляет снимок в `userWorkspaces` (`saveCurrentWorkspace`, без toast) |
| **builtin** | `saveCurrentWorkspaceAsUnnamed()` → **«Без имени»** или **«Без имени 2»**, … (см. ниже) |
| **scratch** | То же через `saveCurrentWorkspaceAsUnnamed` |

Автоматический fallback built-in (AIMP / `complex` в production) использует `bypassDirtyGuard: true` (без auto-commit).

### Именование

Константы и функции — `src/core/types/workspacePreset.ts`:

| Символ | Назначение |
|--------|------------|
| `UNNAMED_WORKSPACE_NAME` | `'Без имени'` — базовое имя для первого auto-save |
| `allocateUnnamedWorkspaceName(names)` | Первый свободный auto-имя: «Без имени», затем «Без имени 2», «Без имени 3», … |
| `isUnnamedWorkspaceName(name)` | `true` для «Без имени» и «Без имени N» (N ≥ 2) |

**Правило нумерации:** пока в **Мои** нет записи с именем **«Без имени»**, новый auto-save получает именно его. Если **«Без имени»** уже занят — выдаётся следующий свободный суффикс (`Без имени 2`, `Без имени 3`, …). Если пользователь переименовал единственный «Без имени», следующий auto-save снова может быть **«Без имени»**.

**Pill (шапка):**

- Фиксированная ширина **148px**; длинное имя обрезается / прокручивается в поле ввода.
- **Клик по имени** (user или scratch, в т.ч. в edit mode) → inline-переименование; Enter / blur — сохранить, Esc — отмена (в edit mode Esc в поле имени **не** выходит из layout edit).
- Имена серии «Без имени» / «Без имени N» отображаются **курсивом**.
- Для **scratch** ввод осмысленного имени вызывает `saveCurrentWorkspaceAs(name)` и переводит workspace в **user**.
- Для **user** — `renameUserWorkspace`; ручные имена **уникальны** (дубликат — toast с ошибкой). Вручную задать имя из серии «Без имени N» через pill нельзя (отмена при commit).
- **▾** → ⋯ у записи в **Мои**: переименовать / удалить (альтернатива pill).

---

## Поведение UI в режиме редактирования

### Оболочка workspace (`WorkspaceLayoutEditShell`)

Каждая workspace-зона оборачивается в edit-shell:

- пунктирная рамка вокруг зоны;
- затемнение содержимого (overlay поверх `WorkspaceRenderer`, взаимодействие с workspace заблокировано);
- четыре **«воздушные»** области по сторонам (CSS `--layout-edit-air-size`, по умолчанию **48px**): top, right, bottom, left;
- SVG-диагонали от углов зоны к углам shell (`ResizeObserver` пересчитывает геометрию при resize);
- кнопка **×** — удалить текущий workspace из layout.

### Добавление рядом с зоной

В каждой air-области — кнопка **+** и выпадающий список типов workspace (`WorkspaceLayoutEditAirControl`, portal в `document.body`). Выбор типа вызывает `addAdjacentWorkspace(zoneId, side, workspaceType)` — новая зона вставляется **с указанной стороны** (top/bottom → вертикальный split, left/right → горизонтальный).

### Пустой layout

Если в дереве нет ни одной workspace-зоны (`isLayoutEmpty`), вместо split-контейнера показывается `LayoutEmptyWorkspaceState`: по центру кнопка **+** с тем же picker. Первый workspace создаётся через `addInitialWorkspace(workspaceType)`.

### Изменение размеров

В edit mode **разделители split-контейнеров активны** (`SplitContainer.tsx`): можно перетаскивать dividers и менять пропорции зон. В обычном режиме resize по-прежнему работает так же; в edit mode dividers получают класс `split-divider--layout-edit` для визуального отличия.

### Что блокируется в шапке

Пока режим включён:

- **▾** меню workspace (переключение пресетов / пользовательских workspace);
- переименование проекта;
- кнопки настроек, экспорта, аккаунта, demo player;
- меню **Проект** (принудительно закрывается при входе в режим);
- **глобальные горячие клавиши** (`useGlobalShortcuts` с `enabled: false`).

**Не** блокируется: **имя в pill** (переименование), кнопка **✎**.

Все зарегистрированные шорткаты в `ShortcutManager` также не срабатывают в edit mode (`isShortcutsBlocked`).

---

## Доступные типы workspace (picker)

Список строится в `workspaceLayoutEditOptions.ts`:

1. Все модули из **`workspaceRegistry`** (`getAllModulesByType()`), имена на русском через `workspaceDisplayNames.ts`.
2. **`fileBrowser`** добавляется явно, если его нет в реестре (специальный случай в `WorkspaceRenderer`).
3. **Singleton-типы**, уже присутствующие в layout, **скрываются** из picker:

| Тип | Примечание |
|-----|------------|
| `playlist` | один на layout |
| `fileBrowser` | один на layout |
| `player` | один на layout |
| `aimp` | один на layout |
| `party-editor` | один на layout |
| `party-preview` | один на layout |

Типы **`collection`** и **`test1`…`test8`** можно добавлять **несколько раз** (новый `workspaceId` на каждую зону).

Сортировка picker — по русскому отображаемому имени.

---

## Добавление и удаление: жизненный цикл workspace

Логика дерева в `layoutWorkspaceOperations.ts`, жизненный цикл store — в `workspaceLifecycle.ts`; вызовы из `layoutStore` (`addAdjacentWorkspace`, `addInitialWorkspace`, `removeWorkspaceZone`).

### Регистрация модулей при старте

В `src/entry.tsx` side-effect импорты подключают workspace-модули; каждый регистрирует себя в **`workspaceRegistry`**. `WorkspaceRenderer` по `workspaceType` / `workspaceId` находит React-компонент модуля.

### Добавление зоны

1. В дерево layout вставляется новая `WorkspaceZone` (новый `zoneId`, `workspaceId` по типу).
2. Для **динамических** типов `layoutStore` вызывает **`prepareWorkspaceInstance`** (`workspaceLifecycle.ts`):
   - **`collection`**: `ensureProjectStore`, запись в `uiStore.workspaces`, `registerWorkspaceType`;
   - **`test*`** : `registerWorkspaceType`.
3. **Singleton-типы** (`playlist`, `fileBrowser`, …) используют **фиксированные** `workspaceId` из `@core/constants/workspace`; отдельный prepare не нужен — store/модуль уже существуют с запуска приложения.

При ошибке добавления показывается toast (сообщения из `getAddWorkspaceErrorMessage`).

### Удаление зоны

1. **`removeWorkspaceFromLayout`** удаляет зону из дерева: размеры соседей перераспределяются, пустые контейнеры схлопываются (`cleanupContainers`). Если удалена **последняя** workspace-зона — layout становится **пустым** (`createEmptyLayout()`).
2. **`layoutStore.removeWorkspaceZone`** применяет новое дерево, затем **`cleanupWorkspaceInstance`** для динамических типов.
3. **Singleton store** при удалении зоны из layout **остаётся в памяти** — убирается только привязка зоны в дереве.

### Ограничения при добавлении

| Ограничение | Значение | Сообщение пользователю |
|-------------|----------|------------------------|
| Максимальная вложенность | 6 (`MAX_LAYOUT_DEPTH`) | «Достигнута максимальная вложенность layout» |
| Зон в одном контейнере | 10 (`MAX_ZONES_PER_CONTAINER`) | «В контейнере уже максимум зон» |
| Дубликат singleton | — | «Этот workspace уже есть в layout» |

---

## Пресеты vs ручное редактирование

- **Встроенные пресеты** задают начальное дерево через `createLayoutByPreset`; переключение — через **▾** → **Встроенные**.
- В **edit mode** смена workspace **заблокирована** (только ▾ disabled).
- Правки дерева при выходе из edit mode или при переключении workspace **автоматически** сохраняются (см. § «Автосохранение»); built-in при этом форкается в **Мои** с именем по `allocateUnnamedWorkspaceName`, если layout изменился.
- Пустой layout и произвольная конфигурация **валидны**: `LayoutWorkspaceArea` обрабатывает пустое состояние, одиночную зону и контейнеры.
- **Пустой layout вне edit mode**: placeholder «Layout пуст»; центральный **+** — только в edit mode (`LayoutEmptyWorkspaceState`).

Открытие/создание **проекта** (.cherry) **не** меняет активный workspace (настройки уровня приложения).

---

## Связанные файлы

| Путь | Роль |
|------|------|
| `src/shared/stores/layoutStore.ts` | Workspace state, persist, auto-commit, edit mode |
| `src/app/components/WorkspaceMenu.tsx` | Pill, dropdown, inline rename, ✎ |
| `src/app/hooks/useWorkspaceDirtyGuard.ts` | Auto-commit перед switch / exit / scratch |
| `src/core/types/workspacePreset.ts` | Типы, `UNNAMED_WORKSPACE_NAME` |
| `src/shared/utils/layoutWorkspaceOperations.ts` | Add/remove дерева, singleton |
| `src/shared/utils/workspaceLifecycle.ts` | `prepareWorkspaceInstance` / `cleanupWorkspaceInstance` |
| `src/app/components/LayoutWorkspaceArea.tsx` | Пустой / root workspace / `SplitContainer` |
| `src/app/components/WorkspaceLayoutEditShell.tsx` | Edit-frame, air-регионы, удаление |
| `src/styles/components/header.css` | Стили pill (фикс. ширина), edit mode |

---

## Как проверить

1. `npm run dev` (Electron) или `npm run dev:web`.
2. **✎** — у каждой зоны air-области и ×; контент затемнён.
3. **+** у зоны → добавить workspace; singleton не дублируется в picker.
4. **×** — зона удаляется; для collection очищается store.
5. Удалить все зоны → **✎** → центральный **+** для первой зоны.
6. Перетащить divider — пропорции меняются.
7. Правка built-in → **✎** выход → запись в **Мои** («Без имени» или «Без имени 2», …); клик по имени → задать своё.
8. **Создать с нуля…** → сразу edit mode, pill «Без имени».
9. **▾** → переключение **Мои** / **Встроенные**; при dirty — тихий auto-commit перед switch.
10. Два auto-save с built-in без переименования → в **Мои** «Без имени» и «Без имени 2».
11. **Персистентность** (Electron): перезапуск — workspace и дерево на месте, edit mode выключен. **Веб-демо**: F5 сбрасывает `cherryplaylist-workspaces`.
