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

| ID | Комбинация | Описание |
|----|------------|----------|
| `global.save` | Ctrl+S | Сохранить проект |
| `global.saveAs` | Ctrl+Shift+S | Сохранить как... |
| `global.open` | Ctrl+O | Открыть проект |
| `global.new` | Ctrl+N | Новый проект |

### Операции со списком (list)

| ID | Комбинация | Описание |
|----|------------|----------|
| `list.undo` | Ctrl+Z | Отменить действие |
| `list.redo` | Ctrl+Y / Ctrl+Shift+Z | Повторить действие |
| `list.delete` | Delete | Удалить выделенные |
| `list.selectAll` | Ctrl+A | Выделить все |
| `list.escape` | Escape | Снять выделение |

## Использование

### Инициализация (App.tsx)

```typescript
import { initializeShortcuts } from '@shared/shortcuts';
import { useSettingsStore } from '@shared/stores';

useEffect(() => {
  initializeShortcuts(() => useSettingsStore.getState().keyBindings);
}, []);
```

### Глобальные шорткаты (AppHeader.tsx)

```typescript
import { useGlobalShortcuts } from '@shared/shortcuts';

useGlobalShortcuts({
  'global.save': handleSave,
  'global.saveAs': handleSaveAs,
  'global.open': handleOpen,
  'global.new': handleNew,
});
```

### Шорткаты для списков (PlaylistView.tsx)

```typescript
import { useListShortcuts } from '@shared/shortcuts';

useListShortcuts({
  'list.undo': undo,
  'list.redo': redo,
  'list.delete': hasSelection ? removeSelected : undefined,
  'list.selectAll': selectAll,
  'list.escape': deselectAll,
});
```

### Универсальный hook

```typescript
import { useShortcuts } from '@shared/shortcuts';

useShortcuts({
  'global.save': handleSave,
  'list.undo': undo,
}, { enabled: isActive });
```

## Кастомизация биндингов

Пользовательские биндинги хранятся в `settingsStore.keyBindings`:

```typescript
// Изменить биндинг
useSettingsStore.getState().setKeyBinding('list.delete', {
  code: 'Backspace',
});

// Сбросить все биндинги
useSettingsStore.getState().resetKeyBindings();
```

## Особенности

- **Единый listener** - один `keydown` на весь app
- **Cross-platform** - поддержка Ctrl (Windows/Linux) и Cmd (macOS)
- **Input-aware** - шорткаты блокируются в input/textarea (кроме `allowInInput`)
- **Типобезопасность** - строгие типы для `ShortcutId`
- **Персистентность** - кастомные биндинги сохраняются в localStorage

## Утилиты

```typescript
import { formatKeyBinding, parseShortcutString, isMac } from '@shared/shortcuts';

// Форматирование для UI
formatKeyBinding({ code: 'KeyS', ctrlKey: true }); // "Ctrl+S" или "Cmd+S" на Mac

// Парсинг строки
parseShortcutString('Ctrl+Shift+S'); // { code: 'KeyS', ctrlKey: true, shiftKey: true }
```
