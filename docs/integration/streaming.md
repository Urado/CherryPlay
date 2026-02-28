# Streaming (приложение — сервер — веб)

Трансляция состояния воспроизведения и плейлиста от организатора (CherryPlayList) к зрителям (CherryPlayWeb) через CherryPlayServer. Соответствует [RELEASE_PLAN.md](../../RELEASE_PLAN.md) §4.3 и §6.

## Обзор

- **Write** — только от организатора (JWT).
- **Viewer** подключается по **shortCode**, получает плейлист (REST и/или последнее сохранённое состояние) и живые обновления по **SignalR** при активной сессии.
- Точность позиции: «в целом совпадает», без жёстких требований к секундам.
- **Offline/freeze** (план §2.1, §4.3): при потере связи у зрителя блок «сейчас играет» скрывается; плейлист и пометки проигранных остаются видимыми.

## Где описано подробно

- **В приложении** — модуль [Streaming (systems)](../../CherryPlayList/docs/modules/systems/streaming.md): компоненты CherryPlayList (signalRService, partyService, partyStore), потоки создания вечеринки, подключения к SignalR, трансляции позиции и состояния, обработка разрыва связи.
- **Сервер** — [CherryPlayServer/README.md](../../CherryPlayServer/README.md): запуск, API, Hub; схема БД — [DATABASE.md](../../CherryPlayServer/DATABASE.md).
- **Веб-клиент** — [CherryPlayWeb/README.md](../../CherryPlayWeb/README.md): структура, используемые эндпоинты, настройка `VITE_API_URL`.
- **Контракты** — [CONTRACTS.md](../../CONTRACTS.md) §2 (SignalR viewer), §3 (SignalR organizer), §4 (Streaming), §6 (PlaybackStateDto, PartyStateDto и др.).

## Краткие потоки (по плану)

1. **Организатор**: подключение к Hub как organizer (JWT), StartSession/EndSession, UpdatePlaybackPosition, UpdateFullState, NotifyStateChanged; при изменении плейлиста — REST PUT playlist и/или события OnPlaylistChanged.
2. **Зритель**: JoinPartyAsViewer(shortCode) или JoinPartyAsViewerWithState(shortCode); подписка на OnSessionStarted, OnSessionEnded, OnFullStateUpdated, OnPlaybackPositionUpdated, OnStateChanged, OnPlaylistChanged; при реконнекте — запрос полного состояния (RequestFullState / JoinPartyAsViewerWithState).
3. **Freeze**: при потере связи UI скрывает блок текущего трека, плейлист и пометки проигранных остаются. При завершении сессии организатором (EndSession) состояние на сервере сохраняется (IsActive=false); зрители получают OnSessionEnded и видят тот же эффект (см. [CONTRACTS.md](../../CONTRACTS.md) §4, [OPS.md](../../CherryPlayServer/OPS.md)).
4. **Сохранение и восстановление состояния сессии**: при отключении организатора (EndSession или разрыв связи) состояние сессии сохраняется в БД. При следующем StartSession сервер восстанавливает сохранённое состояние (текущий трек, позиция, проигранные/отключённые), при необходимости санитизируя его по текущему плейлисту.

## Связь с другими подсистемами

- [Accounts & Auth](./accounts-and-auth.md) — JWT организатора для SignalR и REST.
- [Party Management](./party-management.md) — partyId и shortCode, Publish в edit mode, live в session mode.
- [Data and Contracts](./data-and-contracts.md) — идентичность вечеринки (shortCode/partyId), DTO.
