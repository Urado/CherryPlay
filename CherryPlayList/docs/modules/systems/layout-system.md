# Layout System

Универсальная система управления layout интерфейса с рекурсивными контейнерами.

## Описание

Гибкая система для создания сложных многооконных layout с вложенными контейнерами. Поддерживает горизонтальное и вертикальное разделение зон, изменение размеров через drag dividers.

## Основные компоненты

- **layoutStore** (`src/shared/stores/layoutStore.ts`) - Store управления layout
- **SplitContainer** (`src/app/components/SplitContainer.tsx`) - Рекурсивный компонент контейнера
- **WorkspaceRenderer** (`src/app/WorkspaceRenderer.tsx`) - Рендерер workspace в зонах

## Структура данных

- `Zone` - Либо workspace zone, либо container zone
- `WorkspaceZone` - Зона с workspace (id, workspaceId, workspaceType, size)
- `ContainerZone` - Контейнер с вложенными зонами (direction, zones[], sizes[])

## Функциональность

- Рекурсивная структура (до 6 уровней вложенности)
- Процентное распределение размеров (сумма = 100%)
- Минимальный размер зоны: 10px
- Автоматическая очистка контейнеров с 1 дочерним элементом
- Layout presets: simple, collections, collections-vertical, complex
- Сохранение layout между сессиями (localforage)

