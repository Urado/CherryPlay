# Keyboard Shortcuts

Централизованная система управления клавиатурными сокращениями с поддержкой кастомизации.

## Описание

Модуль предоставляет единую точку входа для всех клавиатурных сокращений приложения.
Использует singleton `ShortcutManager` с одним глобальным `keydown` listener.

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    ShortcutManager                       │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │  handlers     │  │  bindings     │  │  keydown    │ │
│  │  (Map)        │  │  (from store) │  │  listener   │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
         ↑                    ↑
         │                    │
    useShortcuts()    settingsStore.keyBindings
```

## Основные компоненты

- **`src/shared/shortcuts/shortcutTypes.ts`** - Типы и интерфейсы
- **`src/shared/shortcuts/shortcutDefinitions.ts`** - Дефолтные биндинги
- **`src/shared/shortcuts/shortcutUtils.ts`** - Утилиты для работы с клавишами
- **`src/shared/shortcuts/ShortcutManager.ts`** - Singleton менеджер
- **`src/shared/shortcuts/useShortcuts.ts`** - React hooks

## Поддерживаемые сокращения

### Глобальные (global)

| ID              | Комбинация   | Описание         |
| --------------- | ------------ | ---------------- |
| `global.save`   | Ctrl+S       | Сохранить проект |
| `global.saveAs` | Ctrl+Shift+S | Сохранить как… |
| `global.open`   | Ctrl+O       | Открыть проект   |
| `global.new`    | Ctrl+N       | Новый проект     |

### Операции со списком (list)

| ID               | Комбинация            | Описание           |
| ---------------- | --------------------- | ------------------ |
| `list.undo`      | Ctrl+Z                | Отменить действие  |
| `list.redo`      | Ctrl+Y / Ctrl+Shift+Z | Повторить действие |
| `list.delete`    | Delete                | Удалить выделенные |
| `list.selectAll` | Ctrl+A                | Выделить все       |
| `list.escape`    | Escape                | Снять выделение    |

### Плеер (player)

| ID                   | Комбинация | Описание               |
| -------------------- | ---------- | ---------------------- |
| `player.togglePlay`  | Space      | Пауза / воспроизведение (сессия) |

Обработчик — `toggleSessionPlayPause` (`src/shared/utils/togglePlayPause.ts`):

- **session** — play/pause основного плеера (`playerAudioStore`), если есть `currentTrack`;
- вне session (включая preparation) — no-op; demo player Space не управляет.

**Space и строки списка (`ListRow`):** фокус на строке с `data-list-row` **не** блокирует `player.togglePlay` — Space всё равно переключает play/pause сессии. Сама строка активируется только по **Enter** (Space больше не кликает строку). Блокировка Space сохраняется в полях ввода, диалогах/модалках и на реальных кнопках/нативных контролах (`shouldBlockPlayerSpaceShortcut` в `shortcutUtils.ts`).

См. [Player](../workspaces/player.md).

## Использование

### Инициализация

В `App.tsx` вызывается `initializeShortcuts` с колбэком, возвращающим текущие биндинги из `settingsStore.keyBindings`, и опциональным `isShortcutsBlocked` — глобальная блокировка всех шорткатов (в edit mode layout):

```tsx
initializeShortcuts(() => useSettingsStore.getState().keyBindings, {
  isShortcutsBlocked: () => useLayoutStore.getState().isLayoutEditMode,
});
```

Пока `isShortcutsBlocked()` возвращает `true`, `ShortcutManager.handleKeyDown` не выполняет зарегистрированные handlers (ранний return до match). Выход из layout edit mode по **Esc** обрабатывается отдельным listener в `App.tsx`, не через менеджер.

### Глобальные шорткаты

В `AppHeader.tsx` используется `useGlobalShortcuts` для регистрации обработчиков глобальных действий (save, saveAs, open, new); в UI эти же действия доступны из меню **Файл** в шапке.

### Шорткаты плеера

В `AppHeader.tsx` регистрируется `usePlayerShortcuts({ enabled: !isLayoutEditMode })` — обработчик `player.togglePlay` (см. таблицу категории **player** выше).

### Шорткаты для списков

В компонентах списков (например, `PlaylistView.tsx`) используется `useListShortcuts` для регистрации обработчиков операций со списком (undo, redo, delete, selectAll, escape).

### Универсальный hook

`useShortcuts` позволяет регистрировать любые комбинации шорткатов с опциональным флагом `enabled` для условной активации.

## Кастомизация биндингов

Пользовательские биндинги хранятся в `settingsStore.keyBindings`. Для изменения биндинга используется `setKeyBinding(id, binding)`, для сброса всех биндингов — `resetKeyBindings()`.

## Особенности

- **Единый listener** - один `keydown` на весь app
- **Cross-platform** - поддержка Ctrl (Windows/Linux) и Cmd (macOS)
- **Input-aware** - шорткаты блокируются в `INPUT` / `TEXTAREA` / `contentEditable` (кроме `allowInInput`)
- **Interactive-aware** — для биндингов без модификаторов на **Space** / **Enter** (`isActivationKeyBinding`) при фокусе на интерактивном элементе (`button`, `a`, `select`, `summary`, `option` и роли `button` / `menuitem` / `option` / `tab` / `switch` / `checkbox` / `radio` / `link` / `menuitemcheckbox` / `menuitemradio` / `treeitem` / `row` / `gridcell` / `combobox` / `slider` / `listbox`) handler **не** вызывается — остаётся нативное поведение контрола. **Исключение:** `player.togglePlay` (Space) при фокусе на `ListRow` (`data-list-row`) — см. выше; для него используется отдельный `shouldBlockPlayerSpaceShortcut`.
- **Типобезопасность** - строгие типы для `ShortcutId`
- **Персистентность** — кастомные биндинги в `settingsStore.keyBindings`, persist через **`electronStorage`** (localforage → обычно **IndexedDB**); см. [клиентское persist](../systems/persisted-client-state.md), [Settings Store](../stores/settings-store.md)
- **Режим редактирования layout** — при `layoutStore.isLayoutEditMode === true` `ShortcutManager.handleKeyDown` **не выполняет** зарегистрированные шорткаты. Handlers в `AppHeader` отключаются через `useGlobalShortcuts` / `usePlayerShortcuts` с `{ enabled: !isLayoutEditMode }`. **Esc** в `App.tsx` (`capture: true`): при фокусе в поле имени pill — отмена rename; иначе закрытие picker и `requestExitEditMode()` (auto-commit). См. [layout-edit-mode.md](../../layout-edit-mode.md).

## Модальные окна

Единый контракт клавиатуры для модалок — хук **`useModalKeyboard`** (`src/shared/hooks/useModalKeyboard.ts`) и утилиты **`modalKeyboard.ts`**:

| Клавиша | Поведение |
| ------- | --------- |
| **Enter** | Primary action (`onPrimary`), если передан и не disabled |
| **Escape** | Cancel / close (`onCancel`) |
| **Enter** в `textarea` / `contenteditable` | Новая строка, **не** submit |
| **Enter** на overlay (`.modal-overlay`) | **Ничего** — модалка не закрывается |

Стек вложенных модалок: только верхняя обрабатывает Enter/Escape. Подключено в Settings, Account (включая confirm удаления в **«Мои вечеринки»**), Link Party, Save/Export, Workspace dialogs и др.

Overlay: `onKeyDown={handleOverlayKeyDown}` на `.modal-overlay` предотвращает Enter/Space на backdrop.

См. также [online-mode-ux-synthesis.md](../../online-mode-ux-synthesis.md) (checklist P2).

## Утилиты

Доступны утилиты:

- `formatKeyBinding(binding)` — форматирование биндинга для отображения в UI (возвращает "Ctrl+S" или "Cmd+S" на Mac).
- `parseShortcutString(string)` — парсинг строки с комбинацией клавиш в объект биндинга.
- `isMac` — проверка платформы macOS.
