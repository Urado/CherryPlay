# API CherryPlayServer — указатель на контракты

Описание REST и SignalR **не дублируется** здесь. Единственный источник правды — **[CONTRACTS.md](../CONTRACTS.md)** в корне репозитория.

Этот файл — навигация по разделам CONTRACTS.md для разработки сервера.

---

## Где что искать в CONTRACTS.md

| Нужно                                                                                                       | Раздел CONTRACTS.md |
| ----------------------------------------------------------------------------------------------------------- | ------------------- |
| Роли (viewer / organizer), границы доступа                                                                  | §1                  |
| **REST Public** (эндпоинты по shortCode, GET /api/config)                                                   | §2.2                |
| **SignalR viewer** (методы invoke, события on)                                                              | §2.3                |
| **Auth** (email+пароль: login/register; OAuth: VK/Mail.ru, exchange, logout; Telegram OAuth2 отложен)       | §3.2                |
| **Profile** (профиль организатора: GET me, PATCH profile)                                                   | §3.3                |
| **REST Organizer** (CRUD вечеринок, playlist, JWT)                                                          | §3.4                |
| **SignalR organizer** (StartSession, EndSession, Update\*, JoinPartyAsOrganizer)                            | §3.5                |
| **Theme access** (`GET /api/organizer/me/theme-access`)                                                     | §3.6                |
| **Admin API** (`/api/admin/*`: organizers, packages, entitlements)                                          | §3.7                |
| Streaming (поведение Desktop ↔ Server ↔ Web)                                                                | §4                  |
| Идентичность вечеринки (shortCode, partyId), ссылки                                                         | §5                  |
| **DTO** (PartyPlaylistDto, PlaybackStateDto, PublicPartyDto, PartyDto, CreatePartyDto, PartyStateDto и др.) | §6                  |
| **DTO monetization/admin** (`ThemeAccessDto`, `EntitlementDto`, `AdminOrganizer*`, `ThemePackage*`)        | §6.8                |
| Соответствие компонентов архитектуре                                                                        | §9                  |
| Версионирование и обратная совместимость                                                                    | §10                 |

**Базовый URL сервера:** по умолчанию `http://localhost:5000`. Hub: `{baseUrl}/partyHub`.

---

## Другие документы сервера

- [README.md](README.md) — запуск, текущее состояние (InMemory, тестовые данные).
- [DATABASE.md](DATABASE.md) — схема БД.
- [OPS.md](OPS.md) — эксплуатация: health, логи, бэкап, rate limiting.
