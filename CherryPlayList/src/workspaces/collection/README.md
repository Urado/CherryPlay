# Collection Workspace Module

## Описание

Модуль Collection предоставляет функционал для работы с коллекциями треков. Коллекции похожи на плейлисты, но могут иметь динамические ID и поддерживают экспорт в различные форматы.

## Зависимости

### Core

- `@core/types/workspace` - WorkspaceId, WorkspaceType
- `@core/types/track` - Track
- `@core/types/project` - isProjectTrack

### Shared

- `@shared/stores/projectStoreFactory` - создание store для коллекции
- `@shared/stores/globalHistoryStore` - глобальная история undo/redo
- `@shared/stores/uiStore` - уведомления
- `@shared/services/exportService` - экспорт коллекций
- `@shared/services/fileService` - работа с файлами
- `@shared/services/ipcService` - IPC коммуникация
- `@shared/services/collectionPersistenceService` - экспорт JSON, копирование треков, импорт (с guard для web demo)
- `@shared/services/playlistService` - низкоуровневый IPC save/load JSON
- `@shared/hooks/useTrackWorkspaceDragAndDrop` - drag-and-drop
- `@shared/hooks/useTrackDuration` - загрузка длительности треков
- `@shared/components/ProjectItemRow` - компонент элемента коллекции
- `@shared/utils` - утилиты (formatDuration, logger)

## Функциональность

### Основные возможности

1. **Управление треками**
   - Добавление треков (drag-and-drop, файлы, папки)
   - Удаление треков
   - Перемещение треков внутри коллекции
   - Выделение треков (одиночное, множественное, диапазон)

2. **Воспроизведение**
   - Воспроизведение треков
   - Пауза
   - Отображение активного трека

3. **Экспорт**
   - Экспорт в JSON формат
   - Копирование треков в папку
   - Меню экспорта с выбором формата

4. **Редактирование**
   - Изменение названия коллекции
   - Undo/Redo операций через глобальную историю
   - Атомарный откат cross-workspace операций

5. **Drag-and-Drop**
   - Перемещение треков внутри коллекции
   - Перемещение треков между workspace (с атомарным undo)
   - Копирование треков (Ctrl+drag)
   - Добавление файлов и папок

### Особенности реализации

- Использует `ensureProjectStore()` для создания/получения store
- Каждая коллекция имеет свой уникальный store (независимые данные)
- Поддерживает неограниченное количество треков (`maxItems: null`)
- Группы отключены (`supportsGroups: false`)
- История операций через `globalHistoryStore` (глубина 50 операций)
- Cross-workspace операции откатываются атомарно (один Ctrl+Z откатывает и удаление из source, и добавление в target)

## Использование

Модуль используется автоматически через `WorkspaceRenderer` для workspace с типом `'collection'`. Реестр находит модуль по типу, так как ID коллекций динамические.
