# PartyTheme (темы вечеринок)

Система **PartyTheme** для CherryPlay Components: визуальный стиль контента вечеринки (плейлист, текущий трек, страница info). Не путать с темой оболочки приложения (тёмная/светлая). См. [GLOSSARY.md](../../GLOSSARY.md).

## Доступные PartyTheme

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

## Отображение названия и подзаголовка

В данных вечеринки используются поля:

- **Название (name)** — обязательное, для каталога и настроек.
- **Заголовок (title)** — необязательный; на экране отображается как **title ?? name** (если заголовок пуст, показывается название).
- **Подзаголовок (subtitle)** — необязательная строка под заголовком.

## PartyDisplay и PartyInfoDisplay: плавающие декорации

Темы, которые поддерживают плавающие декорации (например, падающие лепестки в spring-cross-step), показывают их всегда. Контейнер лепестков ограничен областью компонента (`.party-display` с `position: relative`), поэтому в превью в приложении организатора лепестки остаются в зоне превью, а на полноэкранной странице вечеринки — в зоне страницы.

## Использование

```typescript
import { PlaylistView, applyPartyTheme, PartyThemeId } from '@cherryplay/components';

// Применить PartyTheme к компоненту (в API поле partyThemeId)
<PlaylistView
  playlist={playlistData}
  themeId="cyberpunk"
/>

// Или применить PartyTheme программно
applyPartyTheme('sakura', element);
```

## Структура

Каждая PartyTheme находится в отдельной папке:

- `cyberpunk/` — стили для PartyTheme Cyberpunk
- `sakura/` — стили для PartyTheme Sakura
- `art-deco/` — стили для PartyTheme Art Deco

Каждая папка содержит:

- `playlist.css` — стили для PlaylistView
- `playlist-item.css` — стили для PlaylistItem
- `player.css` — стили для CurrentTrackDisplay
- `index.css` — главный файл, импортирующий все стили и определяющий CSS переменные

## CSS переменные

Каждая PartyTheme определяет свои CSS переменные через атрибут `data-theme`:

- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` - цвета фона
- `--text-primary`, `--text-secondary`, `--text-tertiary` - цвета текста
- `--accent-primary` - цвет акцента
- `--border-color` - цвет границ
