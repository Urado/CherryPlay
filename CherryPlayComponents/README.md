# CherryPlay Components

Библиотека React компонентов для отображения плейлистов в CherryPlay.

## Описание

Эта библиотека содержит переиспользуемые компоненты для отображения плейлистов как в Electron приложении (CherryPlayList), так и в веб-приложении (CherryPlayWeb).

## Архитектура

Библиотека построена на основе системы изолированных тем:

- **Core-слой** (`src/core/`) - общие типы, утилиты и хуки
- **Shared utils** (`src/utils/`) — пакетные утилиты вне `core/` (в т.ч. internal `cn` для className в примитивах; публичные `timezoneUtils`, `partyListUtils`)
- **PartyTheme** (`src/themes/<themeId>/`) - изолированные наборы компонентов для каждой PartyTheme
- **Палитра оболочки** (`src/styles/shell-palette.css`) — единая нейтральная тёмная палитра для оболочки приложения
- **UI-примитивы** (`src/components/primitives/`) — `Button`, `ButtonLink`, `Disclosure`, `Icon`, `InfoIcon`, `IconButton`, `PlaybackControlButton` для shell UI (модалки, кабинет, редактор вечеринки). Примитивы берут `cn` из `src/utils/cn.ts`, а не из модуля Button
- **Фасадный компонент** (`PartyDisplay`) — единая точка входа для фронта, автоматически выбирает нужную тему

## Основной компонент

### PartyDisplay (рекомендуется для фронта)

Единый компонент для отображения вечеринки. Принимает стандартизированные данные и автоматически выбирает нужную тему:

```typescript
import { PartyDisplay, PartyDisplayData } from '@cherryplay/components';

const data: PartyDisplayData = {
  partyId: '...',
  partyName: 'Моя вечеринка',
  themeId: 'basic', // или 'cyberpunk', 'sakura', 'art-deco'
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
- Статистика плейлиста (в теме spring-cross-step: количество оставшихся треков или «Последний трек»; см. [themes/README.md](src/themes/README.md))

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
- В теме **spring-cross-step**: опциональные строки «Предыдущий» и «Следующий» трек с длительностью в одной строке с названием (плоский плейлист по порядку отображения; выравнивание справа, без отступов между блоками; только информация, без кликов)

> **Примечание:** Для фронта рекомендуется использовать `PartyDisplay`. Этот компонент оставлен для обратной совместимости и кастомных композиций.

## UI-примитивы (shell)

Общие React-компоненты для оболочки приложения (не PartyTheme). Экспортируются из `@cherryplay/components` вместе с формами и `PartyDisplay`.

| Компонент | Назначение |
| --------- | ---------- |
| `Button` | Кнопки shell UI: модалки, кабинет, заголовок, редактор вечеринки |
| `ButtonLink` | Стилизованная ссылка `<a>` с классами `cp-button` (кабинет, party shell) |
| `Disclosure` | Раскрывающиеся секции (аккордеон) |
| `Icon` | Обёртка для иконки с нормализованным размером; glyph передаётся через `children` (класс `cp-icon`); опция `shape="circle"` — круглая обводка |
| `InfoIcon` | Компактный help-маркер «i» с круглой обводкой (`Icon` + `shape="circle"`) |
| `IconButton` | Кнопка только с иконкой (`aria-label` обязателен) |
| `PlaybackControlButton` | Круглая transport-кнопка play/pause/stop/next/error для плееров |

### Legacy wrappers (обратная совместимость)

| Компонент | Назначение |
| --------- | ---------- |
| `FormButton` | Legacy-обёртка над `Button` (auth-формы); `outline` → `ghost`; добавляет класс `form-button`. Новый shell UI — через `Button` напрямую. |

### FormButton

```tsx
import { FormButton } from '@cherryplay/components';

