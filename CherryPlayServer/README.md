# CherryPlay Server

Сервер для трансляции состояния плейлиста с использованием SignalR и персистентного хранилища PostgreSQL.

> **Персистентность:** В production данные (организаторы, вечеринки, плейлисты, состояние сессии) хранятся в **PostgreSQL** через EF Core. Схема БД, миграции и настройка — в [DATABASE.md](DATABASE.md).  
> **Dual storage (intentional):** `UseInMemoryStorage=true` переключает те же интерфейсы репозиториев на in-memory реализации (без Postgres; данные только в процессе) — для локальной разработки/тестов. Флаг читается в `Program.cs`. Обзор: корневой [ARCHITECTURE.md](../ARCHITECTURE.md).  
> **Legal consent (CP-066):** dual UoW — InMemory / `EfLegalConsentUnitOfWork`; Postgres tables `legal_document_versions`, `consent_events`. `ConsentGateMiddleware` always on. OAuth one-shot: `POST /api/oauth/accounts`. Контракт: [CONTRACTS.md](../CONTRACTS.md) §3.2.3; схема: [DATABASE.md](DATABASE.md).

## Требования

- .NET 9.0 SDK (или выше)

## Запуск

```bash
dotnet run
```

Сервер будет доступен по адресу http://localhost:5000

- **Health:** `GET /api/health` — проверка доступности (см. [OPS.md](OPS.md)).
- **InMemory без Postgres (compose):** из корня репозитория — `docker compose -f docker-compose.inmemory.yml up --build` (см. корневой [README.md](../README.md), [DEV_SETUP.md](../DEV_SETUP.md)).
- **Seed data:** `DataSeederHostedService` запускает каталог тем и пакетов (`IThemeCatalogSeeder`) и для PostgreSQL/EF, и для InMemory. Demo-аккаунты и вечеринки создаются только при `UseInMemoryStorage=true`.
- **Demo Admin (InMemory only):** `t@t.ru` / `123456` (роль admin + seed grants ПДн/Terms — re-consent gate не показывается). **Legacy без согласий:** `legacy@t.ru` / `123456` (smoke CP-044: Web-модалка / desktop SSO до deep-link). В PostgreSQL/EF-режиме этих аккаунтов из seeder нет.

## API Endpoints

### GET /api/parties/public/first
Возвращает первый доступный плейлист.

### GET /api/parties/public/{shortCode}/playlist
Возвращает плейлист по shortCode.

## SignalR Hub

Hub доступен по адресу `/partyHub`. Реализация: `Hubs/PartyHub` (+ partials). Контракты методов/событий — только в [CONTRACTS.md](../CONTRACTS.md).

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

Персистентное хранилище — **PostgreSQL**. Описание таблиц, миграции и резервное копирование см. в [DATABASE.md](DATABASE.md).

## Документация

- [API.md](API.md) — указатель на разделы [CONTRACTS.md](../CONTRACTS.md) (REST, SignalR, DTO); описание API только там
- [OPS.md](OPS.md) — эксплуатация: health, логи, бэкап, rate limiting
- Переменные окружения и маппинг в ASP.NET Core — в корневом [ENV.md](../ENV.md); шаблон — корневой [.env.example](../.env.example)

