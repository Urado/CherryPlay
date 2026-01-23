# Undo/Redo

Глобальная система отмены и повтора действий для всех workspace.

## Архитектура

Реализован **Command Pattern**: каждое действие — объект с методами `execute()` и `undo()`.

```
┌─────────────────────────────────────────────────────────────┐
│                    globalHistoryStore                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  history: CompositeAction[]                          │    │
│  │  historyIndex: number                                │    │
│  │  _applyCommand(workspaceId, command, mode)          │    │
│  │  _onError: callback                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
         pushCommand / pushCompositeCommand
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
┌────────────┐      ┌────────────┐        ┌────────────┐
│ projectStore│      │collectionStore│    │ other stores│
│ _applyCommand│     │ _applyCommand │    │ _applyCommand│
└────────────┘      └────────────┘        └────────────┘
```

## Основные компоненты

- **globalHistoryStore** — глобальный стек истории, хранит `CompositeAction[]`
- **commands/** — классы команд с `execute()`/`undo()`
- **projectStore/_applyCommand** — применение команд к состоянию
- **historyCore** — утилиты клонирования (`cloneItem`, `cloneItems`)

Детальное описание набора команд и их структуры см. в модуле  
[Commands System](./commands-system.md).

## Команды

| Команда | Описание |
|---------|----------|
| `AddItemsCommand` | Добавление элементов в корень |
| `AddItemsAtPositionsCommand` | Добавление элементов с учётом иерархии (parentPath) |
| `RemoveItemsCommand` | Удаление элементов из корня |
| `RemoveItemsAtPositionsCommand` | Удаление элементов с учётом иерархии (parentPath) |
| `MoveItemCommand` | Перемещение одного элемента (устаревшая) |
| `MoveItemsCommand` | Перемещение нескольких элементов (устаревшая) |
| `CreateGroupCommand` | Создание группы |
| `UngroupCommand` | Расформирование группы |
| `RenameGroupCommand` | Переименование группы |
| `SetNameCommand` | Изменение имени проекта |

## Composite Actions

Все drag-and-drop операции (включая same-workspace) записываются как составное действие:

```
CompositeAction {
  parts: [
    { workspaceId: source, command: RemoveItemsAtPositionsCommand },
    { workspaceId: target, command: AddItemsAtPositionsCommand }
  ]
}
```

При same-workspace операции `source === target`, но структура остаётся той же.

При undo все части откатываются **атомарно** в обратном порядке:
1. Undo `AddItemsAtPositionsCommand` — удаляет добавленные элементы
2. Undo `RemoveItemsAtPositionsCommand` — восстанавливает элементы на исходные позиции

## Функциональность

- История до 50 действий (настраивается через `maxDepth`)
- Undo/Redo через Ctrl+Z / Ctrl+Y
- Изоляция от UI: ошибки передаются через `registerErrorHandler` callback
- При ошибке в середине composite action операция прерывается

## Инициализация

```
App.tsx → useEffect:
  1. initializeProjectStoreHistory()  // регистрирует projectStore
  2. initializeGlobalHistory()        // связывает stores с globalHistoryStore
  3. registerErrorHandler()           // подключает notifications
```

