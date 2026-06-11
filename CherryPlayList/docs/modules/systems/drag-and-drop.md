# Drag and Drop

Универсальная система перетаскивания треков и групп между workspace.

## Описание

Workspace-agnostic система drag & drop, работающая с любыми track-based workspace через workspace ID. Поддерживает перетаскивание внутри workspace, cross-workspace операции и копирование с Ctrl/Cmd.

## Архитектура

Модуль построен на принципе **flat index**: вся логика позиционирования работает с плоским индексом (`flatIndex`) в визуальном списке, а преобразование в иерархическую структуру (`parentId`, `localIndex`) происходит только в момент вставки.

### Основные компоненты

- **types** (`src/modules/dragDrop/types.ts`) — типы команд и состояния
- **dropPositionUtils** (`src/modules/dragDrop/dropPositionUtils.ts`) — утилиты расчёта позиции вставки
- **dragDropStore** (`src/shared/stores/dragDropStore.ts`) — глобальное состояние drag-and-drop
- **useWorkspaceDragAndDrop** (`src/shared/hooks/useWorkspaceDragAndDrop.ts`) — единый хук для всех workspaces; внешний OS drop обрабатывается через `nativeDataTransferPaths` (`src/shared/utils/nativeDataTransferPaths.ts`), preload `window.api.getPathForFile` и IPC `fileBrowser:statFile` (см. раздел про нативный drop ниже)
- **useDragDropExecutor** (`src/shared/hooks/useDragDropExecutor.ts`) — выполнение cross-workspace операций
- **ItemList** (`src/shared/components/ItemList/ItemList.tsx`) — контейнер списка с поддержкой drop-индикаторов; при drop на пустую область контейнера передаёт в обработчик позицию курсора как `insertIndex`, поэтому вставка идёт не обязательно в конец списка

## Алгоритм

### DRAG (начало перетаскивания)

1. Определяем корневые элементы для перетаскивания:
   - Если элемент в выделении — берём все выделенные
   - Если группа — она считается одним корневым элементом (её содержимое не выделяется отдельно)
2. Собираем `allFlatIndices` — все flatIndex включая вложенные элементы групп
3. Сортируем `rootIds` по flatIndex
4. Сохраняем в `dragDropStore`

### DROP (завершение перетаскивания)

```
┌─────────────────────────────────────────────────────────────┐
│  1. Вычисляем rawInsertIndex                                │
│     rawInsertIndex = targetFlatIndex + (bottom ? 1 : 0)     │
├─────────────────────────────────────────────────────────────┤
│  2. Если same workspace:                                    │
│     a) Проверяем drop внутрь себя → отмена                  │
│     b) Корректируем индекс:                                 │
│        adjustedIndex = rawIndex - countAbove                │
│        где countAbove = кол-во перетаскиваемых элементов    │
│        с flatIndex < rawIndex                               │
├─────────────────────────────────────────────────────────────┤
│  3. Конвертируем flatIndex → (parentId, localIndex)         │
│     - Если индекс за пределами списка → конец корня         │
│     - Иначе берём parentGroupId элемента на этой позиции    │
├─────────────────────────────────────────────────────────────┤
│  4. Удаляем из источника (для move)                         │
├─────────────────────────────────────────────────────────────┤
│  5. Вставляем в целевую позицию                             │
└─────────────────────────────────────────────────────────────┘
```

### Пример

```
Исходное состояние:
flatIndex | элемент      | parentGroupId
----------|--------------|---------------
0         | Группа A     | null          ← перетаскиваем
1         |   Трек 1     | группаA
2         |   Трек 2     | группаA
3         | Группа B     | null
4         |   Трек 3     | группаB
5         |   Трек 4     | группаB       ← drop здесь (bottom)
6         | Трек C       | null

Перетаскиваем Группа A:
- rootIds: ['группаA']
- allFlatIndices: {0, 1, 2}

Drop на Трек 4 (position: 'bottom'):
1. rawInsertIndex = 5 + 1 = 6
2. Same workspace:
   - allFlatIndices.has(5) = false → OK
   - countAbove = 3 (элементы 0, 1, 2 < 6)
   - adjustedIndex = 6 - 3 = 3
3. После удаления displayItems[3] → Трек 4, parentGroupId = 'группаB'
4. Вставляем в группу B на позицию 1

Результат:
├─ Группа B
│  ├─ Трек 3
│  ├─ Группа A      ← вставлено между Трек 3 и Трек 4
│  │  ├─ Трек 1
│  │  └─ Трек 2
│  └─ Трек 4
└─ Трек C
```

## Проверка drop внутрь себя

Нельзя перетащить группу внутрь себя или в своё содержимое

## Выполнение операций

Все операции перемещения (same-workspace и cross-workspace) выполняются через единый `useDragDropExecutor`:

