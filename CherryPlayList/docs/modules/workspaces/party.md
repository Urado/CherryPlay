# Party

Модуль вечеринки: создание и управление онлайн-вечеринкой; синхронизация плейлиста и **состояния** проигрывания с сайтом (звук локально у организатора). Регистрирует **два** независимых workspace — **PartyEditor** и **PartyPreview** — с общей party-подсистемой (stores + runtime hook).

## Два workspace

| Workspace         | ID                        | Тип             | UI (RU)                 | Назначение                                   |
| ----------------- | ------------------------- | --------------- | ----------------------- | -------------------------------------------- |
| **Party Editor**  | `party-editor-workspace`  | `party-editor`  | **Настройка вечеринки** | Форма, lifecycle, track display, auth/сервер |
| **Party Preview** | `party-preview-workspace` | `party-preview` | **Как видят гости**     | Превью страницы; demo-панель сценариев       |

Константы и типы: [`workspace.ts`](../../../src/core/constants/workspace.ts). Регистрация обоих модулей: [`party/index.ts`](../../../src/workspaces/party/index.ts) (side-effect import из `entry.tsx`).

Тип `party` и ID `party-workspace` **удалены**; сохранённые layout с legacy-зоной мигрируют автоматически (см. [Layout presets и миграция](#layout-presets-и-миграция)).

Оба workspace монтируются через `*ViewWrapper` → `PartyStreamingGate` (только `PartyWorkspaceRuntimeProvider`). **Видимость зон не зависит** от настройки **«Онлайн»** (`enableStreaming`). При выключенном онлайне или недоступном сервере внутри зоны показываются **контекстные баннеры**, а не скрытие workspace. См. [Онлайн-режим и Party](../../online-mode-ux-synthesis.md).

## Party subsystem (общее состояние)

Логика load/reconnect/theme-access и форма вечеринки **не дублируются** в view-компонентах. Состояние разделено на **production / preview / editor-demo stores** плюс эфемерные `partyProgramEndedStore` (пульт **Конец**) и `partySettingsUiStore` (Design nav в превью):

| Файл                                                                                             | Роль                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`partyWorkspaceStore.ts`](../../../src/workspaces/party/partyWorkspaceStore.ts)                 | **Production only:** поля формы, `serverUnreachable`, `themeAccess`, lifecycle-флаги, `isListedInCatalog`, ошибки сервера и т.п. Без полей preview-сценария и demo-overlay.                                                       |
| [`partyProgramEndedStore.ts`](../../../src/workspaces/party/partyProgramEndedStore.ts)           | **Ephemeral:** `programEnded` + chip **«Архивировать»** (countdown) на пульте при **Конец**; меню chip: **Архивировать** → `archivePartyFromHeader` / **Ещё подождать** / **Скрыть**; не персистируется. См. [party-header-control-ux §7.6](../../party-header-control-ux.md#76-конец-программы--доиграл-последний-трек). |
| [`partySettingsUiStore.ts`](../../../src/workspaces/party/partySettingsUiStore.ts)               | **Ephemeral preview chrome:** `previewDesignOpen` — collapse одной панели дизайна в `party-preview` (≡). См. [party-header-control-ux §6](../../party-header-control-ux.md#6-настройки--модал--design-в-превью).                  |
| [`partyPreviewScenarioStore.ts`](../../../src/workspaces/party/partyPreviewScenarioStore.ts)     | **Preview scenario:** локальная симуляция detached-превью (`isSynchronized`, overrides lifecycle/mock live/track/theme/connection break). По умолчанию `isSynchronized: true`.                                                    |
| [`partyPreviewScenarioActions.ts`](../../../src/workspaces/party/partyPreviewScenarioActions.ts) | Продуктовые мутации сценария: `syncPreviewWithProduction()`, `detachPreview()`, `setPreviewLifecycleOverride`, `setPreviewMockLive`, `resetPreviewScenario()` и др. **Не** защищены `guardDemoMode()` — доступны в main player.   |
| [`partyPreviewEffectiveState.ts`](../../../src/workspaces/party/partyPreviewEffectiveState.ts)   | Чистая функция `resolvePartyPreviewEffectiveState()` + хук `usePartyPreviewEffectiveState()` — merge production runtime и scenario для рендера `PartyPreview`.                                                                    |
| [`partyPreviewMockPlayback.ts`](../../../src/workspaces/party/partyPreviewMockPlayback.ts)       | Константы mock live playback и карта connection-break → `PartyViewerStatusId`.                                                                                                                                                    |
| [`partyEditorDemoStore.ts`](../../../src/workspaces/party/partyEditorDemoStore.ts)               | **Editor demo overlay only:** `blockedOverride` для симуляции blocked-состояний редактора в demo mode.                                                                                                                            |
| [`partyWorkspaceDemoActions.ts`](../../../src/workspaces/party/partyWorkspaceDemoActions.ts)     | Demo-оркестрация (editor fixtures, `demoResetToDefault`, link/project manipulation); защищена `guardDemoMode()`. Preview-сценарий делегирует в `partyPreviewScenarioActions`.                                                     |
| [`usePartyWorkspace.ts`](../../../src/workspaces/party/usePartyWorkspace.ts)                     | `usePartyWorkspaceRuntime()` — эффекты, обработчики, derived (`previewPlaylistData`, `playbackState`, темы). Без импортов scenario store.                                                                                         |
| [`partyWorkspaceReconnectRefs.ts`](../../../src/workspaces/party/partyWorkspaceReconnectRefs.ts) | Module-level reconnect timer и mount-count (один интервал на сессию при нескольких зонах)                                                                                                                                         |
| [`partyThemeAccessLoad.ts`](../../../src/workspaces/party/partyThemeAccessLoad.ts)               | `loadPartyThemeAccess` / `invalidatePartyThemeAccessLoads` — fetch entitlement, post-await generation guard; при сбое — keep cache (`resolveThemeAccessAfterFetchFailure`); loading-flash только при `themeAccess === null`       |
| [`partyWorkspaceUtils.ts`](../../../src/workspaces/party/partyWorkspaceUtils.ts)                 | Константы и нормализация (в т.ч. `RECONNECT_INTERVAL_MS`, `THEME_ACCESS_POLL_INTERVAL_MS`, `THEME_PICKER_UNAVAILABLE_MESSAGE`, `THEME_PICKER_ONLINE_OFF_MESSAGE`); `resolveCreateBlockedByTheme`, `resolveThemePickerHintMessage` |

**Границы состояния:**

- **`projectStore`** — источник правды для плейлиста, `meta.linkedParty` (`{ id, shortCode }`), `meta.partyTrackDisplay`; `url` не персистируется, регенерируется через `partyService.getPartyUrl`.
- **`partyService`** — граница API (без изменений контракта сервера).
- **`partyWorkspaceStore`** — эфемерное production UI/runtime-состояние онлайн-вечеринки; `linkedParty` в store **не** дублируется.
- **`partyProgramEndedStore`** — эфемерный `programEnded` + chip **«Архивировать»** на пульте (заменяет Играть / ↑ / ⚙, пока reminder visible; пункт меню **«Архивировать»** → `archivePartyFromHeader`); **не** персистируется; сброс при fresh project и runtime-условиях (см. матрицу сбросов / [§7.6](../../party-header-control-ux.md#76-конец-программы--доиграл-последний-трек)).
- **`partyPreviewScenarioStore`** — эфемерный локальный сценарий превью; **не** персистируется между перезапусками приложения.

### Доступ к темам (fallback copy)

При сбое проверки entitlement текст для picker (когда онлайн включён, но кэш ещё не был получен) — `THEME_PICKER_UNAVAILABLE_MESSAGE`: **«Выбор недоступен — нет связи с сервером»**. При Online OFF — `THEME_PICKER_ONLINE_OFF_MESSAGE`: **«Включите «Онлайн» в настройках»** (не путать с no-server). При уже загруженном `themeAccess` сбой refresh **не** очищает entitlement-кэш; load идёт через общий `loadPartyThemeAccess` (post-await guard + generation; poll без loading-flash при кэше). Кнопки Create/Update/publish/lifecycle не гейтятся по `serverUnreachable` / отсутствию `themeAccess`. Сообщения «нет доступа» / пакет темы — через `buildThemeNotEntitledMessage` (`partyWorkspaceUtils.ts`). Для revoked/недоступных тем не используются сырые коды пакетов (например `revoked-current-theme`) и форматы вида «Доступно в пакете Недоступно»: показывается человекочитаемая формулировка **«Тема не доступна в ваших пакетах»** (B4). **B5:** если `themeAccess === null`, UI ограничивает picker (Basic + текущая `themeId`, dropdown disabled + hint); Create **не** disabled из‑за null/loading — блокировка Create по теме только когда `themeAccess` есть и текущая тема locked; на submit сервер валидирует entitlement (`ThemeNotEntitledError`). Опрос licenses: каждые **5 мин** (`THEME_ACCESS_POLL_INTERVAL_MS`) при `networkEnabled && isAuth`.

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

Production-события **обычно не** очищают preview scenario и editor demo. Сценарий сбрасывается только явными действиями пользователя, кроме полного сброса контекста проекта (`resetPartyWorkspaceForFreshProject()`), который дополнительно вызывает `resetPreviewScenario()`, `clearPartyProgramEnded()` и `resetPartySettingsUiState()`.

| Событие / действие                                                                        | Production (`partyWorkspaceStore`)                                                                                | Editor demo (`partyEditorDemoStore`) | Preview scenario (`partyPreviewScenarioStore`)           | `partyProgramEndedStore`                              | Settings UI (`partySettingsUiStore`)                  |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `resetPartyWorkspaceState()` (production-only)                                            | Сброс production state формы; entitlement/themeAccess поля сохраняются                                            | **Без изменений**                    | **Без изменений**                                        | **Без изменений**                                     | **Без изменений**                                     |
| `resetPartyLinkState()` (отвязка вечеринки)                                               | Очищает link/server/lifecycle flags                                                                               | **Без изменений**                    | **Без изменений**                                        | **Без изменений** (runtime: clear при `!linkedParty`) | **Без изменений**                                     |
| `serverError`, reconnect, party-not-found (production)                                    | Обновляет production flags; UI **«Отключить от вечеринки»** (`title` «Отвязывает проект от вечеринки на сервере») | Без изменений                        | **Без изменений**                                        | **Без изменений**                                     | **Без изменений**                                     |
| `handleResetAndCreateNewParty()`                                                          | `resetPartyLinkState()` + `setLinkedParty(null)`                                                                  | Без изменений                        | Без изменений                                            | **Без изменений** (runtime: clear при `!linkedParty`) | **Без изменений**                                     |
| `resetPartyWorkspaceForFreshProject()` (New Project / смена identity `filePath`)          | Сброс формы + одноразовые guards; entitlement/themeAccess поля сохраняются                                        | Без изменений                        | Полный initial scenario state (`resetPreviewScenario()`) | `clearPartyProgramEnded()`                            | `resetPartySettingsUiState()` (preview nav collapsed) |
| `syncPreviewWithProduction()`                                                             | Без изменений                                                                                                     | Без изменений                        | `isSynchronized: true`, все overrides сброшены           | **Без изменений**                                     | **Без изменений**                                     |
| `resetPreviewScenario()`                                                                  | Без изменений                                                                                                     | Без изменений                        | Полный initial scenario state                            | **Без изменений**                                     | **Без изменений**                                     |
| Detach-actions (`setPreviewLifecycleOverride`, mock live, track, theme, connection break) | Без изменений                                                                                                     | Без изменений                        | `isSynchronized: false` + соответствующий override       | **Без изменений**                                     | **Без изменений**                                     |
| `demoSetBlockedOverride` и editor fixtures (demo only)                                    | Может менять production для fixture                                                                               | `blockedOverride`                    | Без изменений                                            | **Без изменений**                                     | **Без изменений**                                     |
| `demoResetToDefault()` (demo only)                                                        | Восстанавливает linked demo fixture `DEMODK` + `ready` (явный tester reset; cold start — без link)                | Сбрасывает `blockedOverride`         | Вызывает `resetPreviewScenario()`                        | **Без изменений**                                     | **Без изменений**                                     |
| Перезапуск приложения                                                                     | Re-init                                                                                                           | Re-init                              | Re-init (эфемерно)                                       | Re-init (эфемерно)                                    | Re-init (эфемерно)                                    |

Identity/reset key для автосброса формы и темы — только `meta.filePath` (переименование проекта не сбрасывает party form / theme). При создании нового проекта (`newProject()`) вызывается `resetPartyWorkspaceForFreshProject()` напрямую, поэтому reset формы, preview сценария, `partyProgramEndedStore` и `partySettingsUiStore` происходит даже если `filePath` остаётся `null`; identity key `meta.filePath` покрывает загрузку/смену проекта через effects. После reset выполняется гидратация темы из `meta.partyThemeId` и `meta.partyCustomizationSettings`.

Примечание по entitlement/themeAccess: при `resetPartyWorkspaceState()` (и, соответственно, при `resetPartyWorkspaceForFreshProject()`) сохраняются `themeAccess`, `isThemeAccessLoading`, `themeAccessErrorMessage`, чтобы UI не показывал null-flash.

### Detached preview UI

В **production** (Electron) и **web demo** (`VITE_APP_MODE=demo`) сценарий превью управляется одинаково — всегда видимой нижней панелью [`PartyWorkspaceDemoPanel`](../../../src/workspaces/party/PartyWorkspaceDemoPanel.tsx) `mode="preview"` в [`PartyPreviewView`](../../../src/workspaces/party/PartyPreviewView.tsx):

- grip (свернуть/развернуть), badge **«Сценарии»**, заголовок **«Сценарии превью»**;
- полный набор [`PartyPreviewScenarioControls`](../../../src/workspaces/party/components/PartyPreviewScenarioControls.tsx) `variant="panel"` (lifecycle-пресеты только server states **Черновик / Ждёт начала / В архиве** — без **Не создана** / **Идёт**; mock live/track, design overrides, connection break, **«Снова как на сайте»**).

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

- **PartyEditorView** ([`PartyEditorView.tsx`](../../../src/workspaces/party/PartyEditorView.tsx)) — **stub** для legacy custom layout с зоной `party-editor`: сообщение «настройки — ⚙ в шапке». Полные настройки — в `PartySettingsModal` (§5–§6 UX-дока).
- **PartyPreviewView** ([`PartyPreviewView.tsx`](../../../src/workspaces/party/PartyPreviewView.tsx)) — баннеры connectivity, заголовок (sync/warning badges), rail ≡ + разворачиваемая панель дизайна (`PartyPreviewDesignNav` + `PartyPreviewDesignPanel`), [`PartyPreview`](../../../src/workspaces/party/PartyPreview.tsx) через `usePartyPreviewEffectiveState()`, [`PartyWorkspaceDemoPanel`](../../../src/workspaces/party/PartyWorkspaceDemoPanel.tsx) `mode="preview"`.
- **PartySettingsModal** ([`PartySettingsModal.tsx`](../../../src/app/components/PartySettingsModal.tsx)) — центральный модал настроек вечеринки (одна колонка; все секции полей с `defaultExpanded`; открывается из пульта `openPartySettingsModal`). Контент — [`PartySettingsContent`](../../../src/workspaces/party/components/PartySettingsContent.tsx) + `usePartySettingsFormState`. **Поля** (info, карточка, дизайн, track display) доступны на любой фазе; блок **«Дополнительные данные»** временно скрыт ([`pasha_todo.md`](../../../../docs/archive/personal-todos/pasha_todo.md)). От фазы зависят только **действия** (Создать/Привязать / Save / Make ready / видимость / Copy URL / архив). `completed` — поля read-only.

Стили: `PartyEditorView.css`, `PartyPreviewView.css`; disabled-обёртка — `PartyViewWrapper.css`.

## Отображение имён треков (party track display)

Настройки имён треков в превью, в **плейлисте для API** (publish, SignalR, модалка **«Привязать существующую вечеринку»**, AIMP). Тип `PartyTrackDisplaySettings` — [`project.ts`](../../../src/core/types/project.ts); термин — [GLOSSARY — partyTrackDisplay](../../../../GLOSSARY.md).

- **Не** относится к JSON `customizationSettings` Party API — отдельные проектные поля.
- **Хранение:** `meta.partyTrackDisplay` в [`projectStore`](../../../src/shared/stores/projectStore.ts), в `.cherry` и persist.
- **UI:** [`PartyTrackDisplaySection`](../../../src/workspaces/party/components/PartyTrackDisplaySection.tsx) в **PartyEditor**, заголовок — «Отображение треков»; live-превью на образце `01 — Название трека`.
- **Преобразование:** [`partyUtils.ts`](../../../src/shared/utils/partyUtils.ts) (`normalizePartyTrackDisplaySettings`, `applyPartyTrackDisplayToTrackName`, `applyPartyTrackDisplayToComponentPlaylist`, `convertPlaylistForApi` / `convertAimpPlaylistForApi`). Исходные имена в проекте не меняются.

| Поле                         | Назначение                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `stripLeadingCharsEnabled`   | Включить скрытие префикса имени                                                                                                       |
| `stripLeadingCharsMode`      | **`count`** — снять N ведущих **Unicode code points**; **`untilDelimiter`** — снять всё до первого символа-разделителя (включительно) |
| `stripLeadingCharsCount`     | Число символов для режима `count`                                                                                                     |
| `stripLeadingCharsDelimiter` | Один символ для `untilDelimiter`; по умолчанию пробел (`DEFAULT_PARTY_TRACK_STRIP_DELIMITER`)                                         |

Подписи в UI: «Число символов» / «До символа», поле «Символ-разделитель». Если разделитель не найден — имя без изменений. **Обратная совместимость:** отсутствующие или legacy-поля нормализуются через `normalizePartyTrackDisplaySettings` (режим `count`, delimiter — пробел, count ≥ 0).

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

| Ось                       | Код                           | Поведение                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Сеть**                  | `networkEnabled`              | Зеркалит **«Онлайн»** (`enableStreaming`). REST/UI offline; SignalR hub — только при Online ON и `supportsRealAuth` (Electron / live demo). **Внутренний флаг** — в Settings и Party UI **нет** отдельной метки `networkEnabled`. См. [веб-демо](../../web-demo.md). |
| **Discoverability Party** | `partyDiscoverabilityEnabled` | Пресет **«Играть для гостей»** (`party`), типы зон `party-editor` / `party-preview`, shell редактора. **Всегда `true`** — офлайн не скрывает Party.                                                                                                                  |

Пользовательский privacy/offline — только настройка **«Онлайн»** / **«Работа без сети»** (`enableStreaming`). Она блокирует сетевые действия, но **не** фазу редактора и **не** наличие зон в layout.

### Контекстные баннеры (не gate)

[`PartyConnectivityBanner`](../../../src/workspaces/party/components/PartyConnectivityBanner.tsx):

| Условие                                      | Баннер                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `networkEnabled === false`                   | **«Онлайн-функции отключены»** — локальное редактирование проекта доступно |
| `serverUnreachable` (при включённом онлайне) | **«Не удалось подключиться к серверу»** + «Проверить сейчас»               |

Баннеры встраиваются в shell Editor/Preview; **не** заменяют весь Editor на `OnlineUnavailablePanel`. Фаза (`draft-unlinked` vs linked) и набор кнопок выводятся из `linkedParty` + `partyLifecycleState`, **не** из `networkEnabled`. Сетевые кнопки при **Online OFF** — disabled с подсказкой (privacy). `serverUnreachable` — **только** статус/баннер; Create / Update / publish / lifecycle **не** disabled из‑за unreachable (validate-on-submit: busy + toast / server error).

## Фаза редактора и поверхности действий

Фаза — [`partyEditorPhase.ts`](../../../src/workspaces/party/partyEditorPhase.ts) (`resolvePartyEditorPhase`). После **Создать** сервер возвращает `partyLifecycleState: ready` → фаза `ready` (**Ждёт начала**; заголовок shell **«Настройки вечеринки»**). Фаза `draft-linked` — только legacy-черновики; `completed` — заголовок shell **«Вечеринка в архиве»**. Shell phase badge в shipped Editor **всегда скрыт**.

**Не** фазовый toolbar Publish / Archive / Unarchive: эти действия разведены по поверхностям (as-built вариант B + пульт).

| Поверхность       | Где                                                               | Действия                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **«О вечеринке»** | секция формы в **модале настроек** (не отдельный destination CTA) | По фазе (левый кластер кнопок, как в dialog footer): **Создать** / **Привязать** (`draft-unlinked`); **Обновить**, legacy **Сделать доступной** (`draft-linked`); **Обновить**, каталог (`ready`); каталог (`completed`). **Скопировать URL** — компактный контроль у поля URL в «Информация о вечеринке» (не в футере действий; visibility: `showCopyUrl`). Visibility кнопок футера: `getPartyEditorActionVisibility`. **«В черновик»** нет — сервер запрещает `ready` → `draft` (**409**) |
| **Design**        | секция «Дизайн» / «Стиль оформления»                              | Тема, customization; `PartyTrackDisplaySection` («Отображение треков») — в модале настроек **над** каталогом (после Design; intended order в превью: стиль → треки)                                                                                                                                                                                                                                                                                                                          |
| **Archive**       | **«В архив»** в конце ряда действий модала; при **Конец** — пункт **«Архивировать»** в меню chip (`archivePartyFromHeader`) | Только при `ready` (`resolvePartyArchiveAvailability`: active / quiet / blockedByLive; confirm / alert). Модал: `PartyEditorDangerZone`. Пульт: `partyHeaderCommands.archivePartyFromHeader`. Unarchive **нет** в модале                                                                                                                                                                                                                                              |
| **Пульт**         | AppHeader                                                         | CTA матрица (§7); Publish ↑ + ⚙ только при `linkedParty` (`publishPartyToSite` / модал настроек); при **Конец** + reminder — chip меню **Архивировать** → `archivePartyFromHeader`; Unarchive с confirm (только здесь для привязанного проекта)                                                                                                                                                                                                                                                                                                |

Возврата в черновик нет (сервер запрещает `ready` → `draft`, **409**). `completed` **не** терминальное: `completed` → `ready` с пульта. Компонент [`PartyLifecycleControls`](../../../src/workspaces/party/components/PartyLifecycleControls.tsx) остаётся для **Мои вечеринки** (archive + legacy ready; `hideUnarchive`) и Web-подобных поверхностей — **не** primary chrome Editor.

Метки: [GLOSSARY — lifecycle UI labels](../../../../GLOSSARY.md#cherryplaylist-lifecycle-ui-labels) (`partyLifecycleLabels.ts`). Детали UX: [party-header-control-ux.md](../../party-header-control-ux.md).

## Видимость в каталоге (`isListedInCatalog`)

Отдельно от lifecycle и publish. UI: [`PartyCatalogVisibilityControl`](../../../src/workspaces/party/components/PartyCatalogVisibilityControl.tsx) — сегментированный выбор **«По ссылке»** | **«В каталоге»** (поле API `isListedInCatalog`); выбранный сегмент = текущее значение.

- **Видимость в Editor / модале настроек:** фазы `draft-unlinked` (create, локальный `setIsListedInCatalog` до `POST`), `ready` и `completed` (`shouldShowPartyCatalogVisibilityControl` + `handleCatalogVisibilityChange` / `PUT`). В `draft-linked` контроль **скрыт**. Архивные listed не должны зависать без UI.
- Один паттерн UI на create и после link: подпись **«Видимость»** + динамический hint по выбору (**«По ссылке»** → «Только у кого есть ссылка»; **«В каталоге»** → «Гости найдут вечеринку в каталоге») + два сегмента. Shipped settings используют `layout="default"`; `layout="header"` — компактные сегменты (напр. **«Мои вечеринки»**). Тексты: `partyCatalogLabels.ts`.
- Состояние в `partyWorkspaceStore.isListedInCatalog`; гидратация при load/connect; persist через `buildUpdatePartyDto` / create builders (`partyWorkspaceApiBuilders.ts`).
- При `networkEnabled === false` и фазе `ready`/`completed` — контроль **виден**, disabled; значение из локального/project cache. На create — disabled при offline / creating.
- Создание вечеринки по умолчанию — **«По ссылке»** (`isListedInCatalog: false`); сегмент **«В каталоге»** до create → `true` в payload. См. [CONTRACTS.md](../../../../CONTRACTS.md) (CreatePartyDto).

Термины: [GLOSSARY.md](../../../../GLOSSARY.md) (**unlisted** / **catalog**, таблица UI). Каталог — Editor (`ready`/`completed`) / **Мои вечеринки** / кабинет; в шапке статус вечеринки каталог **не** показывает.

## Шапка AppHeader: статус и пульт

В [`AppHeader`](../../../src/app/components/AppHeader.tsx):

- **Верхний ряд:** слева меню **«Файл»** (⋮); справа **Аккаунт** (при **Онлайн**) и **Настройки**. Команды проекта — в меню **Файл**, не в правом кластере (см. [Save/Load](../systems/save-load.md)).
- **Нижний ряд:** имя проекта, при session/онлайн — пульт вечеринки и playback pill, **WorkspaceMenu**.

Пульт и pill — рядом с областью проекта/проигрывания:

| Блок                                                                       | Когда виден                                                                  | Содержание                                                                                              |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`HeaderPartyStatus`](../../../src/app/components/HeaderPartyStatus.tsx)   | только **Онлайн** (`enableStreaming`)                                        | 4-stage strip + крупный статус + CTA; Publish ↑ + ⚙ только при `linkedParty`; при **Конец** + visible reminder — chip **«Архивировать»** mm:ss [X] **вместо** Играть / ↑ / ⚙ (меню: **Архивировать** → `archivePartyFromHeader` / **Ещё подождать** / **Скрыть**) |
| [`HeaderPlaybackPill`](../../../src/app/components/HeaderPlaybackPill.tsx) | `sessionState.mode === 'session'` и `streamingSource === 'cherryPlayPlayer'` | Трек, transport, громкость, индикатор SignalR                                                           |

**Пульт вечеринки (`header-party-control`) — as-built:**

- Маппинг статуса: [GLOSSARY — header party-status](../../../../GLOSSARY.md#cherryplaylist-header-party-status) (`resolveHeaderPartyStatus`). Primary: **Не создана** / **Черновик** / **Ждёт начала** / **Идёт** / **В архиве**; overlays **Пауза** (только CherryPlay `playerAudioStore`) / **Конец**.
- CTA: **Создать** / **К настройкам** → `openPartySettingsModal()` (**без** смены layout); **Играть** / **Остановить** → guide-панелька + 5s edge highlight; при **Конец** меню chip **«Архивировать»** → `archivePartyFromHeader`; **Вернуть из архива** → confirm (`unarchivePartyFromHeader`). Layout preset `party` — только guide **«Перейти»** (`setLayoutPreset('party')`), не Create/К настройкам/⚙. См. [party-header-control-ux §4](../../party-header-control-ux.md#4-пульт-в-шапке-форма).
- Publish ↑ и ⚙ **скрыты** при **Не создана** (нет `linkedParty`); CTA **«Создать»** остаётся. После link — снова видны.
- Publish ↑ → `publishPartyToSite` (плейлист + метаданные + refresh theme access); подсветка **out-of-sync с сайтом** (плейлист+метаданные vs `lastSyncedPublishParts`; `usePartyPublishOutOfSync`) — **не** `meta.isDirty`; ON: linked + `ready`/`draft` + local ≠ lastSynced; OFF: synced / no link / archived / no baseline; baseline после create, publish, `loadPartyMetadata`, Save metadata, catalog toggle, live playlist PUT; disabled + причина offline / auth / no link / lifecycle (**не** unreachable).
- ⚙ → тот же модал настроек (`openPartySettingsModal`), как Create/К настройкам.
- Отдельной кнопки **«Играть для гостей»** на пульте **нет** (preset — **Рабочие окна** / guide **«Перейти»**).
- При `serverUnreachable` — secondary **нет связи**; primary без изменений.
- Детали: [party-header-control-ux.md](../../party-header-control-ux.md) (§4, §7).

**Playback pill:** виден **только** в session. В prep **полностью скрыт**. Session pill **не** требует `enableStreaming`. Источник AIMP — CherryPlay pill не показывается.

|                              | Онлайн on            | Онлайн off          |
| ---------------------------- | -------------------- | ------------------- |
| prep                         | пульт; pill скрыт    | ни того, ни другого |
| session (`cherryPlayPlayer`) | пульт + session pill | только session pill |

Editor и шапка используют **одни** UI-метки enum `draft` \| `ready` \| `completed` (+ unlinked → **Не создана**, `ready`+session → **Идёт**).

## «Мои вечеринки»

Секция **«Мои вечеринки»** в модалке аккаунта ([`AccountView`](../../../src/app/components/AccountView.tsx) → [`MyPartiesList`](../../../src/app/components/MyPartiesList.tsx)): тот же карточный `Disclosure`, что и «Информация об организаторе», **по умолчанию свёрнута**; кнопка **«Выйти»** — под обоими блоками. Отдельной кнопки в шапке и модалки `myParties` нет.

MVP-действия (список `GET /api/parties` — **включая** `draft`):

| Действие              | Поведение                                                                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Привязать**         | `linkedParty` в проекте + sync полей в `partyWorkspaceStore`; модалка **«Привязать существующую вечеринку»** тоже из полного списка организатора (legacy `draft` достижим)                                                 |
| **Удалить**           | `DELETE` party; при удалении привязанной — сброс link в проекте                                                                                                                                                            |
| **Каталог**           | Сегменты **«По ссылке»** \| **«В каталоге»** (`PUT isListedInCatalog`) при `ready` и `completed`; sync в store при совпадении `linkedParty.id`                                                                             |
| **В архив**           | Через `PartyLifecycleControls` (`hideUnarchive`); `window.confirm`; для **привязанной** к проекту строки — те же `resolvePartyArchiveAvailability` guards (blockedByLive → alert)                                          |
| **Вернуть из архива** | В списке **скрыто** (`hideUnarchive`); возврат привязанной вечеринки — только CTA пульта                                                                                                                                   |
| Статусы в строке      | lifecycle badge (`resolvePartyLifecycleServerBadgeLabel`: **Черновик** / **Ждёт начала** / **В архиве**; для привязанной к проекту строки при активной session и lifecycle `ready` — **Идёт**) + каталог + **«Привязана»** |

Без авторизации — stub без кнопки **«Войти»** (вход уже в `AccountView` выше). Секция видна при открытом Account; при выключенном онлайне загрузка и сетевые действия disabled со stub **«Онлайн-функции отключены»**. Подтверждение удаления — вложенный overlay поверх Account.

## Обработка потери соединения

При привязанной вечеринке (`linkedParty`) `usePartyWorkspaceRuntime()` проверяет доступность сервера при запуске (и по таймеру).

### Проверка доступности

`partyService.checkServerReachable()` — HEAD к `/api/parties`, таймаут 5 с; `true` при статусе < 500.

### Поведение при недоступном сервере

- **PartyEditor** — баннер `PartyConnectivityBanner` (`unreachable`) **внутри** shell; форма и фазовые действия остаются видимыми. Сетевые кнопки disabled **только** при Online OFF; при unreachable кнопки активны, ошибка — на submit.
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

Пресет **«Играть для гостей»** (`party`) **всегда** discoverable в меню **Рабочие окна** (`WorkspaceMenu` → `partyDiscoverabilityEnabled`). При выключенном **Онлайн** зоны Party остаются в layout; внутри — баннер **«Онлайн-функции отключены»**, не скрытие preset/зон. Copy preset `aimp-party` **не** менялась этим rename (deferred).

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
- Термины: [GLOSSARY — lifecycle UI labels](../../../../GLOSSARY.md#cherryplaylist-lifecycle-ui-labels), [GLOSSARY — header party-status](../../../../GLOSSARY.md#cherryplaylist-header-party-status), [GLOSSARY — playback pill](../../../../GLOSSARY.md#cherryplaylist-playback-pill)
- Пульт / Editor B: [party-header-control-ux.md](../../party-header-control-ux.md)
