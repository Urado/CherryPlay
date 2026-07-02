# Режим редактирования layout

Интерактивное добавление и удаление workspace-зон в дереве layout без правки пресетов в коде. Режим доступен в **Electron** и **веб-демо**.

**Персистентность дерева:**

| Среда | Поведение |
|-------|-----------|
| **Electron** (`npm run dev`) | Дерево layout пишется в Zustand persist (`cherryplaylist-layout`, см. [клиентское persist](./modules/systems/persisted-client-state.md)) и **переживает перезапуск** приложения. |
| **Веб-демо** (`npm run dev:web`) | При каждом старте bootstrap **очищает** `cherryplaylist-layout` ([AC12](./web-demo.md#что-работает-в-демо), `resetDemoPersistStorage`). Правки **не переживают** полную перезагрузку страницы; **внутри одной сессии** (без F5) persist работает как обычно. |

Флаг **`isLayoutEditMode`** между сессиями **не** сохраняется (ни в Electron, ни в веб-демо).

См. также: [Layout System](./modules/systems/layout-system.md), [Веб-демо](./web-demo.md), [Test Zone](./modules/workspaces/test-zone.md), [UI Store](./modules/stores/ui-store.md), [Keyboard Shortcuts](./modules/hooks-utils/keyboard-shortcuts.md).

---

## Как включить и выйти

1. В шапке нажмите **«Редактировать»** (`AppHeader.tsx`).
2. Кнопка переключается на **«Готово»**; активный режим подсвечивается.
3. Выйти: **«Готово»**, **Esc** или снова **«Редактировать»**. **Esc** (глобальный обработчик в `App.tsx`, `capture: true`): сначала закрывает открытый workspace-picker (`openLayoutEditPickerKey`), затем выходит из режима.

`isLayoutEditMode` хранится в `layoutStore`, в `partialize` persist **не** входит — после перезапуска приложения режим всегда выключен.

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

Пока режим включён, отключены (или игнорируются):

- селектор **пресета layout**;
- переименование проекта;
- кнопки настроек, экспорта, аккаунта, demo player;
- меню **Проект** (принудительно закрывается при входе в режим);
- **глобальные горячие клавиши** (`useGlobalShortcuts` с `enabled: false`).

Все зарегистрированные шорткаты в `ShortcutManager` также не срабатывают в edit mode (callback `isShortcutsBlocked`). **Esc** обрабатывается отдельным listener в `App.tsx`: сначала закрывает открытый picker, затем выходит из режима.

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

Логика дерева в `layoutWorkspaceOperations.ts` (чистые функции), жизненный цикл store — в `workspaceLifecycle.ts`; вызовы из `layoutStore` (`addAdjacentWorkspace`, `addInitialWorkspace`, `removeWorkspaceZone`).

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

1. **`removeWorkspaceFromLayout`** (чистая функция в `layoutWorkspaceOperations.ts`) удаляет зону из дерева: размеры соседей перераспределяются, пустые контейнеры схлопываются (`cleanupContainers`). Если удалена **последняя** workspace-зона — layout становится **пустым** (`createEmptyLayout()`).
2. **`layoutStore.removeWorkspaceZone`** применяет новое дерево через `set({ layout })`, затем вызывает **`cleanupWorkspaceInstance`** (`workspaceLifecycle.ts`) для динамических типов:
   - **`collection`**: `uiStore.removeWorkspace`, `removeProjectStore`, `unregisterWorkspaceType`;
   - **`test*`** : `unregisterWorkspaceType`.
3. **Singleton store** (плейлист, file browser и т.д.) при удалении зоны из layout **остаётся в памяти** — убирается только привязка зоны в дереве.

### Ограничения при добавлении

| Ограничение | Значение | Сообщение пользователю |
|-------------|----------|------------------------|
| Максимальная вложенность | 6 (`MAX_LAYOUT_DEPTH`) | «Достигнута максимальная вложенность layout» |
| Зон в одном контейнере | 10 (`MAX_ZONES_PER_CONTAINER`) | «В контейнере уже максимум зон» |
| Дубликат singleton | — | «Этот workspace уже есть в layout» |

---

## Пресеты layout vs ручное редактирование

- **Пресеты** (селектор в шапке: simple, collections, …) по-прежнему задают начальное дерево программно в `layoutStore.ts`.
- В **edit mode** смена пресета **заблокирована** — иначе можно потерять несохранённую в файл, но уже изменённую в persist конфигурацию зон.
- Пустой layout и произвольная конфигурация после ручного редактирования **валидны**: `LayoutWorkspaceArea` больше не требует, чтобы корень был контейнером (одиночная workspace-зона или пустое состояние обрабатываются явно).
- **Пустой layout вне edit mode**: placeholder с заголовком «Layout пуст» и подсказкой «Нажмите «Редактировать» в шапке, чтобы добавить workspace»; центральный **+** и picker — только в **режиме редактирования** (`LayoutEmptyWorkspaceState`).

---

## Связанные файлы

| Путь | Роль |
|------|------|
| `src/shared/stores/layoutStore.ts` | `isLayoutEditMode`, persist только `layout`, actions add/remove |
| `src/shared/utils/layoutWorkspaceOperations.ts` | Чистая логика add/remove дерева, singleton |
| `src/shared/utils/workspaceLifecycle.ts` | `prepareWorkspaceInstance` / `cleanupWorkspaceInstance` |
| `src/core/constants/layoutConstraints.ts` | `MAX_LAYOUT_DEPTH`, `MAX_ZONES_PER_CONTAINER` |
| `src/app/components/LayoutWorkspaceArea.tsx` | Маршрутизация: пустой / root workspace / `SplitContainer` |
| `src/app/components/WorkspaceLayoutEditShell.tsx` | Edit-frame, diagonals, remove |
| `src/app/components/WorkspaceLayoutEditAirControl.tsx` | + и picker (через `WorkspacePickerMenu`) |
| `src/app/components/WorkspacePickerMenu.tsx` | Общий portal-picker (позиция, outside-click) |
| `src/app/components/workspaceLayoutEditOptions.ts` | Опции picker из registry |
| `src/core/constants/workspaceDisplayNames.ts` | Русские имена типов |
| `src/styles/components/app.css`, `header.css` | Стили edit mode |

---

## Как проверить

1. `npm run dev` (Electron) или `npm run dev:web`.
2. **«Редактировать»** — у каждой зоны видны air-области и ×; контент затемнён.
3. **+** слева от плейлиста → выбрать «Коллекция» — появляется новая зона; toast «Добавлен workspace: …».
4. Повторно открыть picker у singleton (например «Плейлист») — тип **отсутствует** в списке.
5. **×** на зоне коллекции — зона исчезает; store коллекции очищается.
6. Удалить все зоны — включить **«Редактировать»** → центральный **+**; добавить первый workspace.
7. Перетащить divider — пропорции меняются.
8. **Esc** — режим выключен, шапка снова активна.
9. **Персистентность layout** (после шагов 3–7 с изменённым деревом):
   - **Electron** — перезапустить приложение (`npm run dev`): дерево layout на месте, режим редактирования выключен.
   - **Веб-демо** — обновить страницу (F5): дерево **сбрасывается** к начальному (ключ очищен при bootstrap); без перезагрузки правки остаются до закрытия вкладки.
