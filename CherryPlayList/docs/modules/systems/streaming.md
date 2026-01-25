# Streaming

Система трансляции состояния плейлиста и сессии плеера для зрителей вечеринки.

## Обзор

Streaming System связывает:

- **CherryPlayList** — Electron‑приложение организатора (этот репозиторий).
- **CherryPlayServer** — сервер с REST API и SignalR Hub.
- **CherryPlayWeb** — React‑приложение для зрителей.

Со стороны CherryPlayList система:

- создаёт и настраивает вечеринку (**Party workspace**);
- подключается к **SignalR Hub** как организатор;
- отправляет обновления состояния воспроизведения и плейлиста;
- обрабатывает состояние соединения и переподключения.

Подробная сквозная архитектура описана в файле `STREAMING_ARCHITECTURE.md`.

## Основные компоненты (клиент CherryPlayList)

- **`signalRService`** (`src/shared/services/signalRService.ts`)
  - Создание и управление подключением к SignalR Hub.
  - Автоматическое переподключение и ограничение числа попыток.
  - События: `OnSessionStarted`, `OnSessionEnded`, `OnFullStateUpdated`, `OnPlaybackPositionUpdated`, `OnStateChanged`, `OnPlaylistChanged`.
  - Подписки на Zustand stores и отправка обновлений.

- **`partyService`** (`src/shared/services/partyService.ts`)
  - REST API для создания/обновления вечеринок и их плейлиста.
  - Используется для:
    - создания вечеринки и получения `partyId`/`shortCode`/URL;
    - обновления плейлиста вечеринки;
    - получения текущего состояния с сервера (при необходимости).

- **`partyStore`** (`src/shared/stores/partyStore.ts`)
  - Локальное состояние активной вечеринки:
    - `createdParty` (id, shortCode, url),
    - `isStreaming` (флаг трансляции).
  - Persist между сессиями.

- **`PlayerViewContainer`** (`src/workspaces/player/components/PlayerViewContainer.tsx`)
  - Интеграция Player workspace со Streaming:
    - подключение к SignalR при наличии созданной вечеринки;
    - запуск/остановка отправки позиции и состояния;
    - отслеживание `connectionState` и отображение статуса в UI.

- **`usePlayerSession`** (`src/workspaces/player/hooks/usePlayerSession.ts`)
  - Управление локальной сессией плеера (режим `session`).
  - Колбэк `onSessionStart` позволяет связать старт сессии плеера с запуском трансляции.

## Основные потоки

### 1. Создание вечеринки

1. Пользователь в **Party workspace** заполняет форму и нажимает «Создать вечеринку».
2. `partyService.createParty` отправляет запрос на сервер.
3. В ответ сохраняется:
   - `partyId` — идентификатор вечеринки на сервере;
   - `shortCode` — короткий код для публичного URL;
   - `url` — полный URL страницы для зрителей.
4. Эти данные записываются в `partyStore.createdParty`.

Подробнее см. модуль [Party](../workspaces/party.md).

### 2. Подключение к SignalR

Когда есть созданная вечеринка:

1. `PlayerViewContainer` отслеживает `partyStore.createdParty` и режим плеера.
2. При наличии вечеринки вызывается:
   - `signalRService.connect(token?)` — создание подключения;
   - `signalRService.joinPartyAsOrganizer(partyId)` — присоединение организатора к группе вечеринки;
   - `signalRService.startStoreSubscriptions(partyId)` — подписка на изменения stores (плейлист и состояние плеера);
   - начальное `signalRService.sendFullStateUpdate(partyId)` — отправка полного состояния.
3. В `PlayerHeader` отображается состояние подключения (`Connected`, `Connecting`, `Disconnected`) с помощью `signalRService.getConnectionState()` и `getConnectionErrorReason()`.

### 3. Трансляция позиции и состояния

Во время активной сессии плеера:

1. `usePlayerSession` при старте сессии переводит Player workspace в режим `session` и запускает воспроизведение первого активного трека.
2. `signalRService.startPositionUpdates(partyId)`:
   - Каждую секунду читает `playerAudioStore.position` и текущий трек.
   - Отправляет на сервер `UpdatePlaybackPosition(partyId, trackId, position)`.
3. При изменении трека/статуса:
   - `signalRService.notifyStateChanged(partyId)` — уведомление о смене состояния.
   - `signalRService.updateFullState(partyId, fullState)` — отправка полного `PlaybackStateDto`.
4. Дополнительно `signalRService` отслеживает изменения плейлиста через `useProjectStore.subscribe` и:
   - конвертирует плейлист в формат API (`convertPlaylistForApi`);
   - вызывает `partyService.updatePartyPlaylist(partyId, playlistForApi)`;
   - затем отправляет `sendFullStateUpdate(partyId)`.

На стороне сервера это соответствует потокам 3–4 из `STREAMING_ARCHITECTURE.md` (трансляция позиции и полного состояния).

### 4. Обработка разрыва связи и переподключения

- Если соединение падает, `signalRService`:
  - обновляет `connectionState` (используется в UI);
  - может предпринимать попытки переподключения в соответствии с `reconnectConfig`.
- В `PlayerViewContainer` есть защита от бесконечного переподключения:
  - при ошибке подключения можно планировать отложенную повторную попытку;
  - при размонтировании компонента все таймеры очищаются.
- Зрители в CherryPlayWeb получают события `OnConnectionStatusChanged` и переключают UI в режим «офлайн», используя последнее известное состояние.

## Связь с модулями Player и Party

- **Party workspace**:
  - Отвечает за создание и конфигурацию вечеринки.
  - Сохраняет `partyId`/`shortCode`/`url` в `partyStore`.
  - Предоставляет организатору URL для зрителей.
  - Подробнее: [Party](../workspaces/party.md).

- **Player workspace**:
  - Отвечает за локальную сессию воспроизведения (режимы `preparation` и `session`).
  - При наличии активной вечеринки и подключения к SignalR инициирует трансляцию:
    - отправка позиции,
    - отправка полного состояния,
    - синхронизация плейлиста.
  - Подробнее: [Player](../workspaces/player.md), раздел о сессиях и интеграции.

## Когда использовать Streaming System

Streaming System нужна когда:

- вы хотите, чтобы зрители могли в реальном времени видеть:
  - текущий трек и статус воспроизведения;
  - прогресс по плейлисту;
  - отключённые/проигранные треки;
- вы планируете развивать веб‑клиент (CherryPlayWeb) или мобильные клиенты;
- вы хотите хранить историю сессий/вечеринок на сервере.

Локальная работа плеера и плейлистов возможна и без Streaming — система активируется только при наличии созданной вечеринки и подключении к серверу.

## Отключение стриминга

Модуль стриминга можно полностью отключить через настройку `enableStreaming` в Settings Store. При отключении:

- не выполняются подключения к SignalR
- не отображаются индикаторы соединения
- не отправляются обновления состояния
- все вызовы API блокируются