<FormButton variant="primary" loading type="submit">Войти</FormButton>
<FormButton variant="outline">Отмена</FormButton>
```

| Prop | Значения | По умолчанию |
| ---- | -------- | ------------ |
| `variant` | `primary`, `secondary`, `outline` (`outline` → `ghost` у `Button`) | `primary` |
| `loading`, `fullWidth` | `boolean` | `false` |

**Не поддерживается:** `size`, `danger`, `iconOnly`, `startIcon`, `endIcon` — для этих случаев используйте `Button` напрямую.

Компонент всегда добавляет CSS-класс `form-button` (плюс опциональный `className`).

### Button

```tsx
import { Button } from '@cherryplay/components';

<Button variant="primary" size="md">Сохранить</Button>
<Button variant="danger" size="sm" loading>Удалить</Button>
<Button variant="ghost" startIcon={<CloseIcon />}>Закрыть</Button>
```

| Prop | Значения | По умолчанию |
| ---- | -------- | ------------ |
| `variant` | `primary`, `secondary`, `danger`, `ghost` | `primary` |
| `size` | `sm`, `md` | `md` |
| `tone` | `neutral`, `danger` — resting цвет icon/border (`cp-button--tone-*`); ортогонален заливному `variant="danger"` | `neutral` |
| `hoverable` | `boolean` — при `false` hover не меняет chrome (`cp-button--no-hover`) | `true` |
| `filled` | `none`, `hover`, `always` — заливка фона (`cp-button--fill-*`); с `tone="danger"` — красная заливка на hover или всегда | `none` |
| `loading`, `fullWidth`, `iconOnly`, `borderless` | `boolean` | `false` |
| `loadingLabel` | `string` — текст метки при `loading` вместо `children` | `'Загрузка...'` |
| `startIcon`, `endIcon` | `ReactNode` | — |

При `iconOnly={true}` обязательны `aria-label` или `aria-labelledby`; иначе в dev-режиме `console.warn`. Для icon-only кнопок предпочтительнее `IconButton`.

`borderless={true}` добавляет класс `cp-button--borderless` — убирает resting/hover border chrome (оставляет 1px transparent box, без сдвига layout). По умолчанию у `ghost`/`secondary` **есть** resting border (`--cp-ui-border`).

Пример тихого delete: `<Button variant="ghost" tone="danger" hoverable={false} />` — красные icon/border без hover wash.

Пример delete с заливкой как в шапке: `<Button variant="ghost" tone="danger" hoverable={false} filled="hover" />` — красные icon/border в покое, красная заливка на hover.

CSS-классы: `cp-button`, `cp-button--{variant}`, `cp-button--{size}`, опционально `cp-button--borderless`, `cp-button--tone-{tone}`, `cp-button--no-hover`, `cp-button--fill-hover`, `cp-button--fill-always`.

**Shared chrome (`buttonShared.tsx`):** `Button` и `ButtonLink` делят слой разметки и chrome-props (в т.ч. `startIcon` / `endIcon`).

| API | Status |
| --- | ------ |
| Типы `ButtonChromeProps`, `ButtonVariant`, `ButtonSize`, `ButtonTone`, `ButtonFill` | **Публичные** — реэкспорт через `Button` (`@cherryplay/components`) |
| `BUTTON_CHROME_DEFAULTS`, `resolveChromeProps`, `ButtonInnerContent` | **Internal** — только внутри модуля Button; из package index не реэкспортируются |
| `cn` (`src/utils/cn.ts`) | **Internal** — не в package index |

#### Дефолтные кнопки shell (out of the box) {#default-shell-buttons}

`Button`, `ButtonLink` и `IconButton` поставляются с **готовыми стилями по умолчанию**: после импорта `primitives.css` компоненты выглядят единообразно **без** локального CSS на каждую кнопку. Это слой **оболочки приложения** (модалки, кабинет, заголовок, редактор вечеринки) — **не** PartyTheme.

**Граница изоляции:** контент вечеринки внутри `PartyDisplay` живёт в изолированных PartyTheme (`data-theme`, `themes/index.css`). Темы **не обязаны** использовать `cp-button` или shell-токены; контракт примитивов на них не распространяется. См. [THEMES.md](../THEMES.md).

| `variant` | Назначение | Дефолт (если приложение не переопределяет токены) |
| --------- | ---------- | ------------------------------------------------- |
| `primary` | Главное действие (Сохранить, Подтвердить) | Заливка `--cp-accent-primary` (пакетный fallback `#667eea`) |
| `secondary` | Вторичное действие | Фон `--bg-tertiary`, border `--cp-ui-border`; hover: `--bg-hover` + accent border (`--cp-accent-primary`) |
| `danger` | Деструктивное действие | Заливка `--cp-accent-danger` = `var(--state-error, #d32f2f)`; переопределите `--state-error` на `:root` при необходимости |
| `ghost` | Тихое / icon-close / tertiary | Прозрачный фон + resting border `--cp-ui-border`; hover: accent border и цвет (`--cp-accent-primary`), **не** `--bg-hover`. Без обводки — `borderless` |

