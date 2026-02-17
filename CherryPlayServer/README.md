# CherryPlay Server

Минимальный сервер для трансляции состояния плейлиста с использованием SignalR и InMemory базы данных.

> **Примечание:** В текущей версии используется InMemory хранилище для разработки. По плану релиза v1 (Epic A) будет реализована персистентная БД PostgreSQL. См. [DATABASE.md](DATABASE.md) для целевой схемы БД.

## Требования

- .NET 9.0 SDK (или выше)

## Запуск

```bash
dotnet run
```

Сервер будет доступен по адресу http://localhost:5000

## API Endpoints

### GET /api/parties/public/first
Возвращает первый доступный плейлист.

### GET /api/parties/public/{shortCode}/playlist
Возвращает плейлист по shortCode.

## SignalR Hub

Hub доступен по адресу `/partyHub`

### Методы клиента:
- `JoinPartyAsViewer(shortCode: string)` - подключение зрителя к вечеринке
- `UpdatePlaybackPosition(partyId: Guid, trackId: string, position: number)` - обновление позиции воспроизведения
- `UpdateFullState(partyId: Guid, state: PlaybackStateDto)` - обновление полного состояния
- `NotifyStateChanged(partyId: Guid)` - уведомление об изменении состояния

### События Hub:
- `OnPlaybackPositionUpdated(partyId: string, trackId: string, position: number)`
- `OnFullStateUpdated(partyId: string, state: PlaybackStateDto)`
- `OnStateChanged(partyId: string)`

## Данные

> **Временное состояние:** Сервер использует InMemory хранилище и автоматически инициализирует тестовые данные при запуске. После реализации Epic A (см. [RELEASE_PLAN.md](../RELEASE_PLAN.md)) будет использоваться PostgreSQL с миграциями.

Описание таблиц БД по плану релиза v1 см. в [DATABASE.md](DATABASE.md).

## Документация

- [API.md](API.md) — указатель на разделы [CONTRACTS.md](../CONTRACTS.md) (REST, SignalR, DTO); описание API только там
- [OPS.md](OPS.md) — эксплуатация: health, логи, бэкап, rate limiting

