# План рефакторинга Workspaces

## Цель

Унифицировать модули `playlist`, `player`, `collection` и `fileBrowser` для:
- Устранения дублирования кода (~1500 строк)
- Упрощения добавления новых режимов
- Исправления багов (drop между элементами)
- Улучшения maintainability

---

## Текущие проблемы

### 1. Дублирование кода

| Функционал | Где дублируется |
|------------|-----------------|
| Selection logic (Ctrl/Shift/Single) | Playlist, Player, Collection, FileBrowser |
| Track playback preview | Playlist, Player, Collection, FileBrowser |
| Undo/Redo hotkeys | Playlist, Collection |
| Drag & Drop setup | Playlist, Player, Collection |
| Duration loading | Playlist, Player, Collection |
| Header UI (name + stats) | Playlist, Player, Collection |
| Empty state | Все 4 модуля |
| Кнопки сохранения/загрузки | AppHeader (playlist), PlayerHeader (player) |

### 2. Архитектурные проблемы

- **Двойная синхронизация stores** (playerStore ↔ playerItemsStore)
- **Жёсткий порядок кнопок** в ListItemBase (через флаги)
- **Drop-зоны на элементах** → баг с мёртвыми зонами между элементами
- **Настройки треков не сохраняются** при экспорте Player
- **Прямая зависимость** playlist → player (dividerUtils)
- **Два независимых источника данных** — Playlist и Player не связаны
- **Разные форматы файлов** — `.json` (playlist) vs `.player.json` (player)
- **Playlist не поддерживает группы** — хотя UI и логика уже есть в Player
- **Нет быстрого сохранения** (Ctrl+S) — каждый раз диалог выбора файла

### 3. Проблемы интерфейса

- Смешение русского и английского
- Props explosion в PlayerView (50+ props)
- Неиспользуемый параметр workspaceId

---

## Целевая архитектура

### Уровень 1: Базовые UI-компоненты (Compound Components)

```
shared/components/ListRow/
├── ListRowContext.tsx      # Контекст для передачи состояния children
├── ListRow.tsx             # Главный контейнер строки
├── actions/
│   ├── PlayButton.tsx
│   ├── DeleteButton.tsx
│   ├── DisableButton.tsx
│   ├── DragHandle.tsx
│   ├── Checkbox.tsx
│   └── ActionButton.tsx    # Универсальная кнопка с иконкой
├── content/
│   ├── Index.tsx
│   ├── Content.tsx
│   └── Secondary.tsx       # Универсальный: duration, fileSize и др.
├── Actions.tsx             # Контейнер для группы кнопок справа
└── index.ts
```

**Принцип:** ListRow не знает о данных (Track, File, Group). Это чистый UI-контейнер.

### Уровень 2: Контейнер списка с Drop-логикой

```
shared/components/ItemList/
├── ItemListContext.tsx     # Контекст для drop-состояния
├── ItemList.tsx            # Контейнер с onDragOver/onDrop
├── DropIndicator.tsx       # Линия вставки
├── EmptyState.tsx
└── index.ts
```

**Принцип:** Drop обрабатывается на контейнере, не на элементах. Решает баг с мёртвыми зонами.

### Уровень 3: Общие хуки

```
shared/hooks/
├── useItemSelection.ts     # Логика Ctrl/Shift/Single selection
├── usePlaybackPreview.ts   # Обёртка над useDemoPlayerStore
├── useKeyboardShortcuts.ts # Undo/Redo/Delete/SelectAll
├── useDragAndDrop.ts       # Унифицированная drag-логика
└── useTrackDuration.ts     # Уже существует, без изменений
```

### Уровень 4: Готовые row-компоненты

```
shared/components/rows/
├── PlaylistItemRow.tsx     # Для Playlist/Collection: треки + группы, режим подготовки
├── PlayerItemRow.tsx       # Для Player: треки + группы + session states + settings
└── FileRow.tsx             # Для FileBrowser: файлы + папки
```

**Принцип:** Каждый компонент — готовый "пресет", который внутри собирает нужные children из ListRow.

```
ListRow (Compound Components — базовый)
    │
    ├── PlaylistItemRow     # DragHandle + Checkbox + Index + Content + Play + Delete
    │
    ├── PlayerItemRow       # То же + Settings + Disable + Played indicator
    │
    └── FileRow             # Icon + Content + Size + Play (для аудио)
```

### Уровень 5: Workspace Views