Размеры: `sm` (32px), `md` (40px); icon-only — квадрат с тем же размером. Токены задаются в `shell-palette.css` (`--cp-button-*`, `--cp-accent-*`).

**Акцент primary:** пакетный дефолт `#667eea` (`--cp-accent-primary` → `var(--accent-primary, #667eea)`). Потребители переопределяют `--accent-primary` на `:root`:

| Приложение | Файл | `--accent-primary` |
| ---------- | ---- | -------------------- |
| CherryPlayWeb | `src/index.css` | `#00ff88` |
| CherryPlayList | `src/styles/variables.css` | `#4a9eff` |

Примитивы подхватывают значение через `--cp-accent-primary` / `--cp-accent-primary-hover`. Без переопределения остаётся пакетный `#667eea`.

### ButtonLink

`ButtonLink` рендерит стилизованный тег `<a>` со стилями `Button` (по умолчанию не router-aware). Разметка и chrome-props — те же, что у `Button` (`buttonShared.tsx` / `ButtonInnerContent`), включая `startIcon` / `endIcon`:

```tsx
import { ButtonLink } from '@cherryplay/components';

<ButtonLink href="/cabinet" variant="secondary">Открыть кабинет</ButtonLink>
<ButtonLink href="/settings" variant="ghost" startIcon={<SettingsIcon />}>Настройки</ButtonLink>
```

| Prop | Значения | По умолчанию |
| ---- | -------- | ------------ |
| `variant` | `primary`, `secondary`, `danger`, `ghost` | `primary` |
| `size` | `sm`, `md` | `md` |
| `tone` | `neutral`, `danger` | `neutral` |
| `hoverable` | `boolean` | `true` |
| `filled` | `none`, `hover`, `always` | `none` |
| `fullWidth`, `iconOnly`, `disabled`, `borderless` | `boolean` | `false` |
| `startIcon`, `endIcon` | `ReactNode` | — |
| `href` | `string` | — (обязателен для навигации) |

**Не поддерживается:** `loading` — для индикатора загрузки используйте `Button`.

Если `disabled={true}`, компонент не выполняет навигацию и выставляет `aria-disabled="true"` (визуально как disabled-кнопка).

Для роутера приложения используйте wrapper на уровне app-shell (например, адаптер над `react-router-dom` `Link`), который маппит роутинг-пропсы в контракт `ButtonLink` (`href`).

### Disclosure

```tsx
import { Disclosure } from '@cherryplay/components';

<Disclosure title="Плейлист" variant="card" defaultExpanded summary="12 треков">
  …
</Disclosure>
```

| Prop | Тип | По умолчанию |
| ---- | ---- | ------------ |
| `title` | `string` (обязателен) | — |
| `children` | `ReactNode` (обязателен) | — |
| `className` | `string` | `''` |
| `variant` | `flat`, `card` | `flat` |
| `defaultExpanded` | `boolean` | `false` |
| `summary` | `ReactNode` — краткий текст в заголовке при свёрнутом состоянии | — |
| `expanded`, `onExpandedChange` | контролируемый режим | — |

