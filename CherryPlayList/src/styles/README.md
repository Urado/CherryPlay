# Styles Architecture

Модульная система стилей с общими токенами оболочки из CherryPlayComponents и локальными CSS-переменными CherryPlayList.

## Структура

```
src/styles/
├── variables.css          # Отступы, типографика и токены режима настройки окон
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

1. **Общая палитра оболочки**: Цвета и токены UI-примитивов предоставляет `@cherryplay/components/styles/primitives.css`
2. **Локальные переменные**: `variables.css` содержит только токены CherryPlayList
3. **Модульность**: Каждый компонент имеет свой CSS модуль
4. **Переиспользование**: Утилиты в `utilities.css` для общих паттернов

## Использование

Все стили импортируются через `src/styles/index.css` в `App.tsx`.

Shell palette активируется атрибутом `data-shell-theme="dark"` в `index.html`. `entry.tsx` импортирует сначала `styles/index.css`, чей первый импорт — `@cherryplay/components/styles/primitives.css`, затем компонентные стили и после них PartyTheme. Общие токены подключаются до локальных таблиц приложения. `variables.css` содержит только токены CherryPashka List для типографики, отступов и режима настройки окон. `src/theme/theme.ts` и `src/theme/generateCSS.ts` не подключены к runtime и не являются источниками отображаемых цветов.

PartyTheme подключается отдельно через `@cherryplay/components/themes/index.css`; атрибут `data-theme` задаёт независимые цвета каждой PartyTheme. Порталы с тематическим содержимым должны иметь собственную обёртку с `data-theme`. Shell-токены не должны заменять переменные PartyTheme.

## Переключение темы (будущее)

Для переключения темы можно динамически обновлять CSS переменные:

```typescript
document.documentElement.style.setProperty('--bg-primary', newTheme.background.primary);
```
