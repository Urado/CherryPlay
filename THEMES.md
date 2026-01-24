# Документация по темам CherryPlay

Единая документация по системе тем для всех проектов CherryPlay.

## Содержание

- [Обзор](#обзор)
- [Доступные темы](#доступные-темы)
- [Идентификаторы тем](#идентификаторы-тем)
- [Настройки кастомизации](#настройки-кастомизации)
- [Использование в проектах](#использование-в-проектах)
- [API и типы данных](#api-и-типы-данных)
- [Добавление новой темы](#добавление-новой-темы)

## Обзор

CherryPlay использует систему изолированных тем для визуального оформления вечеринок. Каждая тема представляет собой полностью независимый модуль с собственными компонентами и стилями.

**Основные принципы:**
- Каждая тема изолирована и не зависит от других тем
- Темы поддерживают кастомизацию через настройки
- Все темы используют единый API и структуру данных
- Темы доступны во всех проектах (CherryPlayServer, CherryPlayWeb, CherryPlayList)

## Доступные темы

### 1. Cyberpunk (`cyberpunk`)

**Описание:** Неоновая тема в стиле киберпанк с зелеными акцентами и эффектами свечения.

**Визуальные характеристики:**
- Цветовая схема: неон, темный фон
- Шрифты: моноширинные, футуристические
- Эффекты: свечение, анимации, неоновые границы

**Иконка:** 💚

### 2. Sakura (`sakura`)

**Описание:** Нежная пастельная тема с розовыми оттенками.

**Визуальные характеристики:**
- Цветовая схема: пастельные тона, розовый/белый
- Шрифты: элегантные, с засечками
- Эффекты: плавные переходы, цветочные элементы

**Иконка:** 🌸

### 3. Art Deco (`art-deco`)

**Описание:** Элегантная тема в стиле ар-деко с золотыми акцентами и геометрическими паттернами.

**Визуальные характеристики:**
- Цветовая схема: золотой, черный, белый
- Шрифты: геометрические, стилизованные
- Эффекты: геометрические паттерны, градиенты

**Иконка:** ✨

## Идентификаторы тем

### TypeScript/JavaScript

Тип `ThemeId` определен в `CherryPlayComponents/src/themes/index.ts` как union type со значениями: `'cyberpunk'`, `'sakura'`, `'art-deco'`.

**Допустимые значения:**
- `'cyberpunk'` - тема Cyberpunk
- `'sakura'` - тема Sakura
- `'art-deco'` - тема Art Deco

### C# (CherryPlayServer)

Enum `ThemeId` определен в `CherryPlayServer.Core.Enums.ThemeId` со значениями: `Cyberpunk`, `Sakura`, `ArtDeco`.

**JSON сериализация:**
- Enum автоматически сериализуется в строки при отправке на фронт
- Фронт отправляет строки, которые автоматически конвертируются в enum
- Для конвертации из строки используется `ThemeIdExtensions.ParseThemeIdOrDefault()`

## Настройки кастомизации

Каждая тема поддерживает уникальные настройки кастомизации, которые передаются через объект `customizationSettings`.

### Cyberpunk

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `accentColor` | string (hex) | `#00ff00` | Цвет акцента (неоновый зеленый) |
| `glowIntensity` | number (0-100) | `50` | Интенсивность свечения (0 = нет свечения, 100 = максимальное свечение) |

### Sakura

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `pinkTint` | string (hex) | `#ffb3d9` | Оттенок розового цвета |
| `backgroundOpacity` | number (0-100) | `80` | Прозрачность фона (0 = полностью прозрачный, 100 = непрозрачный) |

### Art Deco

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `goldColor` | string (hex) | `#d4af37` | Цвет золота |
| `patternStyle` | string | `'geometric'` | Стиль паттерна: `'geometric'`, `'floral'`, `'linear'` |

## Использование в проектах

### CherryPlayComponents (React/TypeScript)

Импортируйте компонент `PartyDisplay` и тип `PartyDisplayData` из `@cherryplay/components`. Передайте данные через prop `data` с указанием `themeId` и `customizationSettings`. Для работы тем необходимо импортировать CSS файлы всех тем в `App.tsx` или `main.tsx`.

### CherryPlayWeb (React)

Используйте компонент `PartyDisplay` из библиотеки `@cherryplay/components`. Получайте `themeId` и `customizationSettings` из API ответа и передавайте их в `PartyDisplayData`.

### CherryPlayList (Electron)

Используйте `PartyDisplay` для превью вечеринок. Получайте `themeId` и `customizationSettings` из настроек вечеринки.

### CherryPlayServer (C#)

Создавайте вечеринки через `CreatePartyDto` с указанием `ThemeId` (enum `ThemeId`). Для чтения темы из существующей вечеринки используйте `ThemeIdExtensions.ParseThemeIdOrDefault()` для конвертации строки в enum.

## API и типы данных

### REST API

**Создание вечеринки:** `POST /api/parties`

Принимает JSON с полями: `name`, `themeId` (строка: "cyberpunk", "sakura", "art-deco"), `customizationSettings` (объект с настройками), `playlistData`, `eventDateTime`.

**Получение вечеринки:** `GET /api/parties/public/{shortCode}`

Возвращает объект с полями: `id`, `name`, `themeId`, `customizationSettings`, `hasActiveSession`.

### TypeScript типы

Тип `ThemeId` определен как union type: `'cyberpunk' | 'sakura' | 'art-deco'`.

Интерфейс `PartyDisplayData` содержит: `partyId`, `partyName`, `themeId`, `customizationSettings` (опционально), `playlist`, `playbackState`, `isSessionActive`.

### C# типы

Enum `ThemeId` со значениями: `Cyberpunk`, `Sakura`, `ArtDeco`.

DTO `CreatePartyDto` содержит: `Name`, `ThemeId` (enum, по умолчанию `Cyberpunk`), `CustomizationSettings` (опционально), `PlaylistData` (опционально), `EventDateTime` (опционально).

DTO `PartyDto` содержит: `Id`, `Name`, `ShortCode`, `ThemeId` (enum), `CreatedAt`, `HasActiveSession`, `EventDateTime` (опционально).

## CSS переменные

Каждая тема определяет CSS переменные через атрибут `data-theme`. Настройки кастомизации автоматически преобразуются в CSS переменные через хук `useThemeVars`.

**Общие переменные:**
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` - цвета фона
- `--text-primary`, `--text-secondary`, `--text-tertiary` - цвета текста
- `--accent-primary` - цвет акцента
- `--border-color` - цвет границ

**Специфичные для тем:**
- Cyberpunk: `--accentColor`, `--glowIntensity`
- Sakura: `--pinkTint`, `--backgroundOpacity`
- Art Deco: `--goldColor`, `--patternStyle`

**Преобразование значений:**
- `glowIntensity` и `backgroundOpacity`: 0-100 → 0-1 (для rgba)
- Цвета: передаются как есть (hex строки)
- Остальные значения: преобразуются в строки

## Добавление новой темы

### 1. Создание структуры темы

**В CherryPlayComponents:** Создайте директорию `CherryPlayComponents/src/themes/<theme-id>/` со следующими файлами: `PartyDisplay.tsx`, `PlaylistView.tsx`, `PlaylistItem.tsx`, `CurrentTrackDisplay.tsx`, и поддиректорию `styles/` с файлами: `index.css`, `playlist.css`, `playlist-item.css`, `player.css`.

### 2. Регистрация темы

**В TypeScript:** Добавьте новый идентификатор в union type `ThemeId` и зарегистрируйте тему в `THEME_REGISTRY` с указанием компонентов, CSS пути и опций кастомизации.

**В C#:** Добавьте новое значение в enum `ThemeId` с атрибутом `JsonPropertyName` для JSON сериализации.

### 3. Обновление документации

- Добавьте описание темы в этот файл (THEMES.md)
- Обновите примеры использования
- Добавьте описание настроек кастомизации

### 4. Тестирование

- Проверьте работу темы во всех проектах
- Убедитесь, что настройки кастомизации применяются корректно
- Проверьте сериализацию/десериализацию в API

## Миграция и совместимость

### Обратная совместимость

- Старые вечеринки с `themeId` как строка продолжают работать
- `ThemeIdExtensions.ParseThemeIdOrDefault()` безопасно обрабатывает неизвестные значения
- По умолчанию используется `ThemeId.Cyberpunk`

### Миграция данных

При необходимости миграции существующих данных используйте `ThemeIdExtensions.ParseThemeIdOrDefault()` для безопасной конвертации строки в enum.

## Полезные ссылки

- [CherryPlayComponents README](../CherryPlayComponents/README.md) - документация библиотеки компонентов
- [STREAMING_ARCHITECTURE.md](./STREAMING_ARCHITECTURE.md) - общая архитектура системы
- [CherryPlayComponents/src/themes/README.md](../CherryPlayComponents/src/themes/README.md) - детальная документация по темам