Панель остаётся в DOM; в свёрнутом состоянии скрыта через `hidden` и `aria-hidden` (связь `aria-controls` остаётся валидной). ARIA: `aria-expanded`, `aria-controls`, клавиатурный toggle.

### Icon и IconButton

`Icon` не зависит от MUI — приложение передаёт glyph через `children`:

```tsx
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; // только CherryPlayList
import { Icon, IconButton, InfoIcon } from '@cherryplay/components';

<Icon size="sm"><PlayArrowIcon fontSize="inherit" /></Icon>
<Icon size="sm" shape="circle">i</Icon>
<InfoIcon title="Подсказка о режиме" />
<IconButton icon={<CloseIcon fontSize="inherit" />} aria-label="Закрыть" variant="ghost" size="sm" />
```

| `Icon` prop | Тип | По умолчанию |
| ----------- | --- | ------------ |
| `size` | `sm`, `md`, `lg` | `md` |
| `shape` | `none`, `circle` | `none` |
| `className` | `string` | — |
| `aria-hidden` | `boolean` | `true` |
| `children` | `ReactNode` (обязателен) | — |

При `shape="circle"`: квадратный hit-box (`width` = `height` по size-токену), `border: 1px solid var(--cp-ui-border)`, `border-radius: 50%`, glyph по центру (класс `cp-icon--circle`).

| `InfoIcon` prop | Тип | По умолчанию |
| --------------- | --- | ------------ |
| `title` | `string` | — (обязателен; tooltip и `aria-label`) |
| `size` | `sm`, `md`, `lg` | `sm` |
| `className` | `string` | — |
| остальные | HTML-атрибуты `span` | — |

| `Icon` size | px | Типичное использование |
| ----------- | -- | ---------------------- |
| `sm` | 16 | Действия в строках, закрытие |
| `md` | 20 | Тулбар, уведомления |
| `lg` | 24 | Пустые состояния, акцент |

| `IconButton` prop | Значения | По умолчанию |
| ----------------- | -------- | ------------ |
| `icon` | `ReactNode` | — (обязателен) |
| `aria-label` | `string` | — (обязателен) |
| `variant` | `primary`, `secondary`, `danger`, `ghost` | `primary` |
| `size` | `sm`, `md` | `md` |
| `tone` | `neutral`, `danger` (pass-through на `Button`) | `neutral` |
| `hoverable` | `boolean` (pass-through на `Button`) | `true` |
| `filled` | `none`, `hover`, `always` (pass-through на `Button`) | `none` |
| `iconSize` | `sm`, `md`, `lg` — размер glyph внутри кнопки | по `size` (`sm` → `sm`, `md` → `md`) |
| `loading`, `fullWidth`, `disabled`, `borderless` | `boolean` | `false` |

### PlaybackControlButton

Круглая transport-кнопка для плееров (play/pause/stop/next/error). Встроенные SVG-glyph, без MUI.

```tsx
import { PlaybackControlButton } from '@cherryplay/components';

<PlaybackControlButton control="play" size="md" title="Воспроизвести" />
<PlaybackControlButton control={isPlaying ? 'pause' : 'play'} size="sm" aria-label="Пауза" />
<PlaybackControlButton control="error" title="Ошибка воспроизведения" disabled />
```

| Prop | Значения | По умолчанию |
| ---- | -------- | ------------ |
| `control` | `play`, `pause`, `stop`, `next`, `error` | — (обязателен) |
| `size` | `sm` (30px), `md` (36px; play/pause/error — 40px) | `md` |
| `title`, `aria-label` | `string` | `aria-label` → `title` → дефолт по `control` |
| `disabled`, `onClick`, `className` | стандартные атрибуты `<button>` | — |

CSS-классы: `cp-playback-control`, `cp-playback-control--{size}`, `cp-playback-control--emphasis` (крупнее play/pause/error на `md`), `cp-playback-control--error`.

