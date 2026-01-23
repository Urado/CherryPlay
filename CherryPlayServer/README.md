# CherryPlay Server

Минимальный сервер для трансляции состояния плейлиста с использованием SignalR и InMemory базы данных.

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

Сервер использует InMemory хранилище и автоматически инициализирует тестовые данные при запуске.

