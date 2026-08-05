# Техническая документация CherryPlayList

## Стек технологий

### Основной стек

- **Electron** - платформа для создания десктопных приложений
- **React** - библиотека для построения пользовательского интерфейса
- **TypeScript** - типизированный JavaScript для повышения надежности кода
- **Zustand** - легковесная библиотека для управления состоянием приложения
- **localforage** - асинхронное хранилище данных (IndexedDB) для надёжного сохранения состояния между сессиями

## Технические требования

### Платформа

- **Выбранная платформа**: Electron
- **Поддерживаемые операционные системы**: Windows, macOS, Linux
- Приложение поддерживает все платформы, на которых работает Electron
- Поддержка локальных аудиофайлов

### Поддерживаемые форматы аудио

- MP3
- WAV
- FLAC
- M4A
- OGG
- (список может быть расширен)

## Архитектура приложения

### Структура проекта

```
CherryPlayList/
├── electron/              # Main процесс Electron (в корне проекта)
│   ├── main.ts           # Точка входа Electron
│   ├── preload.ts        # Preload скрипт для безопасного IPC
│   ├── ipc/              # IPC handlers
│   └── utils/            # Утилиты
├── src/                  # Renderer процесс (React UI)
│   ├── app/              # Компоненты уровня приложения
│   │   ├── App.tsx       # Главный компонент приложения
│   │   ├── WorkspaceRenderer.tsx  # Рендерер workspace через реестр
│   │   └── components/   # Компоненты уровня приложения
│   │       ├── AppHeader.tsx
│   │       ├── AppFooter.tsx
│   │       ├── SettingsModal.tsx
│   │       ├── ExportModal.tsx
│   │       └── SplitContainer.tsx
│   ├── core/             # Базовые типы, интерфейсы, константы
│   │   ├── types/        # Базовые типы (Track, Layout, Workspace)
│   │   ├── interfaces/   # Интерфейсы модулей
│   │   ├── constants/    # Константы
│   │   └── registry/     # Реестр модулей workspace
│   ├── shared/            # Общие компоненты, сервисы, stores
│   │   ├── components/   # Общие компоненты
│   │   │   ├── ListRow/      # Compound component для строк списка
│   │   │   │   ├── ListRow.tsx
│   │   │   │   ├── ListRowContext.tsx
│   │   │   │   ├── Actions.tsx
│   │   │   │   ├── actions/  # Кнопки действий
│   │   │   │   └── content/  # Контент строки
│   │   │   ├── ItemList/     # Контейнер с drop-логикой
│   │   │   │   ├── ItemList.tsx
│   │   │   │   ├── DropIndicator.tsx
│   │   │   │   └── EmptyState.tsx
│   │   │   ├── rows/         # Специализированные строки
│   │   │   │   └── ProjectItemRow.tsx  # Для треков и групп (FileRow удалён)
│   │   │   └── ...           # Другие компоненты
│   │   ├── services/     # Сервисы (IPC, File, Export, Project и т.д.)
│   │   ├── stores/       # Zustand stores
│   │   │   ├── projectStore.ts  # Главный store проекта (с undo/redo)
│   │   │   ├── trackWorkspaceStoreFactory.ts  # Factory для коллекций
│   │   │   └── ...
│   │   ├── storage/      # Storage адаптеры (electronStorage для localforage)
│   │   ├── hooks/        # React hooks
│   │   │   ├── useKeyboardShortcuts.ts  # Ctrl+Z/Y, Delete, Escape и т.д.
│   │   │   ├── useItemSelection.ts      # Логика выделения
│   │   │   └── ...
│   │   └── utils/        # Утилиты
│   │       ├── projectHistoryUtils.ts   # Типы и функции для undo/redo
│   │       ├── projectValidation.ts     # Валидация .cherry файлов
│   │       └── ...
│   ├── workspaces/        # Модули workspace (изолированные)
│   │   ├── playlist/     # Модуль плейлиста
│   │   │   ├── PlaylistView.tsx
│   │   │   ├── component.tsx
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   ├── collection/   # Модуль коллекций
│   │   │   ├── CollectionView.tsx
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   └── testZone/     # Тестовые модули (fileBrowser удалён — используется FileBrowser в components/)
│   │       ├── TestZoneView.tsx
│   │       ├── index.ts
│   │       └── README.md
│   ├── components/        # Общие компоненты (FileBrowser, SourcesPanel)
│   ├── modules/           # Модули (dragDrop)
│   ├── types/             # Дополнительные типы
│   ├── styles/            # Стили
│   └── index.tsx          # Точка входа React
├── public/               # Статические файлы (иконки, изображения)
├── plugins/              # Плагины
├── index.html            # HTML точка входа (в корне, не в public/)
├── vite.config.mjs       # Vite конфигурация (ESM, не .ts)
├── tsconfig.json         # TypeScript конфигурация для React
├── tsconfig.electron.json # TypeScript конфигурация для Electron
├── tsconfig.node.json    # TypeScript конфигурация для Node.js
├── package.json
└── .gitignore
```

