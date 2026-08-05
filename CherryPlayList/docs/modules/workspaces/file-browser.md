# File Browser

Обозреватель файлов для просмотра и выбора треков из локальной файловой системы.

**Отображаемое имя в UI:** **«Файловый менеджер»** (`fileBrowser` → `workspaceDisplayNames.ts`). Внутренний id типа — `fileBrowser`. Ранее в UI могло фигурировать «Браузер» / «Источники» — актуальная подпись зон/picker — **«Файловый менеджер»**.

## Описание

Компонент для навигации по файловой системе, поиска аудиофайлов и перетаскивания их в плейлисты и коллекции. Поддерживает рекурсивный поиск и отображение результатов с путями.

## Где используется

Зона `fileBrowser` в layout — полноценный **`IWorkspaceModule`** в `workspaceRegistry`:

| | |
| --- | --- |
| **Модуль** | `src/workspaces/fileBrowser/index.ts` — `type: 'fileBrowser'`, компонент `FileBrowserWorkspaceView` (`SourcesPanel` + заголовок панели) |
| **Регистрация** | Side-effect импорт `@workspaces/fileBrowser` в `src/entry.tsx` (как у `playlist`, `collection`, …) |
| **Рендер** | `WorkspaceRenderer` по `workspaceType` из реестра (без отдельной ветки `if (fileBrowser)`) |

**Минимальные размеры зоны** (placeholder, см. [Layout System — минимальные размеры](../systems/layout-system.md)): **`minWidth` 240**, **`minHeight` 200** — на контракте модуля; enforcement через split clamp и add-adjacent check, не через CSS.

**Несколько панелей в одном layout:** тип `fileBrowser` **не singleton** — в edit mode можно добавить вторую и последующие зоны (как `collection`). Каждая зона получает **уникальный** `workspaceId` (`generateWorkspaceId()` при добавлении через picker). Встроенные пресеты по-прежнему задают одну зону с фиксированным `DEFAULT_FILEBROWSER_WORKSPACE_ID` (`default-filebrowser-workspace`).

## Multi-instance (MVP)

| Аспект | Поведение |
|--------|-----------|
| **Props** | `FileBrowser({ workspaceId })`, `SourcesPanel({ workspaceId })` |
| **Текущая папка** | `settingsStore.fileBrowserPathsByWorkspaceId[workspaceId]` — см. [Settings Store](../stores/settings-store.md) |
| **История «Назад»** | Локальный state в каждом `FileBrowser` (не persist) |
| **Focus «Показать в браузере»** | Один инстанс по `targetWorkspaceId` — см. [UI Store](../stores/ui-store.md) |
| **Удаление зоны** | `cleanupWorkspaceInstance` удаляет запись пути из map |

**Вне MVP:** переключатель источников (playlists/db) per-zone, отдельные заголовки зон («Файловый менеджер 1/2»), path в узле layout tree.

## Основные компоненты

- **FileBrowserWorkspaceView** (`src/workspaces/fileBrowser/FileBrowserWorkspaceView.tsx`) — оболочка workspace-модуля: `SourcesPanel` с `workspaceId` зоны.
- **FileBrowser** (`src/components/FileBrowser.tsx`) — компонент файлового менеджера; рендерится в панели **«Файловый менеджер»** (`SourcesPanel`).
- **FileBrowserItemRow** (`src/components/FileBrowserItemRow.tsx`) — строка элемента списка на базе ListRowCompound. Для аудиофайлов: сначала кнопка Play (демо-плеер), затем имя и мета; для папок и не-аудио файлов: иконка (папка/файл), затем имя и мета. Расположение совпадает с плейлистом, коллекциями и плеером (кнопка проигрывания в начале строки).

## Строка элемента (файл / папка)

В строке отображаются:

- **Имя** — основная подпись.
- **Вторичная строка (meta)** — для файлов (не папок) выводится дополнительная информация, разделённая символом « • »:
  - **Длительность трека** — для аудиофайлов показывается в формате `M:SS` (загружается асинхронно через `audio:getDuration`) или плейсхолдер «длительность…», пока данные не загружены.
  - **Размер файла** — в KB/MB.
- В будущем в ту же вторичную строку можно добавить другие поля (например, битрейт, частоту дискретизации).

## Инициализация и сохранение пути

Путь **привязан к `workspaceId` зоны**, не к layout или `zoneId`:

1. `getFileBrowserPathForWorkspace(workspaceId)` — если в map есть значение, используется оно; для `DEFAULT_FILEBROWSER_WORKSPACE_ID` допускается fallback на legacy `fileBrowserPath`.
2. Если сохранённого пути нет:
   - **Electron** — папка «Музыка» (`ipcService.getSystemPath('music')`), при ошибке — домашняя папка;
   - **веб-демо** (`usesFixtureFileBrowser`) — корень фикстуры `DEMO_MUSIC_ROOT`.
3. При каждой навигации — `setFileBrowserPathForWorkspace(workspaceId, currentPath)`.

