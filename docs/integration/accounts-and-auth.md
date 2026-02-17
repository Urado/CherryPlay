# Accounts & Auth

Подсистема учётных записей и авторизации для разграничения доступа между организатором (write) и зрителем (read-only). Соответствует [RELEASE_PLAN.md](../../RELEASE_PLAN.md) §4.1 и §6.

## Обзор

- **Организатор** — владелец данных; все write-операции (CRUD вечеринок, публикация плейлиста, управление сессией) требуют авторизации.
- **Зритель** — анонимный доступ по shortCode к публичным API и SignalR; write-методы не вызываются.
- В v1 доступны три OAuth 2.0 провайдера для входа организатора: **Telegram**, **VK**, **Mail.ru**. Email+пароль не обязателен.

## Роли

| Роль | Кто | REST | SignalR |
|------|-----|------|---------|
| **organizer** | CherryPlayList (desktop), кабинет в CherryPlayWeb | Bearer JWT для POST/PUT/DELETE и GET своих вечеринок | JWT при подключении к Hub; вызов StartSession, EndSession, UpdatePlaybackPosition, UpdateFullState, NotifyStateChanged, JoinPartyAsOrganizer |
| **viewer** | CherryPlayWeb (страница party/<shortCode>) | Без авторизации: GET по shortCode (метаданные, плейлист, каталог) | Подключение по shortCode: JoinPartyAsViewer, RequestFullState; только приём событий от сервера |

## JWT

- **Access token** используется для API и SignalR.
- В **Web** (кабинет организатора): хранение в **httpOnly cookie** (без доступа JS к токенам).
- В **CherryPlayList**: передача в заголовке Authorization (Bearer) и при вызове `JoinPartyAsOrganizer(partyId, token)`; хранение — предпочтительно защищённое хранилище ОС (например, Windows Credentials).
- В v1 допускается простая политика TTL (достаточный срок на мероприятие или ручной повторный вход). Refresh-токены и self-service восстановление — позже.

## Логин в CherryPlayList (desktop)

По плану §4.1.1:

1. **UI**: экран «Аккаунт» (войти/выйти, выбор провайдера: Telegram/VK/Mail.ru, текущий организатор).
2. **Поток входа** (универсальный для всех провайдеров):
   - пользователь выбирает провайдера (Telegram, VK или Mail.ru);
   - приложение открывает системный браузер на `auth/{provider}/start` (например `auth/vk/start`);
   - после успешного входа провайдер делает redirect:
     - через custom URL scheme (например `cherryplaylist://auth?...`), или
     - через локальный callback `http://127.0.0.1:<port>/callback`;
   - приложение извлекает `code` и вызывает `POST /auth/exchange` с телом `{ code, provider }`.
3. **Использование токена**: REST — Bearer JWT; SignalR — JWT при подключении к Hub и в `JoinPartyAsOrganizer`.
4. **Истечение**: простая стратегия v1 (ручной ре-логин при необходимости).

## Логин в CherryPlayWeb (organizer)

По плану §4.1.2:

- Кабинет организатора использует **httpOnly cookie**.
- Пользователь выбирает провайдера на странице логина и переходит на `/auth/{provider}/web` (например `/auth/mailru/web`).
- После авторизации провайдер делает redirect на `/auth/{provider}/callback`, сервер устанавливает httpOnly cookie.
- В кабинете v1: метаданные вечеринок и публикация; **управления эфиром (сессией) нет** — только в CherryPlayList.

## Связь с модулями приложения

- **Party workspace** — создание вечеринки и Publish требуют авторизованного организатора; вызовы идут через `partyService` с токеном.
- **Streaming** — подключение к SignalR как организатор и вызов write-методов выполняются с тем же JWT (см. [Streaming](./streaming.md)).

## Контракты

Детали эндпоинтов логина, обмена токенов и профиля организатора — в [CONTRACTS.md](../../CONTRACTS.md):
- **Auth (логин/логаут):** §3.2 — OAuth 2.0 провайдеры (Telegram, VK, Mail.ru) для Desktop (`/auth/{provider}/start`, `/auth/exchange`) и Web (`/auth/{provider}/web`, `/auth/{provider}/callback`), logout.
- **Profile:** §3.3 — управление профилем организатора (`GET /api/organizer/me`, `PATCH /api/organizer/profile`).
- **Защита write-методов:** CONTRACTS §2–3 (REST и SignalR требуют JWT).