**Важно:**

- `electron/` находится в корне проекта, не в `src/`
- `index.html` находится в корне проекта, не в `public/`
- `vite.config.mjs` использует расширение `.mjs` (ESM), не `.ts`

### Модульная архитектура

Проект использует модульную архитектуру, где каждый workspace является изолированным модулем:

- **`core/`** - базовые типы, интерфейсы и константы, используемые всеми модулями
- **`shared/`** - общие компоненты, сервисы, stores и утилиты, используемые несколькими модулями
- **`workspaces/`** - изолированные модули workspace (playlist, collection, fileBrowser и т.д.)
- **`app/`** - компоненты уровня приложения (App, WorkspaceRenderer, модальные окна)

Каждый модуль workspace:

- Имеет собственную папку в `workspaces/`
- Содержит `index.ts` - регистрирует модуль в `WorkspaceRegistry` при импорте
- Содержит основной компонент (например, `PlaylistView.tsx`, `CollectionView.tsx`). Зона **«Файлы»** (`fileBrowser`): `FileBrowser` в `components/`, показывается через SourcesPanel при зоне типа `fileBrowser`.
- Использует только `@core/` и `@shared/` для зависимостей
- Имеет собственную документацию в `README.md`

**Структура workspace модуля:**

- `index.ts` - экспортирует модуль и регистрирует его в `WorkspaceRegistry`
- `[WorkspaceName]View.tsx` - основной React компонент workspace
- `README.md` - документация модуля (опционально другие файлы)

### Path Aliases

Проект использует path aliases для удобного импорта:

- `@core/*` → `src/core/*`
- `@shared/*` → `src/shared/*`
- `@workspaces/*` → `src/workspaces/*`
- `@app/*` → `src/app/*`

Настроены в `tsconfig.json` и `vite.config.mjs`.

### UI-примитивы и CSS-контракт

