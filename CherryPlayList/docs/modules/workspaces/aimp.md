# AIMP

Workspace для мониторинга состояния AIMP и трансляции плейлиста/воспроизведения на сайт вечеринки, когда в качестве источника стриминга выбран AIMP.

## Описание

Модуль доступен только на **Windows x64** при включённом стриминге и выборе источника **AIMP** в настройках. В нём отображаются:

- статус соединения с плагином AIMP (слушает pipe / плагин подключён / устарело / отключено);
- версия плагина;
- **только для чтения** плейлист из AIMP (стандартные строки треков, без клика и редактирования);
- выделение активного трека;
- прогресс текущего трека внизу панели;
- кнопка **«Старт стриминга»** — явный запуск трансляции состояния AIMP на сайт (подключение плагина к pipe само по себе не начинает эфир).

## Основные компоненты

- **AimpView** (`src/workspaces/aimp/AimpView.tsx`) — основной UI workspace.
- **AimpIntegrationController** (`src/app/components/AimpIntegrationController.tsx`) — синхронизация источника с Electron, подключение AIMP-пути к SignalR и публикация состояния.
- **aimpStore** (`src/shared/stores/aimpStore.ts`) — состояние моста AIMP (от Electron).
- **aimpService** (`src/shared/services/aimpService.ts`) — вызовы IPC к main process (getState, setSourceSelection, setLiveStreamStarted, onStateChanged).
- **aimpStreamingAdapter** / **aimpOrganizerSession** — приведение AIMP snapshot к контракту организатора и публикация в Hub.

## Состояния (не путать между собой)

| Состояние                | Описание                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **environment eligible** | Windows x64, манифест плагина найден, источник = AIMP; без этого AIMP-режим недоступен.         |
| **app listening**        | CherryPlayList поднял named-pipe сервер и ждёт подключения плагина.                             |
| **plugin connected**     | Плагин AIMP подключился к pipe и прошёл handshake (hello/helloAck).                             |
| **live-stream started**  | Организатор нажал «Старт стриминга» в панели AIMP; только после этого состояние уходит на сайт. |

Подключение плагина **не равно** запущенному стриму: стрим начинается только после явного действия в AIMP workspace.

## Layout и пресет

- Пресет **«AIMP + Party»** (слева AIMP, справа Party) доступен в выборе layout при выбранном источнике **AIMP** и успешной проверке окружения (Windows x64, манифест плагина). Включённость стриминга на видимость пресета не влияет.
- Если переключить источник обратно на «CherryPlay Player» или сделать окружение невалидным, пресет скрывается; при активном layout «AIMP + Party» приложение переключается на fallback-пресет.

## Публикация и троттлинг (стрим на сайт)

- **Выбор источника** задаётся в настройках (Стриминг → источник: AIMP или CherryPlay Player). При источнике AIMP встроенный Player для стриминга не используется.
- **Ключ публикации плейлиста:** `getAimpPlaylistPublishKey(playlistSnapshot)` — `playlistId:revision`; полное состояние плейлиста отправляется при изменении ревизии.
- **Ключ публикации воспроизведения:** `getAimpPlaybackPublishKey(state)` — намеренно **не включает** `positionMs` и `revision`, чтобы не слать `UpdateFullState` на каждое обновление позиции. Полное состояние воспроизведения публикуется при смене трека, статуса или плейлиста. **Позиция** передаётся отдельно вызовом **`UpdatePlaybackPosition` раз в 1 с** (интервал задаётся в подписке SignalR при источнике AIMP).
- **Party preview:** в workspace Party превью плейлиста при источнике AIMP строится из состояния AIMP (`aimpStore`): список треков и текущий трек берутся из `playlistSnapshot` и `getAimpCurrentTrack(bridgeState)` (см. [AIMP Streaming (корень)](../../../../docs/integration/aimp-streaming.md)).
- **Разрешение currentTrackKey для отображения:** в UI «текущий трек» определяется через `getAimpCurrentTrack(bridgeState)`: ключ = `playbackSnapshot.currentTrackKey ?? playlistSnapshot.activeTrackKey`; по этому ключу ищется трек в `playlistSnapshot.tracks`; имя/исполнитель подставляются из найденного трека (без плейлиста имя текущего трека вывести нельзя).

## Связь со Streaming и Player

- При **источнике AIMP** встроенный Player **полностью отключён** для стриминга: его сессия сбрасывается, трансляция идёт только из AIMP.
- Публикация на сервер/сайт идёт через тот же SignalR/REST контракт, что и для встроенного плеера; данные из AIMP приводятся к тому же формату (адаптер в `aimpStreamingAdapter` / `aimpOrganizerSession`).
- При обрыве плагина или pipe поведение для зрителей такое же, как при обрыве организатора: freeze, затем через 1 мин скрытие «сейчас играет» (см. [Streaming](../systems/streaming.md) и [Streaming (интеграция)](../../../../docs/integration/streaming.md)).
- Переключение источника обратно на **CherryPlay Player** возвращает обычный сценарий: стриминг снова от встроенного плеера, AIMP больше не используется.

## Зависимости

- Контракт и pipe-сервер: [Electron AIMP bridge](../../../electron/aimp/), контракт в `src/shared/contracts/aimp.ts`.
- Плагин AIMP: [CherryPlayAimpPlugin](../../../../CherryPlayAimpPlugin/README.md) — сборка, установка, протокол.

## Ограничения v1

- Только Windows x64.
- Только чтение состояния из AIMP; управление воспроизведением AIMP из приложения в v1 не реализовано.
