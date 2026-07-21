# Режим редактирования layout

Интерактивное добавление и удаление workspace-зон в дереве layout без правки пресетов в коде. Режим доступен в **Electron** и **веб-демо**.

**Персистентность дерева и workspace:**

| Среда                            | Поведение                                                                                                                                                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Electron** (`npm run dev`)     | Состояние workspace (`activeWorkspace`, `userWorkspaces`, живое `layout`) пишется в Zustand persist (`cherryplaylist-workspaces`, см. [клиентское persist](./modules/systems/persisted-client-state.md)) и **переживает перезапуск** приложения.                 |
| **Веб-демо** (`npm run dev:web`) | При каждом старте bootstrap **очищает** `cherryplaylist-workspaces` ([AC12](./web-demo.md#что-работает-в-демо), `resetDemoPersistStorage`). Правки **не переживают** полную перезагрузку страницы; **внутри одной сессии** (без F5) persist работает как обычно. |

Флаг **`isLayoutEditMode`** и **`baselineLayout`** между сессиями **не** сохраняются (ни в Electron, ни в веб-демо).

См. также: [Layout System](./modules/systems/layout-system.md), [Веб-демо](./web-demo.md), [File Browser](./modules/workspaces/file-browser.md), [Playlist](./modules/workspaces/playlist.md), [Collections](./modules/workspaces/collections.md), [Test Zone](./modules/workspaces/test-zone.md), [WorkspaceMenu](../src/app/components/WorkspaceMenu.tsx) (pill, ✎), [useWorkspaceDirtyGuard](../src/app/hooks/useWorkspaceDirtyGuard.ts) (auto-commit), [Keyboard Shortcuts](./modules/hooks-utils/keyboard-shortcuts.md).

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

### Как понять, что режим включён

Помимо подсветки **✎** (`app-header-workspace-edit-btn--active`):

- **Inline-подсказка** в шапке (`WorkspaceMenu.tsx`): рядом с кнопкой **✎** / **✓** появляется `<span class="app-header-workspace-edit-hint" role="status">` с текстом **«Редактирование окон — Esc для выхода»** (стили — `header.css`).
- Air-области у зон, затемнение workspace, активные dividers — см. § «Поведение UI в режиме редактирования».

---

## Рабочие пространства в шапке

Вместо селектора пресетов — **workspace pill** (имя + ▾) и отдельная кнопка **✎** (`WorkspaceMenu`).

```
[ Имя workspace  ▾ ]  [ ✎ ]
```

| Элемент        | Поведение в edit mode                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Имя в pill** | Кликабельно для **user** и **scratch** — inline-переименование (фиксированная ширина pill, длинный текст прокручивается внутри поля) |
| **▾ (меню)**   | `disabled`; переключение workspace недоступно                                                                                        |
| **✎**          | Активна; выход из режима с auto-commit при dirty                                                                                     |

Меню (только **вне** edit mode, по **▾**):

| Секция         | Содержимое                                              |
| -------------- | ------------------------------------------------------- |
| **Мои**        | Пользовательские workspace; ⋯ → переименовать / удалить |
| **Встроенные** | Built-in пресеты с RU-именами                           |
| —              | **Создать с нуля…**                                     |

Отдельных пунктов **Сохранить** / **Сбросить** в меню **нет** — сохранение автоматическое (см. ниже).

Подробнее о модели — [Layout System](./modules/systems/layout-system.md).

---

## Автосохранение изменений layout

Изменения дерева **не требуют ручного сохранения**. При выходе из edit mode, переключении workspace и auto-commit блокирующих диалогов нет.

| Событие                         | Поведение                                             |
| ------------------------------- | ----------------------------------------------------- |
| **Выход из edit mode** (✎, Esc) | `autoCommitWorkspaceChanges()`                        |
| **Переключение workspace** (▾)  | Сначала auto-commit, затем `activateWorkspace`        |
| **Создать с нуля…** при dirty   | Сначала auto-commit, затем пустой scratch + edit mode |

| Активный workspace | Auto-commit                                                                             |
| ------------------ | --------------------------------------------------------------------------------------- |
| **user**           | Обновляет снимок в `userWorkspaces` (`saveCurrentWorkspace`, без toast)                 |
| **builtin**        | `saveCurrentWorkspaceAsUnnamed()` → **«Без имени»** или **«Без имени 2»**, … (см. ниже) |
| **scratch**        | То же через `saveCurrentWorkspaceAsUnnamed`                                             |

Автоматический fallback built-in (`WorkspaceMenu.tsx`, `useEffect`):

| Условие                       | Fallback | `bypassDirtyGuard`       |
| ----------------------------- | -------- | ------------------------ |
| production + preset `complex` | `simple` | `true` (без auto-commit) |
| preset `aimp-party` (legacy)  | `party`  | `true` (без auto-commit) |

### Именование

Константы и функции — `src/core/types/workspacePreset.ts`:

| Символ                                | Назначение                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `UNNAMED_WORKSPACE_NAME`              | `'Без имени'` — базовое имя для первого auto-save                             |
| `allocateUnnamedWorkspaceName(names)` | Первый свободный auto-имя: «Без имени», затем «Без имени 2», «Без имени 3», … |
| `isUnnamedWorkspaceName(name)`        | `true` для «Без имени» и «Без имени N» (N ≥ 2)                                |

**Правило нумерации:** пока в **Мои** нет записи с именем **«Без имени»**, новый auto-save получает именно его. Если **«Без имени»** уже занят — выдаётся следующий свободный суффикс (`Без имени 2`, `Без имени 3`, …). Если пользователь переименовал единственный «Без имени», следующий auto-save снова может быть **«Без имени»**.

**Pill (шапка):**

- Фиксированная ширина **210px** (`header.css`); длинное имя обрезается / прокручивается в поле ввода.
- **Клик по имени** (user или scratch, в т.ч. в edit mode) → inline-переименование; Enter / blur — сохранить, Esc — отмена (в edit mode Esc в поле имени **не** выходит из layout edit).
- Имена серии «Без имени» / «Без имени N» отображаются **курсивом**.
- Для **scratch** ввод осмысленного имени вызывает `saveCurrentWorkspaceAs(name)` и переводит workspace в **user**.
- Для **user** — `renameUserWorkspace`; ручные имена **уникальны** (дубликат — toast с ошибкой). Вручную задать имя из серии «Без имени N» через pill нельзя (отмена при commit).
- **▾** → ⋯ у записи в **Мои**: переименовать / удалить (альтернатива pill).

---

## Поведение UI в режиме редактирования

### Оболочка workspace (`WorkspaceLayoutEditShell`)

Каждая workspace-зона оборачивается в edit-shell:

- пунктирная рамка вокруг контентной области (`workspace-layout-edit-content-frame`, **1px dashed**, слой **поверх** air-зон — иначе левая/нижняя граница перекрывается);
- затемнение содержимого (overlay поверх `WorkspaceRenderer`, взаимодействие с workspace заблокировано);
- четыре **«воздушные»** области по сторонам (CSS `--layout-edit-air-size`, **24px**): top, right, bottom, left; разделены SVG-диагоналями от углов зоны (`ResizeObserver` пересчитывает геометрию при resize);
- **×** — удалить текущий workspace (`removeWorkspaceZone`); компактная кнопка **22×22px**, смещена **внутрь** контентной области (`air-size + 6px` от угла), яркая иконка на контрастной подложке.

### Оболочка контейнера (`WorkspaceLayoutEditContainerShell`)

Если в `SplitContainer` **две и более** дочерних зон, в edit mode контейнер дополнительно оборачивается в container-shell:

| Направление контейнера | Span-полосы (на всю ширину/высоту ряда) |
| ---------------------- | --------------------------------------- |
| **horizontal**         | **top**, **bottom**                     |
| **vertical**           | **left**, **right**                     |

- Оболочка — flex-контейнер (`workspace-layout-edit-container-shell`): **column** для horizontal split, **row** для vertical. Центральный блок (`workspace-layout-edit-container-shell__content`, `flex: 1 1 auto`) рендерит дочерний split.
- Span-полосы — **flex-дочерние элементы** оболочки (`workspace-layout-edit-container-air`, `flex: 0 0 var(--layout-edit-air-size)`), **не** абсолютные оверлеи. Размер полосы — **24px**, обводка **1px dashed** (`--layout-edit-stroke-color`), фон `--layout-edit-surface`.
- У horizontal-контейнера полосы **сверху и снизу** (на всю ширину ряда); у vertical — **слева и справа** (на всю высоту столбца).
- В каждой полосе — `WorkspaceLayoutEditAirControl` с `iconPlacement="band-center"`: кнопка **на всю площадь полосы** (`workspace-layout-edit-air-control--zone`, `inset: 0`); иконка **+** в центре — только маркер (`pointer-events: none` на иконке). **Вся полоса кликабельна** и открывает picker.
- Клик по span-полосе добавляет workspace **над/под (или слева/справа от) всего ряда**, а не одной зоны — `addAdjacentWorkspaceToContainer` → `addAdjacentWorkspaceToContainerLayout`. Клики **не проходят** сквозь полосу: она занимает своё место в layout. Air-зоны отдельных workspace в ряду остаются кликабельными на **своих** сторонах (`addAdjacentWorkspace`).

### Добавление workspace (picker)

**Workspace air-зоны:** клик в любой точке air-области открывает выпадающий список типов workspace (`WorkspaceLayoutEditAirControl`, portal в `document.body`). Вся air-сторона workspace — нативная кнопка **`<button type="button">`** (не `div[role="button"]`); иконка **+** в центре стороны — только визуальный маркер (`pointer-events: none`). **Enter** / **Space** на air-зоне открывают тот же picker.

**Container span-полосы:** вся полоса (**24px**) кликабельна (`WorkspaceLayoutEditAirControl`, `iconPlacement="band-center"`); клик открывает picker добавления workspace на весь ряд.

| API / действие                                             | Когда                                | Результат                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `addAdjacentWorkspace(zoneId, side, type)`                 | Клик по air-зоне **одной** workspace | Новая зона **с указанной стороны** этой зоны (top/bottom → вертикальный split, left/right → горизонтальный) |
| `addAdjacentWorkspaceToContainer(containerId, side, type)` | Клик по span-полосе **контейнера**   | Новая зона **над/под или слева/справа от всего ряда**                                                       |
| `addInitialWorkspace(type)`                                | Пустой layout, центральный **+**     | Первая зона                                                                                                 |

Ключи открытого picker (`openLayoutEditPickerKey` в `layoutStore`):

| Ключ                    | Функция / константа              | Когда                                                          |
| ----------------------- | -------------------------------- | -------------------------------------------------------------- |
| `{zoneId}:{side}`       | `getLayoutAirPickerKey`          | Air-зона одной workspace                                       |
| `container:{id}:{side}` | `getLayoutContainerAirPickerKey` | Span-полоса контейнера                                         |
| `'empty'`               | `LAYOUT_EMPTY_PICKER_KEY`        | Пустой layout, центральный **+** (`LayoutEmptyWorkspaceState`) |

### Пустой layout

Если в дереве нет ни одной workspace-зоны (`isLayoutEmpty`), вместо split-контейнера показывается `LayoutEmptyWorkspaceState`: по центру кнопка **+** с тем же picker. Первый workspace создаётся через `addInitialWorkspace(workspaceType)`.

### Изменение размеров

В edit mode **разделители split-контейнеров активны** (`SplitContainer.tsx`): можно перетаскивать dividers и менять пропорции зон. В обычном режиме resize по-прежнему работает так же; в edit mode dividers получают класс `split-divider--layout-edit` (только `z-index` для наложения над air-зонами — цвет остаётся как в обычном режиме).

**Минимальные размеры при drag:** тот же путь, что вне edit mode — `getMinSizePercentsForContainer()` + жёсткий clamp по per-type mins соседних зон (см. [Layout System — минимальные размеры](./modules/systems/layout-system.md)). CSS `minWidth`/`minHeight` на зонах **не** используются.

**Невалидный сохранённый layout** (зона уже меньше min): загрузка без авто-fix; первый drag divider применяет clamp и не позволяет **усугубить** нарушение на перетаскиваемой границе.

### Что блокируется в шапке

Пока режим включён:

- **▾** меню workspace (переключение пресетов / пользовательских workspace);
- переименование проекта;
- кнопки настроек, экспорта, аккаунта, demo player (floating);
- **HeaderPlaybackPill** и **HeaderPlayerHost** (`playerInAppHeader`) — `disabled` / `pointer-events: none`, приглушены;
- меню **Проект** (принудительно закрывается при входе в режим);
- **глобальные горячие клавиши** (`useGlobalShortcuts` с `enabled: false`).

**Не** блокируется: **имя в pill** (переименование), кнопка **✎**.

Все зарегистрированные шорткаты в `ShortcutManager` также не срабатывают в edit mode (`isShortcutsBlocked`).

---

## Доступные типы workspace (picker)

Список строится в `workspaceLayoutEditOptions.ts`:

1. Все модули из **`workspaceRegistry`** (`getAllModulesByType()`), включая **`fileBrowser`** (side-effect регистрация в `src/entry.tsx` → `@workspaces/fileBrowser`); имена на русском через `workspaceDisplayNames.ts`.
2. **Singleton-типы**, уже присутствующие в layout, **скрываются** из picker. Тип **`aimp`** в picker **не показывается** (legacy, исключён в `workspaceLayoutEditOptions.ts`).

| Тип             | Примечание                                 |
| --------------- | ------------------------------------------ |
| `playlist`      | один на layout                             |
| `player`        | один на layout (см. правило playback ниже) |
| `demo-player`   | один на layout                             |
| `party-editor`  | один на layout                             |
| `party-preview` | один на layout                             |

**Правило playback (один «плеер» на layout):** в layout допускается только одна зона воспроизведения — `player`. Legacy-зона `aimp` при добавлении/проверке дубликата считается эквивалентом `player`; при миграции layout `aimp` → `player` (`migrateAimpZonesToPlayerInLayout`). В picker `aimp` отсутствует.

Типы **`fileBrowser`**, **`collection`** и **`test1`…`test8`** можно добавлять **несколько раз** (новый `workspaceId` на каждую зону через `generateWorkspaceId()`). Встроенные пресеты явно задают `DEFAULT_FILEBROWSER_WORKSPACE_ID` для единственной fileBrowser-зоны; при загрузке сохранённого layout дубликаты default id переназначаются (`migrateDuplicateFileBrowserWorkspaceIds`).

Сортировка picker — по русскому отображаемому имени.

---

## Добавление и удаление: жизненный цикл workspace

Логика дерева в `layoutWorkspaceOperations.ts`, жизненный цикл store — в `workspaceLifecycle.ts`; вызовы из `layoutStore` (`addAdjacentWorkspace`, `addAdjacentWorkspaceToContainer`, `addInitialWorkspace`, `removeWorkspaceZone`).

### Регистрация модулей при старте

В `src/entry.tsx` side-effect импорты подключают workspace-модули; каждый регистрирует себя в **`workspaceRegistry`**. `WorkspaceRenderer` по `workspaceType` / `workspaceId` находит React-компонент модуля.

### Добавление зоны

1. В дерево layout вставляется новая `WorkspaceZone` (новый `zoneId`, `workspaceId` по типу).
2. Для **динамических** типов `layoutStore` вызывает **`prepareWorkspaceInstance`** (`workspaceLifecycle.ts`):
   - **`collection`**: `ensureProjectStore`, запись в `uiStore.workspaces`, `registerWorkspaceType`;
   - **`fileBrowser`**: `registerWorkspaceType` (path map не создаётся до первой навигации);
   - **`test*`** : `registerWorkspaceType`.
3. **Singleton-типы** (`playlist`, `player`, …) используют **фиксированные** `workspaceId` из `@core/constants/workspace`; отдельный prepare не нужен — store/модуль уже существуют с запуска приложения.

При добавлении зоны (`addAdjacentWorkspace`, `addAdjacentWorkspaceToContainer`, `addInitialWorkspace`):

- **Успех** — toast `success`: «Добавлен workspace: …» (`getWorkspaceAddedMessage`, RU-имя из `workspaceDisplayNames`).
- **Ошибка** — toast `warning` с текстом из `getAddWorkspaceErrorMessage` (дубликат singleton, лимит глубины/зон, недостаток места по mins и т.д.).

### Проверка минимальных размеров при добавлении

Проверка **min-feasibility** применяется ко **всем** путям добавления зоны: **`addAdjacentWorkspace`**, **`addAdjacentWorkspaceToContainer`** и **`addInitialWorkspace`** (первая зона на пустом layout, центральный **+**).

После проверок глубины, singleton и заполненности контейнера `layoutWorkspaceOperations.ts` симулирует итоговое дерево (для adjacent — **50/50 split**, как при реальном insert) и вызывает **`enforceMinSizeFeasibility`**:

1. Текущий **layout viewport** берётся из `layoutViewportBridge` (регистрирует `useWindowMinSize` по размеру хоста layout).
2. `computeMinLayoutSize(proposedTree)` сравнивается с viewport (ширина и высота).
3. Если mins **не помещаются** → `{ ok: false, reason: 'min_size_violation' }` → toast: **«Недостаточно места. Увеличьте окно или измените пропорции разделителями.»**.

Консервативная политика: при **неизвестном** viewport (`null`) добавление **отклоняется** с `min_size_violation`, а не допускается «вслепую». Чистые unit-тесты дерева могут опустить viewport (`undefined`) и пропустить эту проверку.

**Probing vs действие пользователя** при `viewport === null`:

| Контекст | Поведение |
| -------- | --------- |
| **Availability probing** (`canAddAdjacentWorkspace` — показ air **+** на каждом рендере) | Тихий отказ (`ok: false`); **без** toast и **без** console log |
| **User-triggered add** (клик по air/полосе/центральному **+**, выбор типа в picker) | Отказ + toast + **console log** (`logAddAdjacentMinSizeViolation` / `logMinSizeViolation`) |

Минимум считается по **min-content** модели (`computeMinLayoutSize`): вдоль оси split — **сумма** минимумов детей, поперёк — **максимум**; доли (`sizes`) на минимум не влияют. Подробности и пример — § «Модель расчёта минимума» в [Layout System](./modules/systems/layout-system.md).

При отказе по действию пользователя (`min_size_violation`) в консоль пишется подробный **рекурсивный расчёт по горизонтали и вертикали** (`explainMinLayoutSize` / `logAddAdjacentMinSizeViolation`) — видно, какая ось не помещается и вклад каждой зоны.

Увеличьте окно или перераспределите зоны divider'ом, затем повторите добавление.

### Удаление зоны

1. Кнопка **×** в `WorkspaceLayoutEditShell` вызывает `handleRemoveWorkspace`. Перед удалением может показаться нативный **`window.confirm`** (`getRemoveWorkspaceConfirmMessage`):
   - **последняя** workspace-зона в layout: «Удалить последний workspace «…»? Layout станет пустым.»
   - **единственный** workspace singleton-типа в layout: «Удалить единственный workspace «…» этого типа?»
     В остальных случаях подтверждения нет.
2. **`removeWorkspaceFromLayout`** удаляет зону из дерева: размеры соседей перераспределяются, пустые контейнеры схлопываются (`cleanupContainers`). Если удалена **последняя** workspace-зона — layout становится **пустым** (`createEmptyLayout()`).
3. **`layoutStore.removeWorkspaceZone`** применяет новое дерево, затем **`cleanupWorkspaceInstance`** для динамических типов (`collection`, `fileBrowser`, `test*`).
4. **Singleton store** (`playlist`, `player`, …) при удалении зоны из layout **остаётся в памяти** — убирается только привязка зоны в дереве.

### Ограничения при добавлении

| Ограничение                      | Значение                       | Сообщение пользователю                                            |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| Максимальная вложенность         | 6 (`MAX_LAYOUT_DEPTH`)         | «Достигнута максимальная вложенность layout»                      |
| Зон в одном контейнере           | 10 (`MAX_ZONES_PER_CONTAINER`) | «В контейнере уже максимум зон»                                   |
| Дубликат singleton               | —                              | «Этот workspace уже есть в layout»                                |
| Неверная сторона для span-полосы | —                              | «Нельзя добавить workspace с этой стороны контейнера»             |
| Контейнер с одной зоной          | —                              | «Нужно минимум две зоны в ряду» (span-полосы не показываются)     |
| Недостаточно места по mins       | `min_size_violation`           | «Недостаточно места. Увеличьте окно или измените пропорции разделителями.» |

---

## Пресеты vs ручное редактирование

- **Встроенные пресеты** задают начальное дерево через `createLayoutByPreset`; переключение — через **▾** → **Встроенные**.
- В **edit mode** смена workspace **заблокирована** (только ▾ disabled).
- Правки дерева при выходе из edit mode или при переключении workspace **автоматически** сохраняются (см. § «Автосохранение»); built-in при этом форкается в **Мои** с именем по `allocateUnnamedWorkspaceName`, если layout изменился.
- Пустой layout и произвольная конфигурация **валидны**: `LayoutWorkspaceArea` обрабатывает пустое состояние, одиночную зону и контейнеры.
- **Пустой layout вне edit mode**: placeholder «Layout пуст»; подсказка «Нажмите «Настроить окна» ✎ в шапке…» (см. терминологию ниже); центральный **+** — только в edit mode (`LayoutEmptyWorkspaceState`).

### Терминология UI

| Контекст                                           | Текст                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Кнопка **✎** (`title` / `aria-label`)              | **«Настроить окна»** (вход), **«Выйти из режима редактирования (Esc)»** / **«Готово»** (выход) |
| Placeholder пустого layout (`LayoutWorkspaceArea`) | **«Нажмите «Настроить окна» ✎ в шапке, чтобы добавить workspace»**                             |

Открытие/создание **проекта** (.cherry) **не** меняет активный workspace (настройки уровня приложения).

---

## Связанные файлы

| Путь                                                       | Роль                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/shared/stores/layoutStore.ts`                         | Workspace state, persist, auto-commit, edit mode                                         |
| `src/app/components/WorkspaceMenu.tsx`                     | Pill, dropdown, inline rename, ✎, inline edit hint (`app-header-workspace-edit-hint`)    |
| `src/app/App.tsx`                                          | Esc-обработка edit mode, `useWindowMinSize`                                              |
| `src/app/hooks/useWorkspaceDirtyGuard.ts`                  | Auto-commit перед switch / exit / scratch                                                |
| `src/core/types/workspacePreset.ts`                        | Типы, `UNNAMED_WORKSPACE_NAME`                                                           |
| `src/shared/utils/layoutWorkspaceOperations.ts`            | Add/remove дерева, singleton, `enforceMinSizeFeasibility`, `getAddWorkspaceErrorMessage` |
| `src/shared/utils/layoutWorkspaceMins.ts`                  | `computeMinLayoutSize`, per-type mins lookup                                             |
| `src/shared/utils/layoutViewportBridge.ts`                 | Live layout viewport для add-adjacent check                                              |
| `src/app/hooks/useWindowMinSize.ts`                        | Electron: динамический min окна + регистрация viewport                                   |
| `src/shared/utils/workspaceLifecycle.ts`                   | `prepareWorkspaceInstance` / `cleanupWorkspaceInstance`                                  |
| `src/app/components/LayoutWorkspaceArea.tsx`               | Пустой / root workspace / `SplitContainer`                                               |
| `src/app/components/LayoutEmptyWorkspaceState.tsx`         | Пустой layout в edit mode, picker с ключом `'empty'`                                     |
| `src/app/components/workspaceLayoutEditOptions.ts`         | Список типов для picker (singleton, без `aimp`)                                          |
| `src/app/components/WorkspacePickerMenu.tsx`               | Portal-меню выбора типа workspace                                                        |
| `src/app/components/SplitContainer.tsx`                    | Рекурсивный split; container-shell при 2+ зонах в edit mode                              |
| `src/app/components/WorkspaceLayoutEditShell.tsx`          | Edit-frame workspace, air-регионы, content-frame, удаление                               |
| `src/app/components/WorkspaceLayoutEditContainerShell.tsx` | Flex span-полосы контейнера (24px, клик по всей полосе)                                  |
| `src/app/components/WorkspaceLayoutEditAirControl.tsx`     | Кнопка air-зоны / центральный **+** на полосе, picker                                    |
| `src/styles/components/app.css`                            | Стили edit mode (air-size, рамки, container-air, ×)                                      |
| `src/styles/components/header.css`                         | Стили pill (фикс. ширина), edit mode                                                     |

---

## Как проверить

1. `npm run dev` (Electron) или `npm run dev:web`.
2. **✎** — inline-подсказка «Редактирование окон — Esc для выхода» рядом с **✎** в шапке; у каждой зоны air-области (клик по зоне → picker) и ×; контент затемнён; рамка видна со всех сторон.
3. У горизонтального ряда из 2+ зон — span-полосы **сверху/снизу**; у вертикального столбца — **слева/справа**; клик **в любой точке** полосы открывает picker и добавляет workspace на весь ряд (полоса занимает **24px**, клики не проходят к air-зонам workspace).
4. Клик по air-зоне одной workspace → добавить рядом с ней; **Enter** / **Space** на air-зоне — тот же picker; singleton (`playlist`, `player`, `demo-player`, …) не дублируется в picker; **`fileBrowser`** можно добавить повторно; успех/ошибка — toast.
5. **×** — зона удаляется; для collection очищается store; для fileBrowser — запись path в settings.
6. Удалить все зоны → **✎** → центральный **+** для первой зоны.
7. Перетащить divider — пропорции меняются.
8. Правка built-in → **✎** выход → запись в **Мои** («Без имени» или «Без имени 2», …); клик по имени → задать своё.
9. **Создать с нуля…** → сразу edit mode, pill «Без имени».
10. **▾** → переключение **Мои** / **Встроенные**; при dirty — тихий auto-commit перед switch.
11. Два auto-save с built-in без переименования → в **Мои** «Без имени» и «Без имени 2».
12. **Персистентность** (Electron): перезапуск — workspace и дерево на месте, edit mode выключен. **Веб-демо**: F5 сбрасывает `cherryplaylist-workspaces`.
13. **Минимальные размеры:** при узком окне добавление зоны с большим min может дать toast «Недостаточно места. Увеличьте окно или измените пропорции разделителями.»; divider не сжимает зону ниже per-type min (см. [Layout System](./modules/systems/layout-system.md)).
