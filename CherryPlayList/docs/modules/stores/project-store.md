# Project Store

Главный store проекта, управляющий всеми данными проекта.

## Описание

Централизованный store для хранения треков, групп, настроек и состояния сессии. Поддерживает иерархическую структуру (группы с вложенными элементами) и undo/redo.

## Основные компоненты

- **projectStore** (`src/shared/stores/projectStore.ts`) - Главный store
- **projectStoreCore** (`src/shared/stores/projectStoreCore.ts`) - Базовые функции работы с данными
- **projectStoreFactory** (`src/shared/stores/projectStoreFactory.ts`) - Factory для создания stores

## Структура данных

- `items: ProjectItem[]` - Треки и группы (иерархическая структура)
- `settings: ProjectSettings` - Глобальные настройки проекта
- `trackSettings: Map<string, ProjectTrackSettings>` - Настройки отдельных треков
- `groupSettings: Map<string, ProjectGroupSettings>` - Настройки групп
- `sessionState: ProjectSessionState` - Состояние сессии (mode, played tracks)
- `meta: ProjectMeta` - Метаданные (filePath, isDirty, lastSavedAt)

## Основные операции

- Управление треками: добавление, удаление, перемещение
- Управление группами: создание, расформирование, переименование
- Выделение элементов (single, multiple, range)
- Undo/Redo через globalHistoryStore
- Сохранение/загрузка проектов (.cherry формат)
- `setPortableMode(value: boolean)` — включает/выключает портативный режим; обновляет `settings.portableMode` и помечает проект как изменённый

## Настройки проекта

`settings.portableMode: boolean` (default `false`) — флаг портативного режима. Хранится в `.cherry` файле как часть `ProjectSettings`. Управляется через `setPortableMode`. Не путать с настройками приложения (`settingsStore`) — это настройка конкретного проекта.
