# Playlist Workspace Module

## Описание

Модуль Playlist предоставляет основной функционал плейлиста - управление списком треков, их воспроизведение, редактирование и навигацию. Это центральный модуль приложения, который используется по умолчанию.

## Структура модуля

```
workspaces/playlist/
├── PlaylistView.tsx    # Основной компонент плейлиста
├── index.ts            # Регистрация модуля в реестре
└── README.md          # Документация модуля
```

## Зависимости

### Core
- `@core/types/workspace` - WorkspaceId, WorkspaceType
- `@core/types/track` - Track
- `@core/constants/workspace` - DEFAULT_PLAYLIST_WORKSPACE_ID

### Shared
- `@shared/stores/playlistStore` - store плейлиста с треками и операциями
- `@shared/stores/demoPlayerStore` - управление воспроизведением
- `@shared/stores/settingsStore` - настройки (отсечки по времени)
- `@shared/services/fileService` - работа с файлами
- `@shared/services/ipcService` - IPC коммуникация
- `@shared/hooks/useTrackWorkspaceDragAndDrop` - drag-and-drop
- `@shared/hooks/useTrackDuration` - загрузка длительности треков
- `@shared/components/PlaylistItem` - компонент элемента плейлиста
- `@shared/utils` - утилиты (formatDuration, logger)

## Функциональность

### Основные возможности

1. **Управление треками**
   - Добавление треков (drag-and-drop, файлы, папки)
   - Удаление треков
   - Перемещение треков внутри плейлиста
   - Выделение треков (одиночное, множественное, диапазон)

2. **Воспроизведение**
   - Воспроизведение треков
   - Пауза
   - Отображение активного трека
   - Интеграция с DemoPlayer

3. **Редактирование**
   - Изменение названия плейлиста
   - Undo/Redo операций
   - История изменений

4. **Отсечки по времени**
   - Настраиваемые интервалы (15, 30, 60 минут и т.д.)
   - Визуальные маркеры в списке треков
   - Форматирование меток (hh:mm)

5. **Drag-and-Drop**
   - Перемещение треков внутри плейлиста
   - Перемещение треков между workspace
   - Копирование треков (Ctrl+drag)
   - Добавление файлов и папок

### Особенности реализации

- Использует `usePlaylistStore()` для управления состоянием
- Поддерживает историю операций (undo/redo)
- Автоматическая загрузка длительности треков
- Горячие клавиши: Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo)

## Использование

Модуль используется автоматически через `WorkspaceRenderer` для workspace с типом `'playlist'` и ID `DEFAULT_PLAYLIST_WORKSPACE_ID`.
