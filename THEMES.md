# Документация по темам CherryPlay

Единая документация по системе тем для всех проектов CherryPlay.

## Содержание

- [Обзор](#обзор)
- [Архитектура](#архитектура)
- [Доступные темы](#доступные-темы)
- [Идентификаторы тем](#идентификаторы-тем)
- [Настройки кастомизации](#настройки-кастомизации)
- [Использование в проектах](#использование-в-проектах)
- [API и типы данных](#api-и-типы-данных)
- [Добавление новой темы](#добавление-новой-темы)

## Обзор

CherryPlay использует систему тем на основе базовых компонентов с CSS-кастомизацией.

**Основные принципы:**
- Базовые компоненты в `themes/base/` используются всеми темами по умолчанию
- Темы реализуют уникальный внешний вид через CSS и атрибут `data-theme`
- При необходимости тема может переопределить любой компонент через `overrides`
- Все темы используют единый API и структуру данных

## Архитектура

```
themes/
├── index.ts           # Реестр тем, фабрика createTheme, BASE_COMPONENTS
├── index.css          # Импорты CSS всех тем
├── base/              # Базовые компоненты (единственный набор)
│   ├── PartyDisplay.tsx
│   ├── PlaylistView.tsx
│   ├── PlaylistItem.tsx
│   ├── CurrentTrackDisplay.tsx
│   └── index.ts
├── cyberpunk/         # CSS-only тема
│   ├── index.css
│   ├── playlist.css
│   ├── playlist-item.css
│   └── player.css
├── sakura/            # CSS-only тема
│   └── *.css
└── art-deco/          # CSS-only тема
    └── *.css
```

### Как это работает

1. `BASE_COMPONENTS` содержит единственный набор React компонентов
2. `createTheme()` создает тему, используя базовые компоненты по умолчанию
3. Темы отличаются только CSS стилями через `data-theme` атрибут
4. Для уникальной логики тема может передать `overrides` в `createTheme()`

## Доступные темы

### 1. Cyberpunk (`cyberpunk`)

Неоновая тема в стиле киберпанк с зелеными акцентами и эффектами свечения.

- Цветовая схема: неон, темный фон
- Шрифты: моноширинные, футуристические
- Эффекты: свечение, анимации, неоновые границы

### 2. Sakura (`sakura`)

Нежная пастельная тема с розовыми оттенками.

- Цветовая схема: пастельные тона, розовый/белый
- Шрифты: элегантные, с засечками
- Эффекты: плавные переходы, цветочные элементы

### 3. Art Deco (`art-deco`)

Элегантная тема в стиле ар-деко с золотыми акцентами и геометрическими паттернами.

- Цветовая схема: золотой, черный, белый
- Шрифты: геометрические, стилизованные
- Эффекты: геометрические паттерны, градиенты

### 4. Базовый (`basic`)

Простой и чистый стиль в духе основного приложения CherryPlayList.

- Цветовая схема: темно-серый фон, белый текст, синий акцент
- Шрифты: системные, стандартные
- Эффекты: минимальные, простые переходы

## Идентификаторы тем

### TypeScript/JavaScript

Тип `PartyThemeId` определен в `CherryPlayComponents/src/themes/index.ts`:

```typescript
type PartyThemeId = 'cyberpunk' | 'sakura' | 'art-deco' | 'basic';
```

### C# (CherryPlayServer)

Enum `PartyThemeId` определен в `CherryPlayServer.Core.Enums.PartyThemeId`:

- `Cyberpunk`, `Sakura`, `ArtDeco`, `Basic`
- Автоматическая JSON сериализация в строки

## Настройки кастомизации

Каждая тема поддерживает уникальные настройки кастомизации через `customizationSettings`.

### Cyberpunk

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `accentColor` | string (hex) | `#00ff00` | Цвет акцента |
| `glowIntensity` | number (0-100) | `50` | Интенсивность свечения |

### Sakura

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `pinkTint` | string (hex) | `#ffb3d9` | Оттенок розового |
| `backgroundOpacity` | number (0-100) | `80` | Прозрачность фона |

### Art Deco

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `goldColor` | string (hex) | `#d4af37` | Цвет золота |
| `patternStyle` | string | `'geometric'` | Стиль паттерна |

### Базовый

Тема не поддерживает настройки кастомизации.

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
import '@cherryplay/components/themes/index.css';
```

## API и типы данных

### ThemeComponents

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

## Добавление новой темы

### Краткая сводка

Для добавления новой PartyTheme нужно:
1. Создать CSS файлы в `CherryPlayComponents/src/themes/<theme-id>/`
2. Зарегистрировать PartyTheme в `CherryPlayComponents/src/themes/index.ts`
3. Добавить значение в C# enum `CherryPlayServer/Core/Enums/PartyThemeId.cs`
4. Обновить документацию

**Важно**: После добавления темы в библиотеку компонентов, она автоматически становится доступной во всех приложениях благодаря централизованной системе. Дополнительные изменения в CherryPlayWeb и CherryPlayList не требуются (кроме опциональных превью).

Подробная пошаговая инструкция по добавлению новой темы находится в отдельном файле:

📖 **[ADDING_THEME.md](./ADDING_THEME.md)** - полная инструкция без примеров кода

## CSS переменные

Каждая тема определяет CSS переменные через `[data-theme]`. Темы используют стандартный набор переменных для консистентности:

- **Фон**: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`
- **Текст**: `--text-primary`, `--text-secondary`, `--text-tertiary`
- **Акценты**: `--accent-primary`, `--accent-primary-light`
- **Границы и выделение**: `--border-color`, `--selected-bg`, `--selected-border`

Настройки кастомизации автоматически преобразуются в CSS переменные через хук `useThemeVars`.

Для примеров использования CSS переменных смотрите существующие темы в `CherryPlayComponents/src/themes/`.


## Полезные ссылки

- [CherryPlayComponents README](./CherryPlayComponents/README.md)
