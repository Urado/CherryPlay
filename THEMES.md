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
├── partyThemeTypes.ts # PartyThemeId, ThemeCustomizationEditorProps (узкий модуль без цикла с index)
├── index.css          # Импорты CSS всех PartyTheme
├── base/              # Базовые React-компоненты (единственный набор)
│   ├── PartyDisplay.tsx
│   ├── PlaylistView.tsx
│   ├── PlaylistItem.tsx
│   ├── CurrentTrackDisplay.tsx
│   ├── colors.ts      # Реэкспорт ../basic/palette (совместимость старых импортов)
│   └── index.ts
├── cyberpunk/         # CSS + CustomizationEditor (stub)
│   ├── index.css
│   ├── playlist.css
│   ├── playlist-item.css
│   ├── player.css
│   └── CustomizationEditor.tsx
├── sakura/            # CSS + CustomizationEditor (stub)
│   ├── *.css
│   └── CustomizationEditor.tsx
├── basic/             # CSS, CustomizationEditor, модуль палитры
│   ├── palette/       # Логика палитры basic (см. ниже)
│   ├── *.css
│   └── CustomizationEditor.tsx
└── art-deco/          # CSS + CustomizationEditor (stub)
    ├── *.css
    └── CustomizationEditor.tsx
```

### Модуль палитры темы `basic` (`themes/basic/palette/`)

Исходники палитры сгруппированы в одной папке; публичный API — `palette/index.ts` (реэкспорт функций, констант и типов).

| Файл                          | Назначение                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                    | Публичный API: `getBasicThemePaletteCatalog`, `resolveBasicThemePalette`, `resolveBasicThemeCssSettings`, константы, типы |
| `paletteTypes.ts`             | Типы настроек и палитр                                                                                                    |
| `paletteConstants.ts`         | Константы и пресеты                                                                                                       |
| `paletteUtils.ts`             | Утилиты для цветов                                                                                                        |
| `familyPalettes.ts`           | Семейные палитры и производные от акцента                                                                                 |
| `paletteCatalog.ts`           | Построение каталога плиток для редактора                                                                                  |
| `normalizePaletteSettings.ts` | Нормализация входных настроек, дефолты, санитизация сохранённых палитр                                                    |

Публичные хелперы: `isBasicThemePaletteId`, `normalizeHexColor`, `getDefaultBasicThemeCustomPalette` (см. реэкспорт в `themes/index.ts`).

**Импорты в коде пакета:** предпочтительно `.../themes/basic/palette` или через barrel `themes/index.ts` / `themes/basic/index.ts`. Файл `themes/base/colors.ts` — тонкий реэкспорт `export * from '../basic/palette'` для совместимости со старыми путями.

**Каталог плиток в редакторе и `paletteId`**

| Контекст                                               | Поведение                                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Сетка каталога в UI                                    | Плитки строятся из каталога (`getBasicThemePaletteCatalog`); отдельной плитки «Базовый» для `base` нет         |
| Хранение и резолв                                      | `paletteId: 'base'` — валидный дефолт и безопасный fallback при битых/отсутствующих настройках                 |
| Метаданные темы, селект «Палитра» (`themeMetadata.ts`) | Опция `base` при необходимости добавляется первой в список, чтобы `defaultValue` совпадал с доступными опциями |

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

PartyTheme: простой стиль в духе приложения CherryPlayList, с настраиваемой палитрой.

- Базовая палитра теперь полностью setting-driven: CSS vars вычисляются из `customizationSettings`, а не из жёстко выбранного CSS-варианта
- Цветовая схема: выбираемая палитра (`darkGradient` / `lightGradient` / `darkNeon` / `lightAccent` + `custom` + сохранённые пользователем)
- Шрифты: системные, стандартные
- Эффекты: минимальные, простые переходы
- Кастомизация: выбор палитры и 5 кастомных цветов (акцент, основной текст, фон страницы, фон списка, фон трека)
- Палитра по умолчанию и fallback: `base` (подробнее — подраздел «Модуль палитры темы `basic`» в разделе «Архитектура» выше)
- В сетке каталога: без плитки `base`; порядок плиток — по логике `paletteCatalog` (family-палитры, сохранённые пользователем, `custom`)
- При выборе предустановленной палитры её 5 цветов автоматически сохраняются в `customPalette`; при последующем переключении на `custom` пользователь видит цвета последней выбранной палитры

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

PartyTheme не поддерживает настройки кастомизации (редактор темы возвращает `null`).

### Sakura

PartyTheme не поддерживает настройки кастомизации (редактор темы возвращает `null`).

### Art Deco

PartyTheme не поддерживает настройки кастомизации (редактор темы возвращает `null`).

### Базовый (`basic`)

Поддерживается палитра базовой темы. Канонический контракт для сохранения/передачи настроек:

| Параметр        | Тип    | По умолчанию | Описание                                                                                                                                                                                           |
| --------------- | ------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paletteId`     | string | `base`       | Идентификатор палитры (`base`, `darkGradient`, `lightGradient`, `darkNeon`, `lightAccent`) или `custom`. `base` остаётся валидным fallback id, но как отдельная плитка в каталоге не отображается. |
| `customPalette` | object | base palette | Канонический объект из 5 hex-цветов: `accentPrimary`, `textPrimary`, `backgroundPrimary`, `trackAreaBackground`, `trackBackground`.                                                                |