```
workspaces/
├── playlist/
│   └── PlaylistView.tsx    # Использует PlaylistItemRow + ItemList
├── player/
│   └── PlayerView.tsx      # Использует PlayerItemRow + ItemList + session logic
├── collection/
│   └── CollectionView.tsx  # Использует PlaylistItemRow + ItemList + export
├── fileBrowser/
    └── FileBrowserView.tsx # Использует FileRow + ItemList + navigation
```

---

## Разделение ответственности

### ListRow (строка)
- Визуальное отображение
- Состояния (selected, dragging, disabled, active)
- `draggable` + `onDragStart` (как source)
- **НЕ знает** о drop, данных, бизнес-логике

### ItemList (контейнер)
- `onDragOver` — вычисление позиции вставки по clientY
- `onDrop` — обработка drop
- Рендер DropIndicator в нужной позиции
- **НЕ знает** о содержимом элементов

### Workspace View
- Бизнес-логика (session, export, generation)
- Подключение к stores
- Сборка UI из готовых компонентов

---

## Решение бага Drop между элементами

### Текущая проблема
```
[Track 1] ← onDrop работает
   gap    ← МЁРТВАЯ ЗОНА
[Track 2] ← onDrop работает
```

### Решение: Drop на контейнере

```
<ItemList onDragOver={handleDragOver} onDrop={handleDrop}>
  <DropIndicator position={insertIndex} />  ← рендерится динамически
  <ListRow data-index={0} />
  <ListRow data-index={1} />
  <ListRow data-index={2} />
</ItemList>
```

**Алгоритм handleDragOver:**
1. Получить `e.clientY`
2. Для каждого элемента получить `getBoundingClientRect()`
3. Найти элемент, в середине которого находится курсор
4. Определить: вставка до или после этого элемента
5. Установить `insertIndex` для отрисовки DropIndicator

**Результат:** Нет мёртвых зон, drop работает везде.

---

## Единый Project Store

### Проблема: Два независимых источника данных

```
┌─────────────────┐          ┌─────────────────┐
│  playlistStore  │          │ playerItemsStore│
│   (tracks[])    │    ≠     │   (items[])     │
│                 │          │ + playerSettings│
│  + historyStore │          │ + sessionStore  │
└─────────────────┘          └─────────────────┘
        ↓                            ↓
   AppHeader                   PlayerHeader
   (save/load)                 (save/load)
```

- Накидал треки в Playlist → переключился на Player → начинаешь с нуля
- Два разных формата файлов (`.json` vs `.player.json`)
- Дублирование UI сохранения/загрузки
- Нет быстрого сохранения (Ctrl+S)

### Решение: Единый Project Store

```
┌─────────────────────────────────────────────────────────────┐
│                      useProjectStore                         │
│                                                              │
│  name: string                                                │
│  items: ProjectItem[]        # Треки + группы               │
│  settings: ProjectSettings   # Глобальные настройки         │
│  trackSettings: Map<...>     # Настройки отдельных треков   │
│  groupSettings: Map<...>     # Настройки групп              │
│  sessionState?: SessionState # Состояние сессии (опц.)      │
│  meta: {                                                     │
│    filePath?: string         # Для быстрого сохранения      │
│    isDirty: boolean          # Несохранённые изменения      │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
         │                    │ 
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │ Playlist │        │  Player  │
   │   View   │        │   View   │
   └──────────┘        └──────────┘
```

**Все workspace-ы работают с одними данными**, просто показывают разный UI.

### Формат файла проекта (.cherry или .project.json)

```
ProjectFile {
  version: string
  name: string
  
  items: SavedItem[]           # Треки и группы (единая структура)
  
  settings: {
    defaultPauseBetweenTracks: number
    defaultActionAfterTrack: ActionAfterTrack
    plannedEndTime: number | null
    hourDividerInterval: number
  }
  
  trackSettings: Record<string, TrackSettings>
  groupSettings: Record<string, GroupSettings>
  
  sessionState?: {             # Для восстановления сессии
    mode: 'preparation' | 'session'
    playedTrackIds: string[]
    disabledTrackIds: string[]
    currentTrackId: string | null
  }
}
```

### Сценарий использования

1. Пользователь накидывает треки в **Playlist** → данные в Project Store
2. Группирует треки (новая функция!) → группы в том же store
3. Переключается на **Player layout** → те же треки и группы уже там
4. Настраивает паузы, запускает сессию → изменения в том же store
5. **Ctrl+S** → быстрое сохранение (если путь известен) или Save As
6. Загружает файл → всё восстанавливается: треки, группы, настройки, сессия

### UI сохранения/загрузки (централизованно в AppHeader)