После перезагрузки каждая панель восстанавливает **свой** последний path. Навигация в панели A **не меняет** текущую папку в панели B.

**Миграция:** при rehydrate `settingsStore` legacy `fileBrowserPath` копируется в `fileBrowserPathsByWorkspaceId[DEFAULT_FILEBROWSER_WORKSPACE_ID]`, если map пуст или в нём нет ключа default id. См. [Settings Store](../stores/settings-store.md), [клиентское persist](../systems/persisted-client-state.md).

## Хлебные крошки

- В строке навбара отображается путь (диск → … → родительские папки → текущая папка). Если элементы не помещаются в блок, слева скрываются за кнопкой «…» (как в проводнике Windows).
- По нажатию на «…» открывается выпадающее меню со всеми скрытыми сегментами пути; выбор пункта переходит в соответствующую папку и закрывает меню. Закрытие по клику вне меню и по Escape.

## «Назад» и «Вверх»

Две **разные** операции, как в обычном файловом менеджере:

- **«Назад»** — переход **по истории навигации** к **предыдущему посещённому** каталогу (стек путей с движением к более раннему шагу; при открытии новой папки «впереди» очищается, по аналогии с кнопкой «Назад» в браузере).
- **«Вверх»** — переход **в родительскую папку** в смысле **структуры диска** (на один уровень от текущей папки), независимо от того, откуда пользователь сюда попал.

**Зачем разделять:** после **хлебных крошек** или **диалога «Папка»** текущий каталог может **не** быть «впереди» в линейной иерархии от предыдущего шага; **«Назад»** возвращает к прошлому **решению пользователя**, а **«Вверх»** — к **логическому контейнеру** на диске. Реализация: история — `fileBrowserNavigationHistory` / `fileBrowserNavState` (Back); родитель — отдельный сценарий с записью в стек (Up).

## Функциональность

- Навигация: **история** («Назад»), **родитель** («Вверх»), **хлебные крошки** и выбор папки через системный диалог
- Кнопка «Папка» в навбаре — открывает **системный диалог выбора папки** (в т.ч. на Windows — нативный диалог выбора каталога через `dialog:showOpenDialog` с `properties: ['openDirectory']`)
- Рекурсивный поиск аудиофайлов
- Отображение результатов поиска с полными путями
- Перетаскивание файлов и папок в workspace (порядок треков сохраняется): внутренний drag кладёт пути в `application/json`. Те же целевые списки принимают **drop из Проводника Windows** через нативные `DataTransfer.files` (пути через preload, классификация — `fileBrowser:statFile`); подробно — [Drag and Drop](../systems/drag-and-drop.md). При перетаскивании из браузера: если выделен один элемент — тянется он; если выделено несколько — тянются все выделенные (только файлы и только папки участвуют в drag по отдельности).
- Сортировка: папки сначала, затем файлы (алфавитно)
- Поддержка популярных аудиоформатов (MP3, WAV, FLAC, M4A, OGG)

## Поиск по списку

- Фильтрация по введённому тексту (по имени файла/папки). Запрос дебаунсится (около 300 мс), чтобы не перегружать список при быстром вводе; при переходе на рекурсивный поиск по содержимому это же ограничит частоту IPC-вызовов.

## Выделение

- Обычный клик — выделяется только один элемент.
- Ctrl+Click (Cmd+Click) — переключение выделения элемента (добавить/снять из выделения).
- Shift+Click — выделение диапазона от последнего выделенного до кликнутого элемента.

## «Показать в браузере» (scoped focus)

Запрос идёт через `uiStore.focusFileInBrowser(path, targetWorkspaceId?)`. `uiStore` разрешает цель через `resolveFileBrowserFocusTarget`:

1. Явный `targetWorkspaceId`, если такая `fileBrowser`-зона есть в текущем layout;
2. иначе зона с `DEFAULT_FILEBROWSER_WORKSPACE_ID`;
3. иначе **первая** `fileBrowser`-зона в порядке обхода `collectWorkspaceZones`.

Только `FileBrowser` с matching `workspaceId` обрабатывает `fileBrowserFocusRequest` и вызывает `acknowledgeFileBrowserFocus`. Типичный вызов без target — из `AppHeader` / demo player.

## IPC операции

- `fileBrowser:listDirectory` - Список содержимого папки
- `fileBrowser:findAudioFilesRecursive` - Рекурсивный поиск аудиофайлов
- `fileBrowser:statFile` - Статистика файла/папки
- `audio:getDuration` - Длительность аудиофайла в секундах (для отображения в строке трека)

## См. также

- [Layout System](../systems/layout-system.md) — per-type mins, min window, JS-only enforcement
- [Settings Store](../stores/settings-store.md) — `fileBrowserPathsByWorkspaceId`
- [UI Store](../stores/ui-store.md) — focus request
- [Режим редактирования layout](../../layout-edit-mode.md) — добавление нескольких зон `fileBrowser`
- [Веб-демо](../../web-demo.md) — несколько fixture-панелей
