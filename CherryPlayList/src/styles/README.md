# Styles Architecture

Модульная система стилей с использованием CSS переменных из TypeScript темы.

## Структура

```
src/styles/
├── variables.css          # CSS переменные (из TypeScript темы)
├── base.css              # Базовые стили (reset, scrollbar)
├── utilities.css         # Переиспользуемые утилиты
├── index.css             # Главный файл импорта
└── components/
    ├── app.css           # App layout
    ├── header.css        # AppHeader
    ├── playlist.css      # PlaylistView, PlaylistItem
    ├── fileBrowser.css   # FileBrowser, SourcesPanel
    ├── modal.css         # SettingsModal
    ├── notification.css  # NotificationContainer
    └── spinner.css       # Spinner
```

## Принципы

1. **Single Source of Truth**: Все цвета, отступы и типографика определены в `src/theme/`
2. **CSS переменные**: Используются для связи TypeScript темы с CSS
3. **Модульность**: Каждый компонент имеет свой CSS модуль
4. **Переиспользование**: Утилиты в `utilities.css` для общих паттернов

## Использование

Все стили импортируются через `src/styles/index.css` в `App.tsx`.

## Генерация CSS переменных

CSS переменные можно сгенерировать из TypeScript темы используя `src/theme/generateCSS.ts`:

```typescript
import { generateCSSVariables } from './theme/generateCSS';
const css = generateCSSVariables();
```

## Переключение темы (будущее)

Для переключения темы можно динамически обновлять CSS переменные:

```typescript
document.documentElement.style.setProperty('--bg-primary', newTheme.background.primary);
```
