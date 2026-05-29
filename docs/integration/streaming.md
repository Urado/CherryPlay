# Streaming (приложение — сервер — веб)

Трансляция состояния воспроизведения и плейлиста от организатора (CherryPlayList) к зрителям (CherryPlayWeb) через CherryPlayServer. Соответствует [RELEASE_PLAN.md](../../RELEASE_PLAN.md) §4.3 и §6.

## Обзор

- **Write** — только от организатора (JWT).
- **Источник состояния:** организатор может транслировать состояние либо из **встроенного плеера** CherryPlayList (Player workspace), либо из **AIMP** (Windows x64, плагин + named pipe). Выбор источника — в настройках приложения; см. [AIMP Streaming](./aimp-streaming.md).
- **Viewer** подключается по **shortCode**, получает плейлист (REST и/или последнее сохранённое состояние) и живые обновления по **SignalR** при активной сессии.
- Точность позиции: «в целом совпадает», без жёстких требований к секундам.
- **Offline/freeze** (план §2.1, §4.3): при **обрыве связи организатора** (OnConnectionStatusChanged(false)) веб-клиент не сбрасывает состояние воспроизведения: текущее состояние «замораживается». Через **1 минуту** без реконнекта блок «сейчас играет» скрывается (playbackState обнуляется), плейлист и пометки проигранных остаются. При **явном завершении сессии** (EndSession) блок «сейчас» скрывается сразу. При возврате трансляции в течение минуты таймер сбрасывается и отображается актуальное состояние.

## Где описано подробно

- **В приложении** — модуль [Streaming (systems)](../../CherryPlayList/docs/modules/systems/streaming.md): компоненты CherryPlayList (signalRService, partyService, partyStore), потоки создания вечеринки, подключения к SignalR, трансляции позиции и состояния, обработка разрыва связи.
- **Сервер** — [CherryPlayServer/README.md](../../CherryPlayServer/README.md): запуск, API, Hub; схема БД — [DATABASE.md](../../CherryPlayServer/DATABASE.md).
- **Веб-клиент** — [CherryPlayWeb/README.md](../../CherryPlayWeb/README.md): структура, используемые эндпоинты, настройка `VITE_API_URL`.
- **Контракты** — [CONTRACTS.md](../../CONTRACTS.md) §2 (SignalR viewer), §3 (SignalR organizer), §4 (Streaming), §6 (PlaybackStateDto, PartyStateDto и др.).

## Краткие потоки (по плану)

1. **Организатор**: подключение к Hub как organizer (JWT), StartSession/EndSession, UpdatePlaybackPosition, UpdateFullState, NotifyStateChanged; при изменении плейлиста — REST PUT playlist и/или события OnPlaylistChanged.
2. **Зритель**: JoinPartyAsViewer(shortCode) или JoinPartyAsViewerWithState(shortCode); подписка на OnSessionStarted, OnSessionEnded, OnPartyDisplayStatusChanged, OnFullStateUpdated, OnPlaybackPositionUpdated, OnStateChanged, OnPlaylistChanged; при реконнекте — запрос полного состояния (RequestFullState / JoinPartyAsViewerWithState). Поле `partyDisplayStatus` в `PublicPartyDto` / `PartyStateDto` — серверный статус для индикатора; клиент добавляет `server_unreachable` / `connecting` (см. CONTRACTS §6.7).
3. **Freeze и завершение сессии (веб-клиент)**:
   - **Обрыв организатора** (OnConnectionStatusChanged(partyId, false)): сервер **не** вызывает EndSession автоматически; сессия остаётся активной, `partyDisplayStatus` переходит в `organizer_offline` после grace (~60 с). Состояние воспроизведения не сбрасывается сразу; запускается таймер 1 мин; по истечении — скрывается блок «сейчас играет» (playbackState = null), плейлист и проигранные треки остаются. При реконнекте организатора и приходе OnSessionStarted / OnFullStateUpdated / requestFullState таймер сбрасывается.
   - **Явное завершение** (организатор нажал EndSession): зрители получают OnSessionEnded; через короткую задержку (~1,5 с) блок «сейчас» скрывается сразу (если до этого не пришёл OnConnectionStatusChanged(false), т.е. это не обрыв).
   - См. [CONTRACTS.md](../../CONTRACTS.md) §4, [OPS.md](../../CherryPlayServer/OPS.md).
4. **Сохранение и восстановление состояния сессии**: при отключении организатора (EndSession или разрыв связи) состояние сессии сохраняется в БД. При следующем StartSession сервер восстанавливает сохранённое состояние (текущий трек, позиция, проигранные/отключённые), при необходимости санитизируя его по текущему плейлисту.

## Связь с другими подсистемами

- [Accounts & Auth](./accounts-and-auth.md) — JWT организатора для SignalR и REST.
- [Party Management](./party-management.md) — partyId и shortCode, Publish в edit mode, live в session mode.
- [Data and Contracts](./data-and-contracts.md) — идентичность вечеринки (shortCode/partyId), DTO.
