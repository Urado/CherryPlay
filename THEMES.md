# Документация по PartyTheme (темы вечеринок) CherryPlay

Единая документация по системе PartyTheme для всех проектов CherryPlay.

## Содержание

- [Обзор](#обзор)
- [Архитектура](#архитектура)
- [Доступные PartyTheme](#доступные-partytheme)
- [Идентификаторы PartyTheme (PartyThemeId)](#идентификаторы-partytheme-partythemeid)
- [Настройки кастомизации](#настройки-кастомизации)
- [Использование в проектах](#использование-в-проектах)
- [API и типы данных](#api-и-типы-данных)
- [Добавление новой PartyTheme](#добавление-новой-partytheme)

## Обзор

CherryPlay использует систему PartyTheme на основе базовых компонентов с CSS-кастомизацией.

**Основные принципы:**

- Базовые компоненты в `themes/base/` используются всеми PartyTheme по умолчанию
- PartyTheme реализуют уникальный внешний вид через CSS и атрибут `data-theme`
- При необходимости PartyTheme может переопределить любой компонент через `overrides`
- Все PartyTheme используют единый API и структуру данных

## Архитектура

```
themes/
├── index.ts           # PARTY_THEME_REGISTRY, createPartyTheme(), BASE_COMPONENTS
├── index.css          # Импорты CSS всех PartyTheme
├── base/              # Базовые компоненты (единственный набор)
│   ├── PartyDisplay.tsx
│   ├── PlaylistView.tsx
│   ├── PlaylistItem.tsx
│   ├── CurrentTrackDisplay.tsx
│   └── index.ts
├── cyberpunk/         # CSS-only PartyTheme
│   ├── index.css
│   ├── playlist.css
│   ├── playlist-item.css
│   └── player.css
├── sakura/            # CSS-only PartyTheme
│   └── *.css
└── art-deco/          # CSS-only PartyTheme
    └── *.css
```

### Как это работает

1. `BASE_COMPONENTS` содержит единственный набор React компонентов
2. `createPartyTheme()` создаёт PartyTheme, используя базовые компоненты по умолчанию
3. PartyTheme отличаются только CSS-стилями через атрибут `data-theme`
4. Для уникальной логики в `createPartyTheme()` можно передать `overrides`

## Доступные PartyTheme

### 1. Cyberpunk (`cyberpunk`)

PartyTheme в стиле киберпанк: неоновые акценты и эффекты свечения.

- Цветовая схема: неон, темный фон
- Шрифты: моноширинные, футуристические
- Эффекты: свечение, анимации, неоновые границы

### 2. Sakura (`sakura`)

PartyTheme с пастельными розовыми оттенками.

- Цветовая схема: пастельные тона, розовый/белый
- Шрифты: элегантные, с засечками
- Эффекты: плавные переходы, цветочные элементы

### 3. Art Deco (`art-deco`)

PartyTheme в стиле ар-деко: золотые акценты и геометрические паттерны.

- Цветовая схема: золотой, черный, белый
- Шрифты: геометрические, стилизованные
- Эффекты: геометрические паттерны, градиенты

### 4. Базовый (`basic`)

PartyTheme: простой стиль в духе приложения CherryPlayList.

- Цветовая схема: темно-серый фон, белый текст, синий акцент
- Шрифты: системные, стандартные
- Эффекты: минимальные, простые переходы

### 5. Весенний кросс-степ (`spring-cross-step`)

PartyTheme: светлая весенняя палитра, зелёные акценты.

- Цветовая схема: светлый зелёный фон (#f0f7e8), тёмно-зелёный текст и акценты (#1a5c2e, #7cb342)
- Шрифты: системные
- Эффекты: пульсирующий индикатор сессии, градиент прогресса с «капелькой», опциональные анимации лепестков/листьев

**CurrentTrackDisplay (переопределён в PartyTheme):** блок «Сейчас играет» дополнен опциональными строками «Предыдущий» (сверху) и «Следующий» (снизу). Порядок треков — плоский плейлист (только треки, в порядке отображения; группы не показываются). Предыдущий/следующий отображаются только если они существуют и в плейлисте больше одного трека. Строки выровнены по правому краю, без разделительных линий и отступов между ними и текущим блоком. Длительность выводится в одной строке с названием; при раскрытии названия длительность остаётся по центру по вертикали. Строки оформлены менее заметно (меньший размер, большая прозрачность); визуальный фокус остаётся на текущем треке. Только информация, без интерактивности (клики не предусмотрены). Для вычисления плоского списка треков PartyTheme использует утилиту `getFlatTracksInDisplayOrder` из `CherryPlayComponents/src/core/utils/playlist.ts`.

**PlaylistView (в PartyTheme):** строка статуса — только количество оставшихся (ещё не сыгранных) треков: «Осталось треков:» и жирное число; если осталось 0 или 1 трек — «Последний трек»; если сессия завершена и оставшихся 0 — «Вечеринка окончена» (передаётся `isSessionActive` из PartyDisplayData). Нумерация треков в списке не учитывает отменённые; у групп номер в кружке не показывается. На узких экранах (≤480px) блок статуса выравнивается по центру.

## Идентификаторы PartyTheme (PartyThemeId)

### TypeScript/JavaScript

Тип `PartyThemeId` определён в `CherryPlayComponents/src/themes/index.ts`:

```typescript
type PartyThemeId =
  | "cyberpunk"
  | "sakura"
  | "art-deco"
  | "basic"
  | "spring-cross-step";
```

### C# (CherryPlayServer)

Enum `PartyThemeId` определён в `CherryPlayServer/Core/Enums/PartyThemeId.cs`:

- `Cyberpunk`, `Sakura`, `ArtDeco`, `Basic`, `SpringCrossStep`
- Автоматическая JSON сериализация в строки

## Настройки кастомизации

Каждая PartyTheme может поддерживать уникальные настройки кастомизации через `customizationSettings`.

### Cyberpunk

| Параметр        | Тип            | По умолчанию | Описание               |
| --------------- | -------------- | ------------ | ---------------------- |
| `accentColor`   | string (hex)   | `#00ff00`    | Цвет акцента           |
| `glowIntensity` | number (0-100) | `50`         | Интенсивность свечения |

### Sakura

| Параметр            | Тип            | По умолчанию | Описание          |
| ------------------- | -------------- | ------------ | ----------------- |
| `pinkTint`          | string (hex)   | `#ffb3d9`    | Оттенок розового  |
| `backgroundOpacity` | number (0-100) | `80`         | Прозрачность фона |

### Art Deco

| Параметр       | Тип          | По умолчанию  | Описание       |
| -------------- | ------------ | ------------- | -------------- |
| `goldColor`    | string (hex) | `#d4af37`     | Цвет золота    |
| `patternStyle` | string       | `'geometric'` | Стиль паттерна |

### Базовый (`basic`)

PartyTheme не поддерживает настройки кастомизации.

### Весенний кросс-степ (`spring-cross-step`)

PartyTheme не поддерживает настройки кастомизации.

## Использование в проектах

### CherryPlayComponents (React/TypeScript)

```typescript
import { PartyDisplay } from '@cherryplay/components';
import '@cherryplay/components/themes/index.css';
import '@cherryplay/components/styles/shell-palette.css'; // Палитра оболочки

<PartyDisplay data={partyDisplayData} />
```

### CherryPlayWeb и CherryPlayList

Используйте компонент `PartyDisplay` из библиотеки. Импортируйте CSS:

```typescript
import "@cherryplay/components/themes/index.css";
```

## API и типы данных

### PartyThemeComponents

```typescript
interface PartyThemeComponents {
  PartyDisplay: React.ComponentType<{ data: PartyDisplayData; ... }>;
  PlaylistView: React.ComponentType<{ playlist: PartyPlaylistData; ... }>;
  CurrentTrackDisplay: React.ComponentType<{ playbackState: PlaybackState; ... }>;
}
```

### createPartyTheme

```typescript
function createPartyTheme(config: CreatePartyThemeConfig): PartyTheme;

interface CreatePartyThemeConfig {
  id: PartyThemeId;
  name: string;
  description: string;
  cssPath: string;
  customizationOptions?: string[];
  overrides?: Partial<PartyThemeComponents>;
}
```

## Добавление новой PartyTheme

### Краткая сводка

Для добавления новой PartyTheme нужно:

1. Создать CSS-файлы в `CherryPlayComponents/src/themes/<theme-id>/`
2. Зарегистрировать PartyTheme в `CherryPlayComponents/src/themes/index.ts` (union `PartyThemeId`, `PARTY_THEME_REGISTRY`, `createPartyTheme()`)
3. Добавить значение в C# enum `CherryPlayServer/Core/Enums/PartyThemeId.cs`
4. Обновить документацию

**Важно**: После добавления PartyTheme в библиотеку компонентов она автоматически становится доступной во всех приложениях. Дополнительные изменения в CherryPlayWeb и CherryPlayList не требуются (кроме опциональных превью).

Подробная пошаговая инструкция по добавлению новой PartyTheme находится в отдельном файле:

📖 **[ADDING_THEME.md](./ADDING_THEME.md)** - полная инструкция без примеров кода

## CSS переменные

Каждая PartyTheme задаёт CSS-переменные в селекторе `[data-theme="<theme-id>"]`. Используется стандартный набор переменных для консистентности:

- **Фон**: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`
- **Текст**: `--text-primary`, `--text-secondary`, `--text-tertiary`
- **Акценты**: `--accent-primary`, `--accent-primary-light`
- **Границы и выделение**: `--border-color`, `--selected-bg`, `--selected-border`

Настройки кастомизации преобразуются в CSS-переменные через хук `usePartyThemeVars`.

Примеры — в существующих PartyTheme в `CherryPlayComponents/src/themes/`.

## Полезные ссылки

- [CherryPlayComponents README](./CherryPlayComponents/README.md)
