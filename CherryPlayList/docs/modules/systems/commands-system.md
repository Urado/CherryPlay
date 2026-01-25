# Commands System

Командная система, лежащая в основе глобального Undo/Redo во всех workspace.

## Обзор

Система реализует **Command Pattern** поверх иерархических данных плейлиста. Любое изменение списка треков/групп оформляется как команда с методами `execute()` и `undo()`.  
Команды объединяются в **CompositeAction**, что позволяет выполнять и откатывать сложные операции (включая cross-workspace drag-and-drop) атомарно.

## Основные файлы

- `src/shared/commands/index.ts` — общие интерфейсы и реестр команд.
- `src/shared/commands/addItemsCommand.ts` — добавление элементов.
- `src/shared/commands/removeItemsCommand.ts` — удаление элементов.
- `src/shared/commands/moveItemsCommand.ts` — перемещение элементов.
- `src/shared/commands/groupCommands.ts` — создание/расформирование/переименование групп.
- `src/shared/stores/globalHistoryStore.ts` — глобальный стек истории `CompositeAction[]`.
- `src/shared/stores/projectStore*` — применение команд к состоянию плейлиста.

## Базовые интерфейсы

Из `src/shared/commands/index.ts`:

- `ItemsState` — минимальное состояние, с которым работают команды:
  - `items: ProjectItem[]` — иерархия треков и групп.
  - `name: string` — имя проекта/плейлиста.
- `CommandResult`:
  - `success: boolean` — успешность выполнения.
  - `newState?: Partial<ItemsState>` — дельта изменений (если есть).
- `HistoryCommand`:
  - `type: string` — строковый тип команды (для логирования и отладки).
  - `execute(state: ItemsState): CommandResult` — применение команды.
  - `undo(state: ItemsState): CommandResult` — откат команды.
- `ItemPosition`:
  - `item: ProjectItem` — сам элемент.
  - `parentPath: string[]` — путь до родительской группы.
  - `index: number` — позиция внутри родителя.

## Набор команд

Реализованные классы команд:

- `AddItemsCommand` — добавление элементов в корень списка.
- `AddItemsAtPositionsCommand` — добавление элементов с учётом иерархии (`parentPath`, `index`).
- `RemoveItemsCommand` — удаление элементов из корня.
- `RemoveNestedItemCommand` — удаление вложенного элемента.
- `RemoveItemsAtPositionsCommand` — удаление элементов по `ItemPosition[]`.
- `MoveItemCommand` — перемещение одного элемента (устаревшая, используется ограниченно).
- `MoveItemsCommand` — перемещение нескольких элементов (устаревшая).
- `CreateGroupCommand` — создание группы из выбранных элементов.
- `UngroupCommand` — расформирование группы.
- `RenameGroupCommand` — переименование группы.
- `SetNameCommand` — изменение имени проекта/плейлиста.

Каждая команда знает только о **структуре данных**, но не о UI. Это позволяет переиспользовать команды в разных workspace.

## CompositeAction и globalHistoryStore

`globalHistoryStore` (`src/shared/stores/globalHistoryStore.ts`) хранит историю как массив `CompositeAction`:

- `CompositeAction`:
  - `id: string` — UUID действия.
  - `parts: CommandPart[]` — набор частей.
  - `timestamp: number` — время создания.
  - `description?: string` — человекочитаемое описание (для будущего UI истории).
- `CommandPart`:
  - `workspaceId: WorkspaceId` — к какому workspace относится часть.
  - `command: HistoryCommand` — сама команда.

Основные операции:

- `pushCommand(workspaceId, command, description?)` — добавить одиночную команду.
- `pushCompositeCommand(parts, description?)` — добавить составное действие из нескольких команд.
- `undo()` / `redo()` — пройти по `parts` в нужном направлении, вызывая `applyCommand(workspaceId, command, mode)`.

При undo/redo:

- Все части внутри `CompositeAction` обрабатываются **атомарно**:
  - Если хотя бы одна команда не может быть применена (workspace недоступен и т.п.), операция прерывается.
  - Через `_onError` сообщается в UI, что undo/redo не удалось.

## Связь с Undo/Redo системой

Системы **Undo/Redo** и **Commands System** тесно связаны:

- Commands System описывает **что** такое команда и как она модифицирует `ItemsState`.
- Undo/Redo описывает **как** команды попадают в историю, как строятся `CompositeAction` и как они откатываются.

Подробнее про управление историей, горячие клавиши и инициализацию см. модуль  
[Undo/Redo](./undo-redo.md).

## Использование в модулях

- **Playlist / Collections**:
  - Добавление/перемещение/удаление треков и групп.
  - Группировка и расформирование.
- **Drag and Drop System**:
  - Любое перетаскивание превращается в `CompositeAction`:
    - удаление из источника (`RemoveItemsAtPositionsCommand`),
    - вставка в цель (`AddItemsAtPositionsCommand`).
- **Другие workspace**:
  - Могут переиспользовать существующие команды или добавлять свои, если работают с тем же форматом `ItemsState`.

Командная система изолирует сложную логику изменения иерархии треков от UI, что упрощает развитие модулей и делает поведение Undo/Redo предсказуемым.