```
AppHeader
├── [New]       → Новый проект (очистка + сброс пути)
├── [Save]      → Ctrl+S: быстрое сохранение (или Save As если новый)
├── [Save As]   → Ctrl+Shift+S: сохранить как
├── [Open]      → Ctrl+O: загрузить проект
├── [Recent ▼]  → Список недавних проектов
└── [*]         → Индикатор isDirty (несохранённые изменения)
```

Кнопки сохранения **убираются** из PlayerHeader — они теперь глобальные.

### Миграция старых форматов

```
При загрузке файла:
├── Есть version → новый формат .cherry
├── Есть tracks, нет items → старый playlist.json → миграция
└── Есть groups → старый player.json → миграция
```

### Шаги реализации

1. Создать `useProjectStore` — объединяет все данные
2. Создать `projectService` — единый сервис сохранения/загрузки
3. Добавить поддержку групп в Playlist (UI уже готов в Player)
4. Мигрировать AppHeader — убрать playlist-специфичную логику
5. Мигрировать PlayerHeader — убрать кнопки сохранения
6. Добавить быстрое сохранение (Ctrl+S) с запоминанием пути
7. Добавить индикатор isDirty (звёздочка в заголовке)
8. Добавить "Recent Projects" в меню

---

## Группы в Playlist

### Текущее состояние

| Функция | Player | Playlist |
|---------|--------|----------|
| Треки | ✅ | ✅ |
| Группы | ✅ | ❌ |
| Создание группы | ✅ | ❌ |
| Расформирование | ✅ | ❌ |
| Переименование | ✅ | ❌ |
| Вложенность | ✅ | ❌ |

### После рефакторинга

| Функция | Player | Playlist |
|---------|--------|----------|
| Треки | ✅ | ✅ |
| Группы | ✅ | ✅ |
| Создание группы | ✅ | ✅ |
| Расформирование | ✅ | ✅ |
| Переименование | ✅ | ✅ |
| Вложенность | ✅ | ✅ |
| Режим сессии | ✅ | ❌ (не нужен) |
| Disable/Played | ✅ | ❌ (не нужен) |
| Настройки пауз | ✅ | ❌ (опционально) |

### Разница между Playlist и Player

| Аспект | Playlist | Player |
|--------|----------|--------|
| **Назначение** | Подготовка, сортировка | Воспроизведение, сессия |
| **Режим** | Всегда preparation | preparation → session |
| **Кнопка Play** | Preview (demo player) | Реальное воспроизведение |
| **Disable** | Нет | Да (в режиме session) |
| **Played indicator** | Нет | Да (в режиме session) |
| **Настройки треков** | Нет (или упрощённые) | Полные (паузы, действия) |
| **Streaming** | Нет | Да (SignalR) |

### Реализация: два готовых компонента

Вместо одного компонента с флагами — два готовых "пресета":

**PlaylistItemRow** (для Playlist и Collection):
```
<ListRow>
  <ListRow.DragHandle />
  <ListRow.Checkbox />
  <ListRow.Index /> или <ListRow.UngroupButton />
  <ListRow.Content />
  <ListRow.Secondary />           # duration
  <ListRow.Actions>
    <ListRow.PlayButton />        # preview через demo player
    <ListRow.DeleteButton />
  </ListRow.Actions>
</ListRow>
```

**PlayerItemRow** (для Player):
```
<ListRow>
  <ListRow.DragHandle />
  <ListRow.Checkbox />
  <ListRow.Index /> или <ListRow.UngroupButton />
  <ListRow.Content />
  <ListRow.Secondary />           # duration
  <ListRow.Actions>
    {isPreparationMode && <ListRow.PlayButton />}
    <ListRow.SettingsButton />    # настройки пауз/действий
    {!isPreparationMode && <ListRow.DisableButton />}
    <ListRow.DeleteButton />
  </ListRow.Actions>
</ListRow>
```

## Вынос общих утилит

### dividerUtils → shared
```
shared/utils/dividerUtils.ts  # Переместить из workspaces/player/
```
Убирает прямую зависимость playlist → player.

### Валидация при загрузке
```
shared/utils/validation/
├── playerDataSchema.ts     # Zod/Yup schema для формата .player.json
└── validatePlayerData.ts   # Проверка + graceful degradation
```

### Сохранение настроек треков
Добавить в `playerService.serializePlayerData()` сохранение trackSettings (сейчас теряются).

---

## Фазы реализации

