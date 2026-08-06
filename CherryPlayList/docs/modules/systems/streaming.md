# Streaming

Система трансляции состояния плейлиста и сессии для зрителей вечеринки (**Site Streamer**).

**Источники состояния:** трансляция может идти из **встроенного плеера** (Player workspace) или из **AIMP** (Windows x64; плагин передаёт состояние по named pipe). Выбор источника — глобальная настройка приложения; при выборе AIMP встроенный Player для стриминга отключается. При источнике AIMP: полное состояние воспроизведения публикуется при смене трека/статуса/плейлиста (ключ публикации не включает позицию); позиция передаётся отдельно через **UpdatePlaybackPosition** каждую 1 с. См. [AIMP (workspace)](../workspaces/aimp.md) и [AIMP Streaming (интеграция)](../../../../docs/integration/aimp-streaming.md).

**Важно:** сессия плеера (воспроизведение плейлиста в CherryPlayList) может работать без стриминга и без вечеринки. Стриминг — опциональная синхронизация состояния сессии с сервером при наличии созданной вечеринки и подключения. См. [GLOSSARY](../../../../GLOSSARY.md) (термин **session**).

## Обзор

Streaming System связывает:

- **CherryPlayList** — Electron‑приложение организатора (этот репозиторий).
- **CherryPlayServer** — сервер с REST API и SignalR Hub.
- **CherryPlayWeb** — React‑приложение для зрителей.

Со стороны CherryPlayList система:

- создаёт и настраивает вечеринку (**Party metadata** — Party workspace, `partyService`, `meta.linkedParty`);
- подключается к **SignalR Hub** как организатор (**Site Streamer** — `src/shared/streaming/`);
- отправляет обновления состояния воспроизведения и плейлиста;
- обрабатывает состояние соединения и переподключения.

Контракты SignalR и REST, потоки данных: [CONTRACTS.md](../../../../CONTRACTS.md) §2–4, §6; обзор стриминга в интеграции — [docs/integration/streaming.md](../../../../docs/integration/streaming.md).

## Границы подсистем (decoupled architecture)

| Подсистема                                                                     | Владеет                                                                                                          | Не владеет                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Site Streamer** (`src/shared/streaming/`)                                    | SignalR connect/disconnect/reconnect, hub invokes, position ticks (~1 с), full-state publish, live playlist sync | Party create/update/lifecycle, формы Party UI          |
| **Party metadata** (`partyService`, `usePartyServerActions`, `LinkPartyModal`) | `linkedParty`, create/update party, explicit publish, lifecycle, theme                                           | SignalR transport, position ticks во время сессии      |
| **Party Player** (`playerAudioStore`, `usePlayerSession`)                      | Локальная сессия, очередь, воспроизведение                                                                       | Прямые вызовы `signalRService` из workspace            |
| **AIMP integration** (`AimpIntegrationController`, `aimpStore`)                | AIMP bridge, IPC, маппинг snapshot → DTO                                                                         | Параллельный connect/publish/teardown вне orchestrator |

Workspaces (Player, AIMP, Party) — **тонкие presentation shells**: подключают хуки orchestrator и отображают UI, но не владеют SignalR lifecycle.

