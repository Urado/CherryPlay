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
- **Режим редактирования layout** — интерактивное добавление/удаление workspace в UI (см. [layout-edit-mode.md](../../layout-edit-mode.md))

## Режим редактирования (кратко)

- Переключатель **«Редактировать» / «Готово»** в шапке; **Esc** выходит из режима.
- `isLayoutEditMode` в `layoutStore` **не** персистится (`partialize` сохраняет только `layout`).
- Рендер зон: `LayoutWorkspaceArea` → `SplitContainer` / `WorkspaceLayoutEditShell` / `LayoutEmptyWorkspaceState`.
- Добавление: `layoutWorkspaceOperations.ts` (дерево) + `workspaceLifecycle.ts` (`prepareWorkspaceInstance` для `collection` и `test*`).
- Удаление: `workspaceLifecycle.ts` (`cleanupWorkspaceInstance`) для динамических типов; singleton stores остаются в памяти.

Подробности, ограничения и чеклист проверки — в **[layout-edit-mode.md](../../layout-edit-mode.md)**.

## Дополнительные компоненты (edit mode)

- **LayoutWorkspaceArea** (`src/app/components/LayoutWorkspaceArea.tsx`) — корневой роутер области workspace
- **WorkspaceLayoutEditShell** — оболочка зоны в edit mode (air-регионы, diagonals, удаление)
- **LayoutEmptyWorkspaceState** — пустой layout, первая зона через picker
