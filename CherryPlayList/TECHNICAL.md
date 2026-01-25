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
│   │   │   │   ├── ProjectItemRow.tsx  # Для треков и групп
│   │   │   │   └── FileRow.tsx         # Для файлов
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
│   │   ├── fileBrowser/   # Модуль браузера файлов
│   │   │   ├── FileBrowserView.tsx
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   └── testZone/     # Тестовые модули
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
- Содержит основной компонент (например, `PlaylistView.tsx`, `CollectionView.tsx`, `FileBrowserView.tsx`)
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
- **Audio**: `audio:getDuration`, `audio:getFileSource`
- **Export**: `export:execute`, `export:aimp`, `export:copyTracksToFolder`
- **Playlist**: `playlist:save`, `playlist:load`
- **Dialog**: `dialog:showOpenDialog`, `dialog:showSaveDialog`, `dialog:showOpenFileDialog`
- **System**: `system:getPath`

Подробнее см. раздел 6.4 в [FULL_DOCUMENTATION.md](./FULL_DOCUMENTATION.md)

### Хранение данных

Приложение использует **localforage** (IndexedDB) для надёжного хранения состояния между сессиями через Zustand `persist` middleware.

**Проблема, которую решает localforage:**

- `localStorage` в Electron может терять данные при спящем режиме или аварийном завершении
- `localStorage` синхронный и блокирует UI поток
- Ограниченный объём хранения (~5-10 МБ)

**Преимущества localforage:**

- **Асинхронное хранение** - не блокирует UI поток
- **Надёжность** - данные сохраняются на диск, не теряются при спящем режиме
- **Больший объём** - до 50% свободного места на диске (vs ~5-10 МБ для localStorage)
- **Поддержка сложных типов** - объекты, массивы, Blobs без сериализации
- **Автоматический выбор драйвера** - IndexedDB > WebSQL > localStorage

**Обновлённые stores:**
Все stores с `persist` middleware используют `electronStorage` (localforage):

- `projectStore` - главный store проекта (треки, группы, настройки, undo/redo)
- `playerSessionStore` - состояние сессии плеера
- `playerItemsStore` - items и группы в плеере
- `playerSettingsStore` - настройки плеера
- `trackWorkspaceStoreFactory` - используется для коллекций
- `settingsStore` - общие настройки приложения
- `layoutStore` - layout интерфейса
- `partyStore` - состояние вечеринки

**Расположение:**

- Storage адаптер: `src/shared/storage/electronStorage.ts`
- Подробнее: [STORAGE_MIGRATION.md](./STORAGE_MIGRATION.md)