Токены: `--cp-playback-control-size-sm` (30px), `--cp-playback-control-size-md` (36px), `--cp-playback-control-size-md-emphasis` (40px) в `shell-palette.css`.

### Подключение CSS

Примитивы требуют явного импорта стилей **один раз** на уровне shell (точка входа приложения или главный CSS-бандл). Файл `primitives.css` агрегирует палитру и стили компонентов.

**Монорепозиторий** (Vite alias `@cherryplay/components` → `src/`):

```ts
import '@cherryplay/components/styles/primitives.css';
```

**После `npm run build`** тот же канонический импорт резолвится через `exports` в `package.json` (`"./styles/*"` → `./dist/styles/*`); `copy-css.mjs` копирует CSS в `dist/styles/` при сборке.

CherryPlayList импортирует только `primitives.css` до локальных стилей, так как он уже включает shell palette tokens — см. [DEV_SETUP.md](../DEV_SETUP.md).

Без импорта CSS токены (`--cp-button-*`, `--cp-icon-size-*`) и классы `cp-button` / `cp-disclosure` / `cp-icon` не применятся.

> **Примечание:** в `package.json` задан `exports`: `"."` → `dist/index`, `"./styles/*"` → `./dist/styles/*`. Канонический импорт CSS — `@cherryplay/components/styles/primitives.css`. В монорепозитории потребители также могут резолвить пакет через Vite/tsconfig alias на `CherryPlayComponents/src/`.

### MVP-миграция и backlog

**Уже на примитивах:** модалки CherryPlayList, party editor (`Disclosure` + кнопки), `AppHeader` (кроме playback pill), `ListRow.ActionButton` (domain-обёртка над `IconButton`), `ListRow.PlayButton` и transport плееров (`PlaybackControlButton`), кабинет и party shell в CherryPlayWeb.

**CherryPlayWeb (MVP):** новый shell (кабинет, party shell) — `Button` / `IconButton`. Auth/login по-прежнему через `FormButton` внутри `AuthForm` / `EmailAuthForm` (legacy wrapper).

**Вне MVP (post-backlog):**

