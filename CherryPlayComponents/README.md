# CherryPlay Components

Библиотека React компонентов для отображения плейлистов в CherryPlay.

## Описание

Эта библиотека содержит переиспользуемые компоненты для отображения плейлистов как в Electron приложении (CherryPlayList), так и в веб-приложении (CherryPlayWeb).

## Архитектура

Библиотека построена на основе системы изолированных тем:
- **Core-слой** (`src/core/`) - общие типы, утилиты и хуки
- **PartyTheme** (`src/themes/<themeId>/`) - изолированные наборы компонентов для каждой PartyTheme
- **Палитра оболочки** (`src/styles/shell-palette.css`) - единая нейтральная тёмная палитра для оболочки приложения
- **Фасадный компонент** (`PartyDisplay`) - единая точка входа для фронта, автоматически выбирает нужную тему

## Основной компонент

### PartyDisplay (рекомендуется для фронта)

Единый компонент для отображения вечеринки. Принимает стандартизированные данные и автоматически выбирает нужную тему:

```typescript
import { PartyDisplay, PartyDisplayData } from '@cherryplay/components';

const data: PartyDisplayData = {
  partyId: '...',
  partyName: 'Моя вечеринка',
  themeId: 'cyberpunk', // или 'sakura', 'art-deco'
  customizationSettings: { accentColor: '#00ff00' },
  playlist: { ... },
  playbackState: { ... },
  isSessionActive: true,
};

<PartyDisplay data={data} showPlayer={true} />
```

Фронт не должен знать о внутренней реализации тем - просто передаёт `PartyDisplayData` с указанием `themeId`.

## Дополнительные компоненты (для кастомных композиций)

### PlaylistView
Компонент для отображения плейлиста:
- Поддержка треков и групп
- Рекурсивное отображение вложенных групп
- Отображение текущего трека
- Отображение проигранных и отключенных треков
- Статистика плейлиста (количество треков, общая длительность)

> **Примечание:** Для фронта рекомендуется использовать `PartyDisplay`. Этот компонент оставлен для обратной совместимости и кастомных композиций.

### PlaylistItem
Компонент для отображения отдельного элемента плейлиста (трек или группа):
- Визуальное различие треков и групп
- Отображение длительности
- Поддержка уровней вложенности
- Стилизация для текущего, проигранного и отключенного состояния

### CurrentTrackDisplay
Компонент для отображения текущего трека:
- Название текущего трека
- Статус воспроизведения
- Прогресс-бар
- Время воспроизведения

> **Примечание:** Для фронта рекомендуется использовать `PartyDisplay`. Этот компонент оставлен для обратной совместимости и кастомных композиций.

## Типы

### PlayerItem
```typescript
interface PlayerItem {
  id: string;
  type: 'track' | 'group';
  name: string;
  path?: string; // для трека
  duration?: number; // для трека
  items?: PlayerItem[]; // для группы
  displayOrder: number;
  level: number;
}
```

### PartyPlaylistData
```typescript
interface PartyPlaylistData {
  items: PlayerItem[];
  totalDuration: number;
  totalTracks: number;
}
```

### PlaybackState
```typescript
interface PlaybackState {
  currentTrackId: string | null;
  status: 'idle' | 'playing' | 'paused' | 'ended';
  position: number;
  duration: number;
  volume: number;
  mode: 'preparation' | 'session';
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  lastUpdatedAt: string;
}
```

## Структура библиотеки

```
CherryPlayComponents/
├── src/
│   ├── core/                    # Общий слой
│   │   ├── utils/               # Утилиты (форматирование времени, работа с плейлистом)
│   │   └── hooks/               # React хуки (usePartyThemeVars)
│   ├── styles/                  # Палитра оболочки
│   │   └── shell-palette.css    # Единая палитра для оболочки приложения
│   ├── types/                   # TypeScript типы
│   ├── components/              # Универсальные компоненты (для обратной совместимости)
│   │   ├── PartyDisplay/        # Фасадный компонент
│   │   ├── Playlist/
│   │   └── Player/
│   └── themes/                  # Изолированные темы
│       ├── cyberpunk/            # Компоненты темы Cyberpunk
│       ├── sakura/              # Компоненты темы Sakura
│       └── art-deco/            # Компоненты темы Art Deco
```

## Темы

Каждая тема является полностью изолированным модулем со своими компонентами:
- `PartyDisplay` - главный компонент темы
- `PlaylistView` - компонент плейлиста
- `PlaylistItem` - компонент элемента плейлиста
- `CurrentTrackDisplay` - компонент отображения текущего трека
- `styles/` - CSS стили темы

### Доступные темы

- **cyberpunk** - Неоновая тема в стиле киберпанк
- **sakura** - Нежная пастельная тема
- **art-deco** - Элегантная тема в стиле ар-деко

### Добавление новой темы

1. Создайте директорию `src/themes/<theme-id>/`
2. Реализуйте компоненты темы (PartyDisplay, PlaylistView, PlaylistItem, CurrentTrackDisplay)
3. Добавьте CSS стили в `styles/`
4. Зарегистрируйте PartyTheme в `src/themes/index.ts` в `PARTY_THEME_REGISTRY` используя `createPartyTheme()`

## Стилизация

### Палитра оболочки

Единая нейтральная тёмная палитра для оболочки приложения (кабинет, список, логин, редактор вечеринки и т.д.) находится в `src/styles/shell-palette.css`. Импортируйте её в вашем приложении:

```typescript
import '@cherryplay/components/styles/shell-palette.css';
```

Палитра оболочки определяет CSS переменные на `:root`:
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover` - цвета фона
- `--text-primary`, `--text-secondary`, `--text-tertiary` - цвета текста
- `--border-color` - цвет границ
- `--radius-sm`, `--radius-md`, `--radius-lg` - радиусы скругления
- `--state-error-bg`, `--state-error-text` - состояния ошибок

### PartyTheme

Каждая PartyTheme определяет свои CSS переменные через атрибут `data-theme`:
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` - цвета фона
- `--text-primary`, `--text-secondary`, `--text-tertiary` - цвета текста
- `--accent-primary` - цвет акцента
- `--border-color` - цвет границ

Настройки кастомизации передаются через `customizationSettings` в `PartyDisplayData` и автоматически преобразуются в CSS переменные через хук `usePartyThemeVars`.

## Сборка

```bash
npm run build
```

Генерирует файлы в `dist/`:
- `index.js` - скомпилированный код
- `index.d.ts` - типы TypeScript

