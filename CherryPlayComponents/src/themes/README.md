# Themes

Система тем для CherryPlay Components.

## Доступные темы

### Cyberpunk
Неоновая тема в стиле киберпанк с зелеными акцентами и эффектами свечения.

**Настройки кастомизации:**
- `accentColor` - цвет акцента (по умолчанию #00ff00)
- `glowIntensity` - интенсивность свечения 0-100 (по умолчанию 50)

### Sakura
Нежная пастельная тема с розовыми оттенками.

**Настройки кастомизации:**
- `pinkTint` - оттенок розового (по умолчанию #ffb3d9)
- `backgroundOpacity` - прозрачность фона 0-100 (по умолчанию 80)

### Art Deco
Элегантная тема в стиле ар-деко с золотыми акцентами и геометрическими паттернами.

**Настройки кастомизации:**
- `goldColor` - цвет золота (по умолчанию #d4af37)
- `patternStyle` - стиль паттерна: 'geometric', 'floral', 'linear' (по умолчанию 'geometric')

## Использование

```typescript
import { PlaylistView, applyTheme, ThemeId } from '@cherryplay/components';

// Применить тему к компоненту
<PlaylistView
  playlist={playlistData}
  themeId="cyberpunk"
/>

// Или применить тему программно
applyTheme('sakura', element);
```

## Структура

Каждая тема находится в отдельной папке:
- `cyberpunk/` - файлы стилей для темы Cyberpunk
- `sakura/` - файлы стилей для темы Sakura
- `art-deco/` - файлы стилей для темы Art Deco

Каждая папка содержит:
- `playlist.css` - стили для PlaylistView
- `playlist-item.css` - стили для PlaylistItem
- `player.css` - стили для CurrentTrackDisplay
- `index.css` - главный файл, импортирующий все стили и определяющий CSS переменные

## CSS переменные

Каждая тема определяет свои CSS переменные через атрибут `data-theme`:
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` - цвета фона
- `--text-primary`, `--text-secondary`, `--text-tertiary` - цвета текста
- `--accent-primary` - цвет акцента
- `--border-color` - цвет границ