Оболочка CherryPlayList (модалки, заголовок, строки списка) использует shell-примитивы из `@cherryplay/components` (`Button`, `IconButton`, `Disclosure` и др.). Подробности API — [CherryPlayComponents/README.md](../CherryPlayComponents/README.md#ui-примитивы-shell); контракт слоёв и импорт CSS — [FULL_DOCUMENTATION.md §9.1.0](./FULL_DOCUMENTATION.md#910-ui-layers-and-migration-contract).

### Компоненты приложения

1. **Обозреватель файлов** - просмотр и выбор треков из локальной библиотеки
2. **Редактор плейлиста** - область для формирования последовательности треков
3. **Система перетаскивания** - универсальный механизм drag & drop для управления треками:
   - **Workspace-agnostic дизайн**: Система не зависит от конкретных типов workspace (playlist, collection и т.д.), работает с любыми track-based workspace через workspace ID
   - Реализовано на нативном HTML5 Drag and Drop API (без внешних библиотек)
   - Перетаскивание элемента целиком (атрибут `draggable={true}`)
   - Перетаскиваемый элемент становится полупрозрачным (opacity: 0.5)
   - Тонкая синяя линия-вставка (`drag-insert-line`) показывает место вставки между карточками
   - Линия появляется сверху или снизу элемента в зависимости от позиции курсора (верхняя/нижняя половина элемента)
   - Линия имеет анимацию пульсации для лучшей видимости
   - Элементы не подсвечиваются при наведении (используется только линия вставки)
   - Плавная анимация при перемещении после отпускания
   - Корректный расчет индексов с учетом смещения при перемещении вниз по списку
   - **Cross-workspace операции**: Перетаскивание треков между любыми workspace (playlist ↔ collection, collection ↔ collection и т.д.)
   - **Копирование с Ctrl/Cmd**: Состояние клавиши Ctrl/Cmd определяется в `handleDragOver` и сохраняется в `draggedItems.isCopyMode` для использования в `handleDrop`
   - **Централизованное управление**: Все cross-workspace операции проходят через `dragDropStore`, который использует workspace ID для поиска stores
4. **Модуль экспорта** - обработка и копирование треков с нумерацией

### Основные операции

- Загрузка треков из файловой системы
- Добавление трека в плейлист (drag & drop или клик)
- Переупорядочивание треков в плейлисте (drag & drop)
- Удаление трека из плейлиста
- Экспорт плейлиста в папку с нумерацией

### IPC (Inter-Process Communication)

Коммуникация между main и renderer процессами осуществляется через IPC:

- `ipcMain.handle()` - обработка запросов из renderer
- `ipcRenderer.invoke()` - вызовы из renderer в main
- Все каналы whitelisted в `electron/preload.ts` для безопасности

**Основные IPC каналы:**

- **File Browser**: `fileBrowser:listDirectory`, `fileBrowser:statFile`, `fileBrowser:findAudioFilesRecursive`
- **Audio**: `audio:getDuration`, `audio:getFileUrl` (→ `cherryplay-audio://` streaming protocol)
- **Export**: `export:execute`, `export:aimp`, `export:copyTracksToFolder`
- **Playlist**: `playlist:save`, `playlist:load`
- **Dialog**: `dialog:showOpenDialog`, `dialog:showSaveDialog`, `dialog:showOpenFileDialog`
- **System**: `system:getPath`

Подробнее см. раздел 6.4 в [FULL_DOCUMENTATION.md](./FULL_DOCUMENTATION.md)

### Интеграция с сервером и веб-клиентом

Связь CherryPlayList с **CherryPlayServer** и **CherryPlayWeb** (авторизация, вечеринки, стриминг состояния) описана в разделе документации по интеграции и согласована с планом релиза v1:

- **[Интеграция приложение — сервер — веб](../../docs/integration/README.md)** — обзор подсистем (Accounts & Auth, Party Management, Streaming), роли, ссылки на контракты и БД (общая документация в корне репозитория).
- **[Оглавление документации](./docs/README.md)** — модули, интеграция, [веб-демо](./docs/web-demo.md), [рабочие пространства и edit mode layout](./docs/layout-edit-mode.md) (pill, auto-save, «Без имени»), ссылки на корневые документы репозитория.

### Хранение данных

Приложение использует **localforage** (по умолчанию **IndexedDB** в Chromium) для сохранения части клиентского состояния между сессиями через Zustand **`persist`** и адаптер **`electronStorage`**.

**Проблема, которую решает localforage относительно «голого» localStorage:**

- в Electron `localStorage` может терять данные при спящем режиме или аварийном завершении
- `localStorage` синхронный и блокирует поток UI
- ограниченный объём (~5–10 МБ)

**Преимущества localforage в этой цепочке:**

- **асинхронное** хранение — не блокирует UI
- **больший практический объём** и типично лучшая устойчивость для крупных объектов (плейлист, layout)
- **выбор драйвера:** IndexedDB → WebSQL → localStorage

**Сторы с `persist` + `electronStorage`:**

- **`authStore`** — токен и организатор
- **`settingsStore`** — настройки приложения (экспорт, пути, аудиоустройства, горячие клавиши, стриминг и т.д.)
- **`layoutStore`** — рабочие пространства и дерево зон (persist `cherryplaylist-workspaces`: `activeWorkspace`, `userWorkspaces`, `layout`; `isLayoutEditMode` не персистится — см. [layout-edit-mode.md](./docs/layout-edit-mode.md))
- **`projectStore`** — основной плейлист-проект (треки, группы, сессия, мета, привязка к party в урезанном виде)
- **`ensureProjectStore`** с `persist: true` — отдельные персистентные проекты по **`workspaceId`** (например коллекции), ключ `cherryplaylist-<workspaceId>`

Подробно: **[Storage](./docs/modules/systems/storage.md)** (обзор), **[архитектура клиентского хранения](./docs/modules/systems/storage-architecture.md)**, **[что именно хранится в persist](./docs/modules/systems/persisted-client-state.md)**.

**Расположение в коде:**

- адаптер: `src/shared/storage/electronStorage.ts`

Явное сохранение проекта в файл **`.cherry`** и портативный режим описаны отдельно: [Save / Load](./docs/modules/systems/save-load.md).
