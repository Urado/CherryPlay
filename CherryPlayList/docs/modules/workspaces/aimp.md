# AIMP

Мониторинг состояния AIMP и синхронизация **состояния** плейлиста/воспроизведения с сайтом вечеринки, когда в настройках выбран источник **AIMP** (секция **«Синхронизация с сайтом»**). Звук на сайт **не** передаётся — только snapshot для гостей.

## Описание

Модуль доступен только на **Windows x64** при включённом **Онлайн** (`enableStreaming`) и выборе источника **AIMP**. В UI AIMP встроен в зону **Проигрывание** (переключатель CherryPlay / AIMP); отдельный workspace `aimp` сохранён для legacy layout.

Отображаются:

- статус соединения с плагином AIMP (слушает pipe / плагин подключён / устарело / отключено);
- версия плагина;
- **только для чтения** плейлист из AIMP;
- выделение активного трека;
- прогресс текущего трека;
- кнопка **«Включить онлайн»** / **«Выключить онлайн»** — явный запуск синхронизации состояния AIMP с сервером (подключение плагина к pipe само по себе не начинает публикацию).

## Основные компоненты

- **AimpView** (`src/workspaces/aimp/AimpView.tsx`) — UI (embedded в Player или legacy zone).
- **AimpIntegrationController** (`src/app/components/AimpIntegrationController.tsx`) — bootstrap AIMP bridge; SignalR через **`useAimpStreamingOrchestrator`**.
- **aimpStore**, **aimpService**, **aimpStreamingAdapter** / **aimpOrganizerSession** — как раньше.

## Состояния (не путать между собой)

| Состояние                | Описание                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **environment eligible** | Windows x64, манифест плагина, источник = AIMP.                                       |
| **app listening**        | Named-pipe сервер ждёт плагин.                                                        |
| **plugin connected**     | Handshake с плагином выполнен.                                                        |
| **live-stream started**  | Организатор нажал **«Включить онлайн»**; только после этого состояние уходит на сайт. |

## Layout и пресет

- Пресет **«Онлайн-вечеринка»** (`party`) — player + настройка + превью; источник CherryPlay или AIMP переключается в зоне Проигрывание.
- **`aimp-party`** — legacy; не показывается в меню, persist мигрирует на `party`.

## Публикация и троттлинг

- **Источник состояния** — **Настройки → Синхронизация с сайтом → Источник состояния для гостей** (CherryPlay / AIMP).
- На сайт уходит **состояние**, не аудио. Ключи публикации и position tick — без изменений (см. прежнюю версию doc / [Streaming](../systems/streaming.md)).

## Связь со Streaming и Player

- При источнике **AIMP** встроенный CherryPlay для синхронизации не используется; локальная session CherryPlay сбрасывается.
- **Frozen-state publish** (до «Включить онлайн») — `streamingOrchestrator.syncAimpFrozenState`.
- Переключение на **CherryPlay** возвращает синхронизацию из зоны Проигрывание.

## Зависимости

- [Electron AIMP bridge](../../../electron/aimp/), [CherryPlayAimpPlugin](../../../../CherryPlayAimpPlugin/README.md), [AIMP Streaming (интеграция)](../../../../docs/integration/aimp-streaming.md).

## Ограничения v1

- Только Windows x64; только чтение состояния из AIMP.
