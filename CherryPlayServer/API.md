# API CherryPlayServer — указатель на контракты

Описание REST и SignalR **не дублируется** здесь. Единственный источник правды — **[CONTRACTS.md](../CONTRACTS.md)** в корне репозитория.

Этот файл — навигация по разделам CONTRACTS.md для разработки сервера.

---

## Где что искать в CONTRACTS.md

| Нужно | Раздел CONTRACTS.md |
|-------|----------------------|
| Роли (viewer / organizer), границы доступа | §1 |
| **REST Public** (эндпоинты по shortCode) | §2.2 |
| **SignalR viewer** (методы invoke, события on) | §2.3 |
| **Auth** (OAuth провайдеры: Telegram/VK/Mail.ru, exchange, logout) | §3.2 |
| **Profile** (профиль организатора: GET me, PATCH profile) | §3.3 |
| **REST Organizer** (CRUD вечеринок, playlist, JWT) | §3.4 |
| **SignalR organizer** (StartSession, EndSession, Update*, JoinPartyAsOrganizer) | §3.5 |
| Streaming (поведение Desktop ↔ Server ↔ Web) | §4 |
| Идентичность вечеринки (shortCode, partyId), ссылки | §5 |
| **DTO** (PartyPlaylistDto, PlaybackStateDto, PublicPartyDto, PartyDto, CreatePartyDto, PartyStateDto и др.) | §6 |
| Соответствие компонентов архитектуре | §9 |
| Версионирование и обратная совместимость | §10 |

**Базовый URL сервера:** по умолчанию `http://localhost:5000`. Hub: `{baseUrl}/partyHub`.

---

## Другие документы сервера

- [README.md](README.md) — запуск, текущее состояние (InMemory, тестовые данные).
- [DATABASE.md](DATABASE.md) — схема БД.
- [OPS.md](OPS.md) — эксплуатация: health, логи, бэкап, rate limiting.
