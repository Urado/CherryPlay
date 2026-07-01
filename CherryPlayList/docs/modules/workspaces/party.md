# Party

Модуль вечеринки: создание и управление онлайн-вечеринкой с трансляцией плейлиста. Регистрирует **два** независимых workspace — **PartyEditor** и **PartyPreview** — с общей party-подсистемой (store + runtime hook).

## Два workspace

| Workspace | ID | Тип | Назначение |
| --------- | -- | --- | ---------- |
| **Party Editor** | `party-editor-workspace` | `party-editor` | Форма, lifecycle, баннер привязки, настройки отображения треков, auth/сервер/entitlement |
| **Party Preview** | `party-preview-workspace` | `party-preview` | Только браузерное превью плейлиста (`PartyPreview` / `PartyDisplay`) |

Константы и типы: [`workspace.ts`](../../../src/core/constants/workspace.ts). Регистрация обоих модулей: [`party/index.ts`](../../../src/workspaces/party/index.ts) (side-effect import из `entry.tsx`).

Тип `party` и ID `party-workspace` **удалены**; сохранённые layout с legacy-зоной мигрируют автоматически (см. [Layout presets и миграция](#layout-presets-и-миграция)).

Оба workspace оборачиваются в `*ViewWrapper` с проверкой `enableStreaming` из `settingsStore` (при `false` — тот же disabled UX, что и раньше у монолитного Party).

## Party subsystem (общее состояние)

Логика load/reconnect/theme-access и форма вечеринки **не дублируются** в view-компонентах:

| Файл | Роль |
| ---- | ---- |
| [`partyWorkspaceStore.ts`](../../../src/workspaces/party/partyWorkspaceStore.ts) | Zustand: поля формы, `serverUnreachable`, `themeAccess`, lifecycle-флаги и т.п. |
| [`usePartyWorkspace.ts`](../../../src/workspaces/party/usePartyWorkspace.ts) | `usePartyWorkspaceRuntime()` — эффекты, обработчики, derived (`previewPlaylistData`, `playbackState`, темы) |
| [`partyWorkspaceReconnectRefs.ts`](../../../src/workspaces/party/partyWorkspaceReconnectRefs.ts) | Module-level reconnect timer и mount-count (один интервал на сессию при нескольких зонах) |
| [`partyWorkspaceUtils.ts`](../../../src/workspaces/party/partyWorkspaceUtils.ts) | Константы и нормализация (в т.ч. `RECONNECT_INTERVAL_MS`) |

**Границы состояния:**

- **`projectStore`** — источник правды для плейлиста, `meta.linkedParty` (`{ id, shortCode }`), `meta.partyTrackDisplay`; `url` не персистируется, регенерируется через `partyService.getPartyUrl`.
- **`partyService`** — граница API (без изменений контракта сервера).
- **Party subsystem store** — эфемерное UI/runtime-состояние онлайн-вечеринки; `linkedParty` в store **не** дублируется.

Editor и Preview могут быть открыты одновременно: изменения в Editor (тема, кастомизация, track display) сразу видны в Preview через общий runtime.

## View-компоненты

- **PartyEditorView** ([`PartyEditorView.tsx`](../../../src/workspaces/party/PartyEditorView.tsx)) — баннер «Привязано к вечеринке», [`PartyTrackDisplaySection`](../../../src/workspaces/party/components/PartyTrackDisplaySection.tsx), [`PartyEditor`](../../../src/workspaces/party/components/PartyEditor.tsx), экраны auth/недоступности сервера, модал entitlement; **без** `PartyPreview`.
- **PartyPreviewView** ([`PartyPreviewView.tsx`](../../../src/workspaces/party/PartyPreviewView.tsx)) — заголовок и [`PartyPreview`](../../../src/workspaces/party/PartyPreview.tsx) только; **без** баннера, track-display и формы.

Стили: `PartyEditorView.css`, `PartyPreviewView.css`; disabled-обёртка — `PartyViewWrapper.css`.

## Отображение имён треков (party track display)

Настройки того, **как показываются имена треков** в веб‑превью и в **плейлисте для API** (публикация, SignalR, модальное окно привязки, AIMP). При включении опции с начала имени снимается заданное число **Unicode code points** (тип `PartyTrackDisplaySettings` в [`project.ts`](../../../src/core/types/project.ts): `stripLeadingCharsEnabled`, `stripLeadingCharsCount`).

- **Не** относится к JSON `customizationSettings` Party API — отдельные проектные поля.
- **Хранение:** `meta.partyTrackDisplay` в [`projectStore`](../../../src/shared/stores/projectStore.ts).
- **UI:** секция только в **PartyEditor** над `PartyEditor`, заголовок — «Отображение треков».
- **Преобразование:** [`partyUtils.ts`](../../../src/shared/utils/partyUtils.ts) (`applyPartyTrackDisplayToTrackName`, `applyPartyTrackDisplayToComponentPlaylist`, `convertPlaylistForApi` / `convertAimpPlaylistForApi`). Исходные имена в проекте не меняются.

## Функциональность

- Создание вечеринки с названием и выбором стиля (Cyberpunk, Sakura, Art Deco, Базовый, Spring Cross Step)
- Настройка кастомизации для выбранного стиля
- Для стиля `basic`: палитры (`base` + 16 предустановленных + `custom`), 5 цветов в режиме `custom`
- Превью плейлиста в отдельной зоне Preview
- Уникальный URL для веб-страницы
- Сохранение привязки вечеринки между сессиями (`linkedParty` в проекте)
- Потеря соединения с сервером и автопереподключение (см. ниже)
- Интеграция с SignalR для трансляции (в разработке)

Для `basic` канонический формат `customizationSettings`: `{ paletteId, customPalette }` с 5 цветами. Сервер принимает generic JSON без строгой per-theme валидации.

### Дата и время мероприятия

В `PartyEditor`: начало (`eventDateTime`), опциональный конец (`eventEndDateTime`), таймзона; синхронизация через `UpdatePartyDto` и публичные DTO для CherryPlayWeb (см. [CONTRACTS.md](../../../../CONTRACTS.md) §6.4).

## Обработка потери соединения

При привязанной вечеринке (`linkedParty`) `usePartyWorkspaceRuntime()` проверяет доступность сервера при запуске (и по таймеру).

### Проверка доступности

`partyService.checkServerReachable()` — HEAD к `/api/parties`, таймаут 5 с; `true` при статусе < 500.

### Поведение при недоступном сервере

- **PartyEditor** заменяется на `OnlineUnavailablePanel` («Не удалось подключиться к серверу»).
- Интервал **60 с** (`RECONNECT_INTERVAL_MS` в `partyWorkspaceUtils`) и кнопка «Проверить сейчас» — через общий reconnect в `partyWorkspaceReconnectRefs` (не дублируется при двух зонах).
- **PartyPreview** экран переподключения **не** показывает; при восстановлении сервера preview подхватывает актуальные данные из runtime.

### Восстановление

При успешной проверке: перезагрузка URL/метаданных, останов таймера, штатный UI Editor.

### Состояния в party subsystem store

| Поле | Назначение |
| ---- | ---------- |
| `serverUnreachable` | Сервер недоступен |
| `isReconnecting` | Идёт проверка соединения |
| `partyWorkspaceReconnectRefs.intervalId` | Module-level интервал |
| `partyWorkspaceReconnectRefs.effectsMountCount` | Число смонтированных runtime hook |

## Layout presets и миграция

Пресеты в [`layoutStore.ts`](../../../src/shared/stores/layoutStore.ts); сигнатуры — [`layoutPreset.ts`](../../../src/shared/utils/layoutPreset.ts):

| Пресет | Структура (корень) | Доли по умолчанию |
| ------ | ------------------ | ----------------- |
| `party` | `horizontal(player, party-editor, party-preview)` | 50% / 25% / 25% |
| `aimp-party` | `horizontal(aimp, party-editor, party-preview)` | 50% / 25% / 25% |

**Миграция persist (version 3):** `migratePersistedLayoutState` / `migrateLegacyPartyLayout` в `layoutStore`:

1. Старые двухколоночные сигнатуры `horizontal(..., party)` → свежий трёхколоночный preset.
2. Произвольные layout с зоной `workspaceType: 'party'` или `workspaceId: 'party-workspace'` → замена зоны на пару editor + preview (размер legacy-зоны делится пополам) или fallback на preset `party`.

Пресет «Вечеринка» в AppHeader доступен только при `enableStreaming === true` (как раньше).

## Зависимости

- `@cherryplay/components` — темы, превью, AuthForm
- `projectStore` — плейлист и мета проекта
- `partyService` — API вечеринок

## Связь со Streaming System и Player

Модуль Party отвечает за **жизненный цикл вечеринки** (создание, `partyId`/`shortCode`, `linkedParty` в проекте). Далее:

- **Streaming System** ([`streaming.md`](../systems/streaming.md)) — SignalR, синхронизация с CherryPlayWeb.
- **Player workspace** ([`player.md`](./player.md)) — источник воспроизведения и обновления плейлиста на сервере.

Цепочка: **Party** → URL и метаданные; **Player** → сессия; **Streaming** → зрители. Подробнее: [docs/integration/streaming.md](../../../../docs/integration/streaming.md).

## См. также

- Исходники и краткий README модуля: [`src/workspaces/party/README.md`](../../../src/workspaces/party/README.md)
- Layout system: [`layout-system.md`](../systems/layout-system.md)
