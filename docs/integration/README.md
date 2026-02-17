# Интеграция приложение — сервер — веб

Документация по подсистемам, которые связывают **CherryPlayList** (desktop), **CherryPlayServer** (backend) и **CherryPlayWeb** (зрители). Соответствует [Плану релиза v1 (RELEASE_PLAN.md)](../../RELEASE_PLAN.md): границы MVP, архитектура по подсистемам (§4) и контракты (§6).

## Цель v1

- Организатор управляет эфиром из **CherryPlayList**.
- Зрители смотрят страницу вечеринки в **CherryPlayWeb**.
- **CherryPlayServer** хранит плейлист/метаданные и стриминг состояния воспроизведения.

## Подсистемы интеграции

| Подсистема | Описание | Документ |
|------------|----------|----------|
| **Accounts & Auth** | Роли (organizer/viewer), JWT, Telegram login, хранение токенов в Desktop и Web | [Accounts and Auth](./accounts-and-auth.md) |
| **Party Management** | CRUD вечеринок, каталог, публикация плейлиста, лимиты, кабинет организатора | [Party Management](./party-management.md) |
| **Streaming** | Трансляция состояния воспроизведения и плейлиста (SignalR + REST), freeze при потере связи | [Streaming](./streaming.md) |
| **Данные и контракты** | Идентичность вечеринки (shortCode/partyId), DTO, REST и SignalR — ссылки на общую документацию | [Data and Contracts](./data-and-contracts.md) |

## Источники правды

Описание API, SignalR и DTO **не дублируется** здесь. Единственный источник — **[CONTRACTS.md](../../CONTRACTS.md)**. Схема БД — **[CherryPlayServer/DATABASE.md](../../CherryPlayServer/DATABASE.md)**.

| Документ | Содержание |
|----------|------------|
| **[RELEASE_PLAN.md](../../RELEASE_PLAN.md)** | План релиза v1: цели, границы MVP, архитектура подсистем (§4), контракты (§6), эпики, критерии готовности. |
| **[CONTRACTS.md](../../CONTRACTS.md)** | Контракты Public (viewer) и Organizer: REST API, SignalR Hub (методы и события), DTO; роли; версионирование (§10). |
| **[CherryPlayServer/DATABASE.md](../../CherryPlayServer/DATABASE.md)** | Схема БД: Organizer, Party, PartyPlaylist, SessionState; связи и политика удаления (по плану §3.2, §4). |
| **[CherryPlayServer/README.md](../../CherryPlayServer/README.md)** | Запуск сервера (.NET), ссылка на DATABASE; текущее состояние (InMemory, тестовые данные). |
| **[CherryPlayServer/API.md](../../CherryPlayServer/API.md)** | Указатель на разделы CONTRACTS.md (REST, SignalR, DTO) для разработки сервера. |
| **[CherryPlayWeb/README.md](../../CherryPlayWeb/README.md)** | Структура веб-приложения, установка и запуск, настройка `VITE_API_URL`, используемые эндпоинты и библиотеки (React, SignalR). |
| **[GLOSSARY.md](../../GLOSSARY.md)** | Глоссарий терминов (shortCode, partyId, organizer, viewer, Publish, freeze и др.). |

## Модули CherryPlayList, связанные с интеграцией

- [Party (workspace)](../../CherryPlayList/docs/modules/workspaces/party.md) — создание вечеринки, сохранение partyId/shortCode/url.
- [Streaming (systems)](../../CherryPlayList/docs/modules/systems/streaming.md) — подключение к SignalR, отправка состояния, переподключение.
- [Player (workspace)](../../CherryPlayList/docs/modules/workspaces/player.md) — сессия воспроизведения и интеграция со стримингом.

## Роли и доступ (по плану §4.1, §6)

| Роль | Клиент | Доступ |
|------|--------|--------|
| **viewer** | CherryPlayWeb | Read-only: публичные API по shortCode, SignalR по shortCode, получение обновлений. |
| **organizer** | CherryPlayList, кабинет в Web | Write: CRUD вечеринок, публикация плейлиста, управление сессией. Только свои данные. |

Авторизация write-операций: **JWT** для REST и SignalR; в Web — сессия через **httpOnly cookie**. Зрители — анонимные.