| Область | Причина отложения |
| ------- | ----------------- |
| Полный sweep MUI-иконок (~37 файлов в List) | Постепенная замена на `Icon` |
| Admin-страницы Web (`AdminPages.css`) | Отдельная VS Code-подобная тема |
| Player transport / volume (`PlayerControls`, `HeaderPlaybackPill`, `DemoPlayer`) | Круглые domain-контролы |
| `AimpView` `<details>` | Локальные dropdown-паттерны |
| SVG иконки PartyTheme (`base/`, `spring-cross-step/`) | Тематические ассеты, не shell |
| `OAuthButtons` | Брендинг провайдеров |

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
│   │   ├── utils/               # Утилиты (форматирование времени, работа с плейлистом; getFlatTracksInDisplayOrder — плоский список треков по порядку отображения)
│   │   └── hooks/               # React хуки (usePartyThemeVars)
│   ├── utils/                   # Пакетные утилиты (вне core/)
│   │   ├── cn.ts                # className helper для примитивов (internal; не в package index)
│   │   ├── partyListUtils.ts    # публичный API
│   │   └── timezoneUtils.ts     # публичный API
│   ├── styles/                  # Палитра оболочки и агрегат примитивов
│   │   ├── shell-palette.css    # Токены shell UI (--bg-*, --radius-*, --cp-button-*)
│   │   └── primitives.css       # Импорт палитры + Button/Disclosure/Icon CSS
│   ├── types/                   # TypeScript типы
│   ├── components/              # Универсальные компоненты
│   │   ├── primitives/          # Shell UI-примитивы
│   │   │   ├── Button/          # Button, ButtonLink; buttonShared.tsx (cn internal)
│   │   │   ├── Disclosure/      # cn из src/utils/cn.ts
│   │   │   ├── Icon/            # Icon, InfoIcon — cn из src/utils/cn.ts; IconButton — обёртка над Button (без cn)
│   │   │   └── PlaybackControlButton/  # cn из src/utils/cn.ts
│   │   ├── UI/                  # FormButton, FormInput, ErrorMessage (+ re-export primitives)
│   │   ├── PartyDisplay/        # Фасадный компонент
│   │   ├── Playlist/
│   │   └── Player/
│   └── themes/                  # Изолированные темы PartyTheme
│       ├── partyThemeTypes.ts   # PartyThemeId, ThemeCustomizationEditorProps
│       ├── basic/palette/       # Палитра и настройки темы basic (публичный API — index.ts)
│       ├── cyberpunk/
│       ├── sakura/
│       ├── art-deco/
│       └── …                    # прочие темы — см. [THEMES.md](../THEMES.md)
```

**Зависимости примитивов:** `cn` импортируют только `Icon`, `InfoIcon`, `Disclosure`, `PlaybackControlButton` и chrome-слой `buttonShared.tsx` — из `src/utils/cn.ts`. `IconButton` `cn` не импортирует (обёртка над `Button`). Кросс-импорт `cn` из папки `Button/` убран.

## Темы

Каждая тема является полностью изолированным модулем со своими компонентами:

- `PartyDisplay` - главный компонент темы
- `PlaylistView` - компонент плейлиста
- `PlaylistItem` - компонент элемента плейлиста
- `CurrentTrackDisplay` - компонент отображения текущего трека
- `styles/` - CSS стили темы

### Доступные темы

Список идентификаторов и поведение (в т.ч. модуль палитры `basic` в `src/themes/basic/palette/`) описаны в [THEMES.md](../THEMES.md). Продуктовый default — константа `DEFAULT_PARTY_THEME_ID` (`'basic'`) из `@cherryplay/components`.

- **cyberpunk** — неоновая тема в стиле киберпанк
- **sakura** — пастельная тема
- **art-deco** — ар-деко
- **basic** — настраиваемая палитра; исходники палитры — `src/themes/basic/palette/` (также `DEFAULT_PARTY_THEME_ID`)
- **spring-cross-step** — расширенная весенняя тема с переопределёнными компонентами

### Добавление новой темы

1. Создайте директорию `src/themes/<theme-id>/`
2. Реализуйте компоненты темы (PartyDisplay, PlaylistView, PlaylistItem, CurrentTrackDisplay)
3. Добавьте CSS стили в `styles/`
4. Добавьте идентификатор в `src/themes/partyThemeTypes.ts` и зарегистрируйте PartyTheme в `src/themes/index.ts` в `PARTY_THEME_REGISTRY` через `createPartyTheme()`

## Стилизация

### Палитра оболочки и примитивы

Единая нейтральная тёмная палитра для оболочки (кабинет, список, логин, редактор вечеринки) — `src/styles/shell-palette.css`. Стили UI-примитивов подключаются через `src/styles/primitives.css` (см. раздел [UI-примитивы](#ui-примитивы-shell)).

Палитра оболочки определяет CSS переменные на `:root`:

- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover` — цвета фона
- `--text-primary`, `--text-secondary`, `--text-tertiary` — цвета текста
- `--border-color` — цвет границ
- `--radius-sm`, `--radius-md`, `--radius-lg` — радиусы скругления
- `--state-error-bg`, `--state-error-text` — состояния ошибок
- `--cp-button-*`, `--cp-icon-size-*` — токены примитивов (высота, padding, размеры иконок)
- `--cp-accent-primary` → `var(--accent-primary, #667eea)`; `--cp-accent-danger` → `var(--state-error, #d32f2f)` — акценты кнопок (переопределяются на `:root` потребителя)

### PartyTheme (изолированный слой)

PartyTheme **не использует** `cp-button` и не зависит от `primitives.css`. Каждая тема определяет свои CSS переменные через атрибут `data-theme`:

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

- `index.js` — скомпилированный код
- `index.d.ts` — типы TypeScript
- `styles/*.css`, `components/**/*.css` — копии CSS из `src/` (скрипт `scripts/copy-css.mjs`)
