# Party

Модуль вечеринки: создание и управление онлайн-вечеринкой; синхронизация плейлиста и **состояния** проигрывания с сайтом (звук локально у организатора). Регистрирует **два** независимых workspace — **PartyEditor** и **PartyPreview** — с общей party-подсистемой (stores + runtime hook).

## Два workspace

| Workspace         | ID                        | Тип             | UI (RU)                 | Назначение                                                       |
| ----------------- | ------------------------- | --------------- | ----------------------- | ---------------------------------------------------------------- |
| **Party Editor**  | `party-editor-workspace`  | `party-editor`  | **Настройка вечеринки** | Форма, lifecycle, баннер подключения, track display, auth/сервер |
| **Party Preview** | `party-preview-workspace` | `party-preview` | **Как видят гости**     | Превью страницы; demo-панель сценариев                           |

Константы и типы: [`workspace.ts`](../../../src/core/constants/workspace.ts). Регистрация обоих модулей: [`party/index.ts`](../../../src/workspaces/party/index.ts) (side-effect import из `entry.tsx`).

Тип `party` и ID `party-workspace` **удалены**; сохранённые layout с legacy-зоной мигрируют автоматически (см. [Layout presets и миграция](#layout-presets-и-миграция)).

Оба workspace монтируются через `*ViewWrapper` → `PartyStreamingGate` (только `PartyWorkspaceRuntimeProvider`). **Видимость зон не зависит** от настройки **«Онлайн»** (`enableStreaming`). При выключенном онлайне или недоступном сервере внутри зоны показываются **контекстные баннеры**, а не скрытие workspace. См. [Онлайн-режим и Party](../../online-mode-ux-synthesis.md).

## Party subsystem (общее состояние)

Логика load/reconnect/theme-access и форма вечеринки **не дублируются** в view-компонентах. Состояние разделено на **три независимых Zustand-store** (production, preview scenario, editor demo):

| Файл                                                                                             | Роль                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`partyWorkspaceStore.ts`](../../../src/workspaces/party/partyWorkspaceStore.ts)                 | **Production only:** поля формы, `serverUnreachable`, `themeAccess`, lifecycle-флаги, `isListedInCatalog`, ошибки сервера и т.п. Без полей preview-сценария и demo-overlay.                                                                          |
| [`partyPreviewScenarioStore.ts`](../../../src/workspaces/party/partyPreviewScenarioStore.ts)     | **Preview scenario:** локальная симуляция detached-превью (`isSynchronized`, overrides lifecycle/mock live/track/theme/connection break). По умолчанию `isSynchronized: true`.                                                  |
| [`partyPreviewScenarioActions.ts`](../../../src/workspaces/party/partyPreviewScenarioActions.ts) | Продуктовые мутации сценария: `syncPreviewWithProduction()`, `detachPreview()`, `setPreviewLifecycleOverride`, `setPreviewMockLive`, `resetPreviewScenario()` и др. **Не** защищены `guardDemoMode()` — доступны в main player. |
| [`partyPreviewEffectiveState.ts`](../../../src/workspaces/party/partyPreviewEffectiveState.ts)   | Чистая функция `resolvePartyPreviewEffectiveState()` + хук `usePartyPreviewEffectiveState()` — merge production runtime и scenario для рендера `PartyPreview`.                                                                  |
| [`partyPreviewMockPlayback.ts`](../../../src/workspaces/party/partyPreviewMockPlayback.ts)       | Константы mock live playback и карта connection-break → `PartyViewerStatusId`.                                                                                                                                                  |
| [`partyEditorDemoStore.ts`](../../../src/workspaces/party/partyEditorDemoStore.ts)               | **Editor demo overlay only:** `blockedOverride` для симуляции blocked-состояний редактора в demo mode.                                                                                                                          |
| [`partyWorkspaceDemoActions.ts`](../../../src/workspaces/party/partyWorkspaceDemoActions.ts)     | Demo-оркестрация (editor fixtures, `demoResetToDefault`, link/project manipulation); защищена `guardDemoMode()`. Preview-сценарий делегирует в `partyPreviewScenarioActions`.                                                   |
| [`usePartyWorkspace.ts`](../../../src/workspaces/party/usePartyWorkspace.ts)                     | `usePartyWorkspaceRuntime()` — эффекты, обработчики, derived (`previewPlaylistData`, `playbackState`, темы). Без импортов scenario store.                                                                                       |
| [`partyWorkspaceReconnectRefs.ts`](../../../src/workspaces/party/partyWorkspaceReconnectRefs.ts) | Module-level reconnect timer и mount-count (один интервал на сессию при нескольких зонах)                                                                                                                                       |
| [`partyWorkspaceUtils.ts`](../../../src/workspaces/party/partyWorkspaceUtils.ts)                 | Константы и нормализация (в т.ч. `RECONNECT_INTERVAL_MS`)                                                                                                                                                                       |

**Границы состояния:**

- **`projectStore`** — источник правды для плейлиста, `meta.linkedParty` (`{ id, shortCode }`), `meta.partyTrackDisplay`; `url` не персистируется, регенерируется через `partyService.getPartyUrl`.
- **`partyService`** — граница API (без изменений контракта сервера).
- **`partyWorkspaceStore`** — эфемерное production UI/runtime-состояние онлайн-вечеринки; `linkedParty` в store **не** дублируется.
- **`partyPreviewScenarioStore`** — эфемерный локальный сценарий превью; **не** персистируется между перезапусками приложения.

Editor и Preview могут быть открыты одновременно: изменения в Editor (тема, кастомизация, track display) сразу видны в Preview через общий runtime (в режиме «Синхронизировано»).

### Preview scenario store

Форма [`PartyPreviewScenarioState`](../../../src/workspaces/party/partyPreviewScenarioStore.ts):

| Поле                            | Назначение                                                         |
| ------------------------------- | ------------------------------------------------------------------ |
| `isSynchronized`                | `true` — превью следует runtime/production; overrides игнорируются |
| `mockLiveEnabled`               | Mock live playback в detached-режиме                               |
| `viewerStatusOverride`          | Принудительный viewer status (connection-break сценарии)           |
| `lifecycleOverride`             | Локальный lifecycle badge/state                                    |
| `currentTrackNumber`            | 1-based номер трека для mock live                                  |
| `themeOverride`                 | Локальная тема (не пишет production `themeId`)                     |
| `customizationSettingsOverride` | Локальная кастомизация выбранной preview-темы                      |

Начальное состояние: `isSynchronized: true`, все overrides — `null` / `false`.

### Effective-state facade

**Когда использовать:** любой рендер или derived-логика preview workspace должны читать **`usePartyPreviewEffectiveState()`**, а не напрямую поля production или scenario store.

Хук объединяет snapshot из `usePartyWorkspaceRuntime()` и `usePartyPreviewScenarioStore()` через `resolvePartyPreviewEffectiveState()` и возвращает:

| Поле                                                  | Назначение                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `isSynchronized`                                      | Текущий режим sync/detached                                      |
| `previewLifecycleState`                               | Effective lifecycle для badge/`PartyPreview`                     |
| `effectivePlaybackState`                              | Runtime playback или mock live (с bounding по `previewTrackIds`) |
| `previewViewerStatusOverride`                         | Override viewer status в detached-режиме                         |
| `effectiveThemeId` / `effectiveCustomizationSettings` | Тема и кастомизация с учётом overrides                           |
| `isEffectiveThemeUnavailable`                         | Тема недоступна по entitlement                                   |

В synchronized-режиме effective values = production runtime. В detached — применяются scenario overrides; theme/customization overrides действуют только при `isSynchronized === false`.

Тесты: [`partyPreviewEffectiveState.test.ts`](../../../tests/workspaces/partyPreviewEffectiveState.test.ts), [`partyPreviewScenarioStore.test.ts`](../../../tests/workspaces/partyPreviewScenarioStore.test.ts).

### Матрица сбросов (reset matrix)

Production-события **не** очищают preview scenario и editor demo. Сценарий сбрасывается только явными действиями пользователя.

| Событие / действие                                                                        | Production (`partyWorkspaceStore`)               | Editor demo (`partyEditorDemoStore`) | Preview scenario (`partyPreviewScenarioStore`)     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------ | -------------------------------------------------- |
| `resetPartyWorkspaceState()` (смена проекта/контекста)                                    | Полный initial state                             | **Без изменений**                    | **Без изменений**                                  |
| `resetPartyLinkState()` (отвязка вечеринки)                                               | Очищает link/server/lifecycle flags              | **Без изменений**                    | **Без изменений**                                  |
| `serverError`, reconnect, party-not-found (production)                                    | Обновляет production flags                       | Без изменений                        | **Без изменений**                                  |
| `handleResetAndCreateNewParty()`                                                          | `resetPartyLinkState()` + `setLinkedParty(null)` | Без изменений                        | Без изменений                                      |
| `syncPreviewWithProduction()`                                                             | Без изменений                                    | Без изменений                        | `isSynchronized: true`, все overrides сброшены     |
| `resetPreviewScenario()`                                                                  | Без изменений                                    | Без изменений                        | Полный initial scenario state                      |
| Detach-actions (`setPreviewLifecycleOverride`, mock live, track, theme, connection break) | Без изменений                                    | Без изменений                        | `isSynchronized: false` + соответствующий override |
| `demoSetBlockedOverride` и editor fixtures (demo only)                                    | Может менять production для fixture              | `blockedOverride`                    | Без изменений                                      |
| `demoResetToDefault()` (demo only)                                                        | Восстанавливает demo fixture                     | Сбрасывает `blockedOverride`         | Вызывает `resetPreviewScenario()`                  |
| Перезапуск приложения                                                                     | Re-init                                          | Re-init                              | Re-init (эфемерно)                                 |

### Detached preview UI

В **production** (Electron) и **web demo** (`VITE_APP_MODE=demo`) сценарий превью управляется одинаково — всегда видимой нижней панелью [`PartyWorkspaceDemoPanel`](../../../src/workspaces/party/PartyWorkspaceDemoPanel.tsx) `mode="preview"` в [`PartyPreviewView`](../../../src/workspaces/party/PartyPreviewView.tsx):

- grip (свернуть/развернуть), badge **«Сценарии»**, заголовок **«Сценарии превью»**;
- полный набор [`PartyPreviewScenarioControls`](../../../src/workspaces/party/components/PartyPreviewScenarioControls.tsx) `variant="panel"` (lifecycle **Не на сайте / Опубликована / Архив**, mock live/track, design overrides, connection break, **«Снова как на сайте»**).

Заголовок превью показывает только статусные badge: **«Синхронизировано»** / **«Локальный сценарий»** и при необходимости **«Недоступный дизайн»** — без отдельного toolbar и без клика по badge для раскрытия controls.

Возврат к синхронизации с эфиром — **«Снова как на сайте»** в панели (`resetPreviewScenario()`).

**«Сброс демо»** в preview-панели (`demoResetToDefault`, `guardDemoMode()`) показывается **только в demo mode** — через `showDemoReset={showDemoPanel}`; в production Electron скрыт.

`showDemoPanel` (`isDemoMode` из `getAppMode()`) передаётся в [`PartyPreviewView`](../../../src/workspaces/party/PartyPreviewView.tsx) из общего [`PartyWorkspaceViewWrapper`](../../../src/workspaces/party/PartyWorkspaceViewWrapper.tsx) (делегируется из [`PartyPreviewViewWrapper`](../../../src/workspaces/party/PartyPreviewViewWrapper.tsx)); для preview влияет только на видимость **«Сброс демо»**, не на саму панель сценариев.

**Demo panel** — тонкий UI-потребитель тех же scenario actions:

| Режим панели     | Editor fixtures             | Preview scenario controls                          |
| ---------------- | --------------------------- | -------------------------------------------------- |
| `mode="editor"`  | `partyWorkspaceDemoActions` | —                                                  |
| `mode="preview"` | Скрыты                      | `PartyPreviewScenarioControls` (`variant="panel"`) |

## View-компоненты

- **PartyEditorView** ([`PartyEditorView.tsx`](../../../src/workspaces/party/PartyEditorView.tsx)) — баннер **«Подключено к вечеринке»**, toolbar по **фазе**: lifecycle (**«Открыть»**, **«Снять с сайта»**), publish **«Обновить на сайте»**, **«Создать»**, **«Подключить»**; badges **Не на сайте / Опубликована / Архив**; контроль каталога **«В каталоге»** / **«По ссылке»**; **без** `PartyPreview`.
- **PartyPreviewView** ([`PartyPreviewView.tsx`](../../../src/workspaces/party/PartyPreviewView.tsx)) — баннеры connectivity (офлайн / unreachable), заголовок (sync/warning badges), [`PartyPreview`](../../../src/workspaces/party/PartyPreview.tsx) через `usePartyPreviewEffectiveState()`, всегда [`PartyWorkspaceDemoPanel`](../../../src/workspaces/party/PartyWorkspaceDemoPanel.tsx) `mode="preview"`; **без** track-display и формы.

Стили: `PartyEditorView.css`, `PartyPreviewView.css`; disabled-обёртка — `PartyViewWrapper.css`.

## Отображение имён треков (party track display)

Настройки имён треков в превью и в **плейлисте для API** (publish, SignalR, модалка **«Подключить к вечеринке»**, AIMP). При включении опции с начала имени снимается заданное число **Unicode code points** (`PartyTrackDisplaySettings` в [`project.ts`](../../../src/core/types/project.ts)).

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
- Сохранение подключения к вечеринке между сессиями (`linkedParty` в проекте)
- Потеря соединения с сервером и автопереподключение (см. ниже)
- Интеграция с SignalR для трансляции (в разработке)

Для `basic` канонический формат `customizationSettings`: `{ paletteId, customPalette }` с 5 цветами. Сервер принимает generic JSON без строгой per-theme валидации.

### Дата и время мероприятия

В `PartyEditor`: начало (`eventDateTime`), опциональный конец (`eventEndDateTime`), таймзона; синхронизация через `UpdatePartyDto` и публичные DTO для CherryPlayWeb (см. [CONTRACTS.md](../../../../CONTRACTS.md) §6.4).

## Онлайн, discoverability и внутренняя политика сети

Две **независимые** оси (см. [`onlineNetworkPolicy.ts`](../../../src/shared/streaming/onlineNetworkPolicy.ts)):

| Ось | Код | Поведение |
| --- | --- | --- |
| **Сеть** | `networkEnabled` | SignalR, REST к вечеринкам, загрузка списка. Зеркалит **«Онлайн»** (`enableStreaming`) и demo mode. **Внутренний флаг** — в Settings и Party UI **нет** отдельной метки `networkEnabled`. |
| **Discoverability Party** | `partyDiscoverabilityEnabled` | Пресет **«Онлайн-вечеринка»**, типы зон `party-editor` / `party-preview`, shell редактора. **Всегда `true`** — офлайн не скрывает Party. |

Пользовательский privacy/offline — только настройка **«Онлайн»** / **«Работа без сети»** (`enableStreaming`). Она блокирует сетевые действия, но **не** фазу редактора и **не** наличие зон в layout.

### Контекстные баннеры (не gate)

[`PartyConnectivityBanner`](../../../src/workspaces/party/components/PartyConnectivityBanner.tsx):

| Условие | Баннер |
| ------- | ------ |
| `networkEnabled === false` | **«Онлайн-функции отключены»** — локальное редактирование проекта доступно |
| `serverUnreachable` (при включённом онлайне) | **«Не удалось подключиться к серверу»** + «Проверить сейчас» |

Баннеры встраиваются в shell Editor/Preview; **не** заменяют весь Editor на `OnlineUnavailablePanel`. Фаза (`draft-unlinked` vs linked) и набор кнопок выводятся из `linkedParty` + `partyLifecycleState`, **не** из `networkEnabled`. Сетевые кнопки при офлайне/недоступности сервера — disabled с подсказкой.

## Фаза редактора и действия по фазе

Фаза — [`partyEditorPhase.ts`](../../../src/workspaces/party/partyEditorPhase.ts) (`resolvePartyEditorPhase`):

| Фаза | Условие | Действия в toolbar (`PartyEditorActions`) |
| ---- | ------- | ----------------------------------------- |
| `draft-unlinked` | Нет `meta.linkedParty` | **«Создать»**, **«Подключить»** |
| `draft-linked` / `ready` | Есть `linkedParty` | **«Обновить на сайте»** (+ lifecycle в `PartyLifecycleControls`) |
| `completed` | lifecycle `completed` | Только lifecycle; publish/create/link скрыты |

Lifecycle (**«Открыть»**, **«Снять с сайте»** и т.д.) показывается при любой привязанной фазе, кроме `draft-unlinked`.

## Видимость в каталоге (`isListedInCatalog`)

Отдельно от lifecycle и publish. UI: [`PartyCatalogVisibilityControl`](../../../src/workspaces/party/components/PartyCatalogVisibilityControl.tsx) — переключатель **«По ссылке»** / **«В каталоге»** (поле API `isListedInCatalog`).

- Состояние в `partyWorkspaceStore.isListedInCatalog`; гидратация при load/connect; persist через `buildUpdatePartyDto` / create builders (`partyWorkspaceApiBuilders.ts`).
- Подсказка в контроле: *«Отдельно от статуса публикации на сайте»*.
- При `networkEnabled === false` — контроль **виден**, disabled; значение из локального/project cache.
- При фазе `completed` контроль каталога скрыт (как и publish/create/link действия).
- Создание вечеринки по умолчанию — **«По ссылке»** (`isListedInCatalog: false`), см. [CONTRACTS.md](../../../../CONTRACTS.md).

Термины: [GLOSSARY.md](../../../../GLOSSARY.md) (**unlisted** / **catalog**, таблица UI).

## «Мои вечеринки»

Кнопка **«Мои вечеринки»** в [`AppHeader`](../../../src/app/components/AppHeader.tsx) → модалка [`MyPartiesPanel`](../../../src/app/components/MyPartiesPanel.tsx) (`modal === 'myParties'`).

MVP-действия (список `GET /api/parties`):

| Действие | Поведение |
| -------- | --------- |
| **Привязать** | `linkedParty` в проекте + sync полей в `partyWorkspaceStore` |
| **Удалить** | `DELETE` party; при удалении привязанной — сброс link в проекте |
| **Каталог** | Toggle **«По ссылке»** / **«В каталоге»** (`PUT isListedInCatalog`); sync в store при совпадении `linkedParty.id` |
| Статусы в строке | lifecycle badge + каталог + **«Привязана»** |

Без авторизации — stub с кнопкой **«Войти»** (существующий account flow). Панель **открывается** при выключенном онлайне; загрузка и сетевые действия disabled со stub **«Онлайн-функции отключены»**.

## Обработка потери соединения

При привязанной вечеринке (`linkedParty`) `usePartyWorkspaceRuntime()` проверяет доступность сервера при запуске (и по таймеру).

### Проверка доступности

`partyService.checkServerReachable()` — HEAD к `/api/parties`, таймаут 5 с; `true` при статусе < 500.

### Поведение при недоступном сервере

- **PartyEditor** — баннер `PartyConnectivityBanner` (`unreachable`) **внутри** shell; форма и фазовые действия остаются видимыми (сетевые кнопки disabled).
- Интервал **60 с** (`RECONNECT_INTERVAL_MS` в `partyWorkspaceUtils`) и кнопка «Проверить сейчас» — через общий reconnect в `partyWorkspaceReconnectRefs` (не дублируется при двух зонах).
- **PartyPreview** — тот же баннер при `serverUnreachable`; при восстановлении сервера preview подхватывает актуальные данные из runtime.

Полноэкранный `OnlineUnavailablePanel` в Editor **не** используется для обычной потери связи (остаётся для blocked-фаз: auth, outdated client и т.п.).

### Восстановление

При успешной проверке: перезагрузка URL/метаданных, останов таймера, снятие баннера unreachable.

### Состояния в party subsystem store

| Поле                                            | Назначение                        |
| ----------------------------------------------- | --------------------------------- |
| `serverUnreachable`                             | Сервер недоступен                 |
| `isReconnecting`                                | Идёт проверка соединения          |
| `partyWorkspaceReconnectRefs.intervalId`        | Module-level интервал             |
| `partyWorkspaceReconnectRefs.effectsMountCount` | Число смонтированных runtime hook |

## Layout presets и миграция

Фабрики пресетов — [`layoutPresetFactories.ts`](../../../src/shared/utils/layoutPresetFactories.ts) (`createPartyLayout`, `createLayoutByPreset` и др.); сигнатуры сопоставления — [`layoutPreset.ts`](../../../src/shared/utils/layoutPreset.ts) (`getLayoutPresetFromLayout`):

| Пресет       | Структура (корень)                                | Доли по умолчанию |
| ------------ | ------------------------------------------------- | ----------------- |
| `party`      | `horizontal(player, party-editor, party-preview)` | 50% / 25% / 25%   |
| `aimp-party` | `horizontal(aimp, party-editor, party-preview)`   | 50% / 25% / 25%   |

**Миграция persist (version 3):** `migratePersistedLayoutState` / `migrateLegacyPartyLayout` в `layoutStore`:

1. Старые двухколоночные сигнатуры `horizontal(..., party)` → свежий трёхколоночный preset.
2. Произвольные layout с зоной `workspaceType: 'party'` или `workspaceId: 'party-workspace'` → замена зоны на пару editor + preview (размер legacy-зоны делится пополам) или fallback на preset `party`.

Пресет **«Онлайн-вечеринка»** (`party`) **всегда** в меню workspace (`WorkspaceMenu` → `partyDiscoverabilityEnabled`). При выключенном **Онлайн** зоны Party остаются в layout; внутри — баннер **«Онлайн-функции отключены»**, не скрытие preset/зон.

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

- [Онлайн-режим и Party](../../online-mode-ux-synthesis.md) — продуктовые решения, checklist UX
- Исходники и краткий README модуля: [`src/workspaces/party/README.md`](../../../src/workspaces/party/README.md)
- Layout system: [`layout-system.md`](../systems/layout-system.md) — минимальные размеры зон: `party-editor` **400×300**, `party-preview` **320×240** px (`src/workspaces/party/index.ts`)