Канонический формат хранения для `basic`:

```typescript
{
  paletteId: "base" | ... | "custom",
  customPalette: {
    accentPrimary: "#rrggbb",
    textPrimary: "#rrggbb",
    backgroundPrimary: "#rrggbb",
    trackAreaBackground: "#rrggbb",
    trackBackground: "#rrggbb"
  }
}
```

Если входные настройки невалидны или не парсятся, применяется безопасный fallback: `paletteId: "base"` и дефолтный `customPalette` для `base`.

### Весенний кросс-степ (`spring-cross-step`)

PartyTheme не поддерживает настройки кастомизации (редактор темы возвращает `null`).

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

## Доступ к темам и монетизация

Текущая модель доступа описана в [FEATURE_THEME_MONETIZATION.md](./FEATURE_THEME_MONETIZATION.md).

- Серверный источник правды: таблицы `themes`, `theme_packages`, `theme_package_items`, `organizer_entitlements`.
- Доступ к теме проверяется через пакеты:
  - auto-granted пакеты (`isAutoGranted=true`, например `free`) дают доступ всем;
  - остальные пакеты требуют активный entitlement у организатора.
- `visibility=public` + нет доступа -> тема возвращается в `visibleLockedThemes` и показывается в UI с замком/CTA.
- `visibility=private` + нет доступа -> тема скрывается из UI полностью.
- Если `isVisible=false`, тема запрещена для использования (`theme_not_visible`) и не возвращается в summary.

## API и типы данных

### PartyThemeComponents

```typescript
interface PartyThemeComponents {
  PartyDisplay: React.ComponentType<{ data: PartyDisplayData; ... }>;
  PlaylistView: React.ComponentType<{ playlist: PartyPlaylistData; ... }>;
  CurrentTrackDisplay: React.ComponentType<{ playbackState: PlaybackState; ... }>;
  PartyInfoDisplay: React.ComponentType<{ data: PartyInfoDisplayData; ... }>;
  CustomizationEditor?: React.ComponentType<ThemeCustomizationEditorProps>;
}

interface ThemeCustomizationEditorProps {
  customizationSettings: Record<string, unknown>;
  onCustomizationSettingsChange: (settings: Record<string, unknown>) => void;
}
```

Тип `PartyThemeId` и интерфейс `ThemeCustomizationEditorProps` объявлены в `themes/partyThemeTypes.ts` и реэкспортируются из `themes/index.ts`, чтобы редакторы тем не тянули barrel `index.ts` только ради типов (избегаем лишних циклов зависимостей).

Для текущих встроенных тем `customizationOptions` не пустой только у `basic`; у остальных тем редактор возвращает `null`, а `customizationOptions` остаётся пустым.

### Метаданные опций (`themeMetadata.ts`)

- **`getThemeMetadata('basic', customizationSettings?)`** — для basic возвращает актуальные `defaultValue` и списки опций (палитра, user-saved).
- **`getCustomizationOption(themeId, optionKey, customizationSettings?)`** — для `basic` передавайте текущие `customizationSettings` третьим аргументом, если нужны актуальные `defaultValue`/опции как у `getThemeMetadata`; без него для `basic` возможен устаревший снимок из `THEME_METADATA`.

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
2. Зарегистрировать PartyTheme в `CherryPlayComponents/src/themes/index.ts` и добавить `PartyThemeId` в `partyThemeTypes.ts` (`PARTY_THEME_REGISTRY`, `createPartyTheme()`)
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

## QA и регрессия: базовая палитра

Чеклист для проверки feature `theme-palette-settings` (basic theme):

1. **Выбор предустановленной палитры**
   - В `PartyEditor` выбрать тему `basic`.
   - Убедиться, что отображается сетка палитр с превью.
   - Переключить 3-4 разные палитры и проверить мгновенное применение в превью.
2. **Режим `custom`**
   - Выбрать любую предустановленную палитру, затем переключиться на `Кастомная`.
   - Убедиться, что в `custom` подставились цвета последней выбранной предустановленной палитры.
   - Убедиться, что показаны ровно 5 строк редактирования цвета.
3. **Color picker + HEX**
   - Для каждой из 5 строк изменить цвет через `type="color"` и проверить применение.
   - Для каждой строки ввести валидный hex (`#112233`, `abc`) и проверить нормализацию в `#rrggbb`.
4. **Невалидный HEX и fallback**
   - Ввести невалидное значение (`#12`, `zzz`) и снять фокус.
   - Убедиться, что значение откатывается к последнему валидному цвету и UI не ломается.
5. **Персист и ре-гидрация**
   - Сохранить/опубликовать изменения, перезапустить приложение (или переоткрыть проект).
   - Проверить, что выбранный `paletteId` и кастомные цвета восстановлены.
6. **Невалидные настройки и fallback**
   - Передать невалидный `paletteId`/`customPalette` в `customizationSettings`.
   - Убедиться, что применяется безопасный дефолт (`paletteId: "base"` + base `customPalette`).
7. **Регрессия базового рендера**
   - Удалить/повредить часть `customizationSettings` для `basic`.
   - Убедиться, что применяется безопасный дефолт (`base`), без падений рендера.
8. **Границы scope UI**
   - Для `basic` убедиться, что в блоке настройки темы отображаются только палитра и 5 кастомных цветов (без лишних контролов).