### Фаза 0: Project Store и единое сохранение (2-3 дня) ✅
- [x] Создать `useProjectStore` — единый источник данных
- [x] Создать `projectService` — сохранение/загрузка `.cherry` формата
- [ ] ~~Добавить миграцию старых форматов (playlist.json, player.json)~~ (убрано — без обратной совместимости)
- [x] Рефакторинг AppHeader — единые кнопки Save/Load/New
- [x] Добавить быстрое сохранение (Ctrl+S с запоминанием пути)
- [x] Добавить индикатор isDirty (несохранённые изменения)
- [x] Удалить кнопки сохранения из PlayerHeader

### Фаза 1: Базовые компоненты (2-3 дня) ✅
- [x] Создать ListRow с Compound Components
- [x] Создать ItemList с drop-логикой на контейнере
- [x] Создать базовые хуки (useItemSelection, useKeyboardShortcuts)
- [x] Добавить DropIndicator

### Фаза 2: Унификация Playlist и Player (3-4 дня) ✅
- [x] Создать `ProjectItemRow` — универсальный компонент (треки + группы)
- [x] Добавить поддержку групп в Playlist
- [x] Добавить кнопку "Создать группу" в Playlist
- [x] Добавить расформирование/переименование групп в Playlist
- [x] Мигрировать Playlist на новые компоненты
- [x] Мигрировать Player на новые компоненты
- [x] Проверить, что данные сохраняются между переключением views
- [x] Добавить undo/redo в ProjectStore (history, pushHistory, undo, redo)
- [x] Подключить Ctrl+Z/Ctrl+Y в PlaylistView через useKeyboardShortcuts

### Фаза 3: Миграция Collection (1 день) — частично
- [x] Мигрировать Collection на ProjectItemRow
- [ ] ~~Добавить поддержку групп в Collection~~ (отложено — Collection остаётся на отдельном store)
- [x] Сохранить экспорт функционал

> **Примечание:** Collection использует `trackWorkspaceStoreFactory` (отдельный store с встроенной историей). Интеграция с ProjectStore отложена — Collection работает независимо.

### Фаза 4: Миграция FileBrowser (1 день) ✅
- [x] Создать FileRow
- [x] Адаптировать FileBrowser под ItemList
- [x] Сохранить навигационную логику

### Фаза 5: Вынос общих утилит (1 день) — частично
- [x] Перенести dividerUtils в shared
- [x] Добавить валидацию при загрузке (projectValidation.ts)
- [x] Исправить сохранение trackSettings
- [ ] Добавить "Recent Projects" в меню (отложено)

---

## Результаты рефакторинга

| Метрика | До | После | Статус |
|---------|-----|-------|--------|
| Строк дублированного кода | ~1500 | ~200 | ✅ |
| Время добавления нового режима | 5-7 дней | 1-2 дня | ✅ |
| Баг drop между элементами | Есть | Исправлен | ✅ |
| Props в PlayerView | 50+ | ~50 (делегирует в PlayerTracksList) | ⚠️ |
| Stores для данных | 5 (разрозненные) | 1 (ProjectStore) + 1 (Collection) | ✅ |
| Форматы файлов | 2 (.json, .player.json) | 1 (.cherry) | ✅ |
| Переключение Playlist↔Player | Данные теряются | Данные сохраняются | ✅ |
| Группы в Playlist | ❌ | ✅ | ✅ |
| Быстрое сохранение Ctrl+S | ❌ | ✅ | ✅ |
| Индикатор несохранённых изменений | ❌ | ✅ | ✅ |
| Undo/Redo в Playlist | ❌ | ✅ | ✅ |

### Примечания
- **PlayerView props**: PlayerView делегирует рендеринг в PlayerTracksList, но API всё ещё содержит много props. Дальнейшая оптимизация возможна через контекст.
- **Collection**: Остаётся на отдельном store (`trackWorkspaceStoreFactory`) с встроенной историей. Интеграция с ProjectStore отложена.

---

## Риски и митигация

| Риск | Митигация |
|------|-----------|
| Регрессии при миграции | Покрыть тестами критичные сценарии до начала |
| Сложность отладки Compound Components | Добавить displayName, React DevTools |
| Производительность больших списков | Подготовить к виртуализации (react-window) |

---

## Открытые вопросы

1. **Виртуализация:** Нужна ли сейчас или отложить?
2. **i18n:** Внедрять в рамках рефакторинга или отдельно?
3. **Тесты:** Unit или E2E для проверки миграции?
4. **Расширение файла:** `.cherry`, `.project.json` или другое?
5. **Настройки пауз в Playlist:** Показывать кнопку настроек или только в Player?
6. **Автосохранение:** Добавить автосохранение каждые N минут?

---

## Связанные документы

- `STREAMING_ARCHITECTURE.md` — архитектура стриминга
- `workspaces/player/REQUIREMENTS.md` — требования к Player