> **UX:** пользовательские строки — **«Онлайн»**; preset / кнопка шапки **«Играть для гостей»** (`party`). В шапке: **HeaderPartyStatus** (при Онлайн) + **HeaderPlaybackPill** только в session mode; индикатор связи в session pill. См. [GLOSSARY](../../../../GLOSSARY.md#cherryplaylist-header-party-status), [party.md — Шапка](../workspaces/party.md#шапка-appheader-статус-и-pill), [online-mode-ux-synthesis.md](../../online-mode-ux-synthesis.md).

## Основные компоненты (клиент CherryPlayList)

### Site Streamer (`src/shared/streaming/`)

- **`streamingOrchestrator`** (`streamingOrchestrator.ts`) — singleton, единая точка SignalR lifecycle для обоих источников:
  - `connect` → `joinPartyAsOrganizer` → подписки на `PlaybackBroadcastSource` и live playlist sync;
  - `StartSession` / `EndSession` при переходе live-сессии;
  - `UpdatePlaybackPosition` каждую 1 с (когда `shouldSendPositionTicks()`);
  - coalesced `UpdateFullState` / `NotifyStateChanged` при смене трека/статуса;
  - reconnect и `party-not-found` (очистка `linkedParty` через callback);
  - `teardown()` / `switchSource()` при смене источника или отключении сети;
  - `syncAimpFrozenState()` — snapshot до старта live-stream (AIMP).

- **`useStreamingOrchestrator`** — React-хук для источника **CherryPlay** (`streamingSource === 'cherryPlayPlayer'`):
  - активен при `enableStreaming`, `streamingSource === 'cherryPlayPlayer'`, `linkedParty`;
  - вызывается в **`CherryPlayStreamingController`** (`src/app/components/CherryPlayStreamingController.tsx`); `connectionState` + `reconnect` отдаются через **`useCherryPlayStreamingConnection`**;
  - **не** вызывает `signalRService.connect` напрямую.

- **`useAimpStreamingOrchestrator`** — React-хук для **AIMP**:
  - активен при `enableStreaming`, `streamingSource === 'aimp'`, `linkedParty`;
  - используется в `AimpIntegrationController`;
  - обновляет `publishingPathState` в `aimpStore` для UI.

- **`PlaybackBroadcastSource`** (`PlaybackBroadcastSource.ts`) — единый интерфейс snapshot для orchestrator:
  - `CherryPlayPlayerBroadcastSource` — читает `playerAudioStore` + `projectStore`;
  - `AimpBroadcastSource` — читает `aimpStore`, frozen-state snapshot для pre-live publish.

- **`partyPlaylistSync`** — граница **Streamer → Party REST** (live sync):
  - `subscribePartyPlaylistSync` / `subscribeAimpPartyPlaylistSync` — PUT `partyService.updatePartyPlaylist` при изменении плейлиста во время эфира;
  - **не** заменяет initial publish и explicit Publish из Party workspace.

- **`onlineNetworkPolicy`** — внутренние helpers (`isStreamingNetworkEnabled`, `isPartyDiscoverabilityEnabled`, `getOnlineNetworkPolicy`):
  - `networkEnabled` — зеркалит **«Онлайн»** (`enableStreaming`); UI/баннеры offline. Hub (SignalR) дополнительно требует `supportsRealAuth` (`isStreamingHubAllowed`) — в fixtures demo hub не стартует. **Не** user-facing label. См. [веб-демо](../../web-demo.md).
  - `partyDiscoverabilityEnabled` — **всегда `true`**; пресет Party и зоны editor/preview не скрываются при офлайне.
  - Хук `useOnlineNetworkPolicy()` — snapshot для Party, orchestrator, **«Мои вечеринки»**.

### Transport и Party metadata

- **`signalRService`** (`src/shared/services/signalRService.ts`) — **только transport**: connect, hub invoke, connection state. Publish и store subscriptions — в orchestrator, не здесь.

- **`partyService`** (`src/shared/services/partyService.ts`) — REST API вечеринок (create/update, playlist PUT). Initial publish и lifecycle — Party metadata; live PUT во время сессии — через `partyPlaylistSync`.

### Workspaces (не владельцы SignalR)

- **`PlayerViewContainer`** — локальная сессия и UI зоны Проигрывание. **Не** владеет connect/publish/teardown и **не** показывает индикатор SignalR.
- **`HeaderPlaybackPill`** — session-only UI в шапке (трек/transport + связь): виден при `session` и `streamingSource === 'cherryPlayPlayer'` (**не** требует `enableStreaming`). `useCherryPlayStreamingConnection` → **`StreamingConnectionIndicator`** (`connectionState`, reconnect). Prep / readiness lamp в pill **нет**.

- **`AimpIntegrationController`** — AIMP bridge bootstrap, source selection sync; вызывает `useAimpStreamingOrchestrator`. **Не** содержит параллельного low-level SignalR path.

- **`usePlayerSession`** — локальный старт/сброс сессии; streaming реагирует на `sessionMode` через orchestrator и broadcast source.

## Основные потоки

### 1. Создание вечеринки (Party metadata)

1. Пользователь в **Party workspace** заполняет форму и нажимает «Создать вечеринку».
2. `partyService.createParty` отправляет запрос на сервер.
3. В ответ сохраняется `partyId`, `shortCode`; `{ id, shortCode }` — в `projectStore.meta.linkedParty`.
4. `url` не персистируется и регенерируется через `partyService.getPartyUrl`.

Подробнее: [Party](../workspaces/party.md).

### 2. Подключение к SignalR (orchestrator)

Когда есть `linkedParty`, `enableStreaming === true` и выбран источник:

1. Соответствующий хук (`useStreamingOrchestrator` или `useAimpStreamingOrchestrator`) вызывает `streamingOrchestrator.start({ partyId, broadcastSource, ... })`.
2. Orchestrator:
   - `signalRService.connect(token?)`;
   - `joinPartyAsOrganizer(partyId)`;
   - подписка на `PlaybackBroadcastSource.subscribe`;
   - `subscribePartyPlaylistSync` / `subscribeAimpPartyPlaylistSync`;
   - начальный full-state publish.
3. В шапке **`HeaderPlaybackPill`** (session + источник CherryPlay) берёт `connectionState` / `reconnect` из **`useCherryPlayStreamingConnection`** и рендерит **`StreamingConnectionIndicator`**. Сводка lifecycle вечеринки — отдельный **`HeaderPartyStatus`** (только при **Онлайн**); см. [party.md — Шапка](../workspaces/party.md#шапка-appheader-статус-и-pill).

`PlayerViewContainer` **не** вызывает `connect` / `joinPartyAsOrganizer` / store subscriptions напрямую и **не** отображает состояние SignalR.

### 3. Трансляция позиции и состояния

Во время активной live-сессии (`isLiveSessionActive()`):

1. Orchestrator вызывает `StartSession` при первом переходе в live.
2. Position tick (~1 с): `UpdatePlaybackPosition(partyId, trackId, position)` если `shouldSendPositionTicks()`.
3. При смене трека или wire-статуса (`idle` / `playing` / `paused` / `ended`):
   - `NotifyStateChanged` + `UpdateFullState(PlaybackStateDto)`;
   - локальные статусы store маппятся в wire-контракт (`playbackState.ts`).
4. При изменении плейлиста — `partyPlaylistSync` → REST PUT + full-state (orchestrator-owned).

На сервере: [CONTRACTS.md](../../../../CONTRACTS.md) §3.5, §4.

**AIMP frozen state:** до нажатия «Старт стриминга» orchestrator может опубликовать snapshot через `syncAimpFrozenState` — parity с прежним поведением, без position в ключе full-state.

### 4. Обработка разрыва связи и переподключения

- `signalRService` обновляет `connectionState`; orchestrator планирует reconnect (`RECONNECT_DELAY_MS`).
- `onPartyNotFound` — очистка `linkedParty`, уведомление пользователю.
- `HeaderPlaybackPill` / `StreamingConnectionIndicator` вызывают `reconnect` из `useCherryPlayStreamingConnection`; таймеры reconnect — в orchestrator.
- Зрители CherryPlayWeb: `OnConnectionStatusChanged`, freeze, см. [docs/integration/streaming.md](../../../../docs/integration/streaming.md).

### 5. Teardown и смена источника

- `streamingOrchestrator.teardown()` / `switchSource()` — `EndSession` (если live), `resetPlaybackState`, `disconnect`.
- Смена `streamingSource` (AIMP ↔ CherryPlay Player) — через orchestrator, без orphan hub sessions.
- `enableStreaming === false` — orchestrator teardown; нет connect, hub invokes, position timer.

## Связь с модулями Player, AIMP и Party

- **Party workspace** — Party metadata: create/bind, theme, lifecycle, explicit publish. См. [Party](../workspaces/party.md).
- **Player workspace** — локальная session; синхронизация через `useStreamingOrchestrator`. См. [Player](../workspaces/player.md).
- **AIMP** (встроен в зону Проигрывание или legacy workspace) — **«Включить онлайн»**; `useAimpStreamingOrchestrator`. См. [AIMP](../workspaces/aimp.md).

## Когда использовать Streaming System

Синхронизация нужна, когда зрители должны видеть текущий трек, прогресс, отключённые/проигранные треки на странице вечеринки. Локальное проигрывание возможно без неё — подсистема активируется при `linkedParty`, **Онлайн** (`enableStreaming`) и выбранном источнике состояния.

## Отключение онлайна (enableStreaming)

Настройка `enableStreaming` в Settings Store (UI: **«Онлайн»** / **«Работа без сети»**). При отключении:

- orchestrator не стартует; нет SignalR connect и hub invokes;
- нет position timer;
- **`HeaderPartyStatus` скрыт**; session **`HeaderPlaybackPill`** (CherryPlay) **может остаться** видимым — локальная сессия без сети; живого SignalR нет;
- Party **остаётся видимой** в layout и меню preset; внутри зон — баннер **«Онлайн-функции отключены»**; сетевые действия disabled.

См. [Party](../workspaces/party.md), [online-mode-ux-synthesis.md](../../online-mode-ux-synthesis.md).

## Связанные документы

- [CONTRACTS.md](../../../../CONTRACTS.md) §3.5–§4, §6 — hub methods, DTO
- [docs/integration/streaming.md](../../../../docs/integration/streaming.md) — потоки organizer/viewer, freeze
- [online-mode-ux-synthesis.md](../../online-mode-ux-synthesis.md) — follow-up UX (шапка, «Онлайн», gates)
- [Веб-демо](../../web-demo.md) — fixtures vs live, `networkEnabled` / hub / `VITE_DEMO_LIVE`
- [Playback Engine — слои](../audio/playback-layers.md) — Party Player vs Demo Player