```
┌─────────────────────────────────────────────────────────────┐
│  1. prepareMoveCommand / prepareCopyCommand                 │
│     Подготавливает команду с валидацией                     │
├─────────────────────────────────────────────────────────────┤
│  2. executeMove / executeCopy (useDragDropExecutor)         │
│     a) Собирает позиции элементов из source workspace       │
│     b) Удаляет элементы из source (removeItemsById)         │
│     c) Вставляет в target (insertItemsAtPosition)           │
├─────────────────────────────────────────────────────────────┤
│  3. Запись в историю (pushCompositeCommand)                 │
│     CompositeAction {                                       │
│       parts: [                                              │
│         { workspaceId: source, RemoveItemsAtPositionsCmd }, │
│         { workspaceId: target, AddItemsAtPositionsCmd }     │
│       ]                                                     │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
```

### Same-workspace vs Cross-workspace

| Аспект                | Same-workspace                  | Cross-workspace |
| --------------------- | ------------------------------- | --------------- |
| Корректировка индекса | Да (countAbove)                 | Нет             |
| Клонирование ID       | Нет (сохраняются)               | Да (новые UUID) |
| История               | CompositeAction (source=target) | CompositeAction |

## Функциональность

- Перетаскивание внутри workspace (reordering)
- Cross-workspace операции (playlist ↔ collection ↔ player)
- Перетаскивание файлов и папок из FileBrowser и **внешний drop из ОС** (например Проводник Windows) — см. подраздел ниже
- Копирование с Ctrl/Cmd (cross-workspace)
- Визуальные индикаторы (линия вставки, полупрозрачность)
- Групповое перетаскивание выделенных элементов
- Вставка внутрь групп
- Drop на пустую область списка или на нижнюю часть отсечки/между треками: позиция вставки определяется по положению курсора (ItemList передаёт `insertIndex` в `onDrop`/`onDragOver`); расчёт `rawInsertIndex` с учётом `bottom` и конвертация flatIndex → (parentId, localIndex) обеспечивают вставку в нужное место, а не всегда в конец списка
- Полная поддержка undo/redo через CompositeAction

### Внутренний JSON и нативный OS drop (`DataTransfer.files`)

Два независимых способа передать файлы/папки в track-based workspace (плейлист, коллекция, список треков плеера):

| Источник | Представление в `DataTransfer` | Пути и тип (файл / каталог) |
| -------- | ------------------------------ | --------------------------- |
| **FileBrowser** | MIME `application/json`: `type: fileBrowser` (массивы `paths` / `directories`) или устаревший `type: files` | Пути уже в JSON; для этого drop не вызываются `getPathForFile` и `statFile` |
| **ОС (Проводник и др.)** | Непустой `DataTransfer.files` | Абсолютный путь: `window.api.getPathForFile` (preload — обёртка над Electron `webUtils.getPathForFile`), при необходимости запасной вариант — поле `.path` у `File`; файл или каталог — по IPC **`fileBrowser:statFile`** (как в браузере файлов). Утилиты: `tryParseInternalFileBrowserPayload`, `collectNativePathsFromDataTransfer`, `classifyNativePathsWithStat` в `nativeDataTransferPaths.ts` |

**Приоритет:** сначала разбирается внутренний JSON (`tryParseInternalFileBrowserPayload`). Если пейлоад распознан, обрабатывается только он; ветка по нативным `files` для этого события **не выполняется** — иначе смешанный drag мог бы подменить пути из FileBrowser данными ОС.

**После получения путей:** для файлов остаются только пути, проходящие `isValidAudioFile`; остальные отбрасываются **без отдельного сообщения**. Каталоги раскрываются через **`loadFolderTracks`** (тот же сценарий, что при перетаскивании папки из FileBrowser).

**Ошибки и частичный успех (нативный drop):**

- Не удалось извлечь ни одного пути из элементов `files` — вставки нет, пользователю показывается ошибка.
- Пути есть, но после вызовов **`statFile`** ни один не классифицирован как файл или каталог (все попытки завершились исключением на стороне main, например нет доступа или объект не найден) — вставки нет, ошибка; если известно число таких сбоев, оно может попасть в текст сообщения. Это именно **сбой stat по IPC**, а не проверка «валидности аудио».
- Часть путей успешно классифицирована, часть дала сбой `statFile` — успешные обрабатываются, дополнительно показывается предупреждение, что часть элементов пропущена.
- Ошибка чтения **одной** папки в `loadFolderTracks` логируется, остальные папки обрабатываются; если после фильтра аудио не осталось, треки могут не добавиться без отдельного сообщения.
- Непойманное исключение в асинхронной ветке нативного drop приводит к сообщению об ошибке через общий обработчик.

## Зависимости

**Входящие (используют модуль):**

- PlaylistView, CollectionView, PlayerTracksList

**Исходящие (модуль использует):**

- `projectStoreFactory` — через executor
- `globalHistoryStore` — для записи истории операций
