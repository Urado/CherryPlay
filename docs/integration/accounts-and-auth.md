# Accounts & Auth

Подсистема учётных записей и авторизации для разграничения доступа между организатором (write) и зрителем (read-only). Соответствует [RELEASE_PLAN.md](../../RELEASE_PLAN.md) §4.1 и §6.

## Обзор

- **Организатор** — владелец данных; все write-операции (CRUD вечеринок, публикация плейлиста, управление сессией) требуют авторизации.
- **Зритель** — анонимный доступ по shortCode к публичным API и SignalR; write-методы не вызываются.
- В v1 доступны: вход по **email+пароль** (логин/регистрация) и OAuth 2.0 провайдеры **VK**, **Mail.ru**. **OAuth2 для Telegram откладывается** на последующие версии.

## Роли

| Роль | Кто | REST | SignalR |
|------|-----|------|---------|
| **organizer** | CherryPlayList (desktop), кабинет в CherryPlayWeb | Bearer JWT для POST/PUT/DELETE и GET своих вечеринок | JWT при подключении к Hub; вызов StartSession, EndSession, UpdatePlaybackPosition, UpdateFullState, NotifyStateChanged, JoinPartyAsOrganizer |
| **viewer** | CherryPlayWeb (страница party/<shortCode>) | Без авторизации: GET по shortCode (метаданные, плейлист, каталог) | Подключение по shortCode: JoinPartyAsViewer, RequestFullState; только приём событий от сервера |

## JWT

- **Access token** используется для API и SignalR.
- В **Web** (кабинет организатора): хранение в **httpOnly cookie** (без доступа JS к токенам).
- В **CherryPlayList**: передача в заголовке Authorization (Bearer) и при вызове `JoinPartyAsOrganizer(partyId, token)`; хранение — предпочтительно защищённое хранилище ОС (например, Windows Credentials).
- В v1 допускается простая политика TTL (достаточный срок на мероприятие или ручной повторный вход). **Refresh-токены** и self-service восстановление пароля запланированы на последующие версии; до тех пор при истечении токена требуется повторный вход.
- При OAuth для Desktop допускаются только проверенные redirect URI: `cherryplaylist://auth` и `http://127.0.0.1` (для разработки).

## Реализация (v1)

- **JWT**: секретный ключ задаётся переменной окружения/конфигом `JWT_SECRET_KEY` (обязательно, не менее 32 символов; в production дефолтный ключ запрещён).
- **Rate limiting**: на все эндпоинты auth действует лимит (например, 10 запросов в минуту); при превышении — 429.
- **Валидация redirect URI**: для Desktop OAuth принимаются только `cherryplaylist://auth` и `http://127.0.0.1`; произвольный redirect из запроса отклоняется.
- **Пароли**: хеширование BCrypt с уникальной солью на каждый пароль; минимальная длина пароля и лимиты имени организатора заданы константами (сервер и клиенты согласованы).
- **Ошибки входа**: единое сообщение при неверных учётных данных (без раскрытия «существует ли email»).

## Логин в CherryPlayList (desktop)

По плану §4.1.1:

1. **UI**: экран «Аккаунт» (войти/выйти, выбор: email+пароль или OAuth — VK/Mail.ru; текущий организатор). OAuth через Telegram в v1 не используется (отложен).
2. **Поток входа** (OAuth, универсальный для VK и Mail.ru):
   - пользователь выбирает провайдера (VK или Mail.ru);
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
- Пользователь выбирает провайдера (VK или Mail.ru) на странице логина и переходит на `/auth/{provider}/web` (например `/auth/mailru/web`). Либо входит по email+пароль.
- После авторизации провайдер делает redirect на `/auth/{provider}/callback`, сервер устанавливает httpOnly cookie.
- В кабинете v1: метаданные вечеринок и публикация; **управления эфиром (сессией) нет** — только в CherryPlayList.

## Связь с модулями приложения

- **Party workspace** — создание вечеринки и Publish требуют авторизованного организатора; вызовы идут через `partyService` с токеном.
- **Streaming** — подключение к SignalR как организатор и вызов write-методов выполняются с тем же JWT (см. [Streaming](./streaming.md)).

## Проверка сессии (CherryPlayList)

При получении текущего организатора приложение сначала вызывает лёгкий эндпоинт `GET /api/organizer/session/check`; при успехе запрашивает полный профиль через `GET /api/organizer/me`. Так при недоступности сервера в консоль не уходят лишние 404 от тяжёлого эндпоинта.

## Контракты

Детали эндпоинтов логина, обмена токенов и профиля организатора — в [CONTRACTS.md](../../CONTRACTS.md):
- **Auth (логин/логаут):** §3.2 — вход по email+пароль (`POST /auth/login`, `POST /auth/register`), OAuth 2.0 провайдеры VK и Mail.ru для Desktop (`/auth/{provider}/start`, `/auth/exchange`) и Web (`/auth/{provider}/web`, `/auth/{provider}/callback`), logout. OAuth2 для Telegram отложен.
- **Profile:** §3.3 — управление профилем организатора (`GET /api/organizer/session/check`, `GET /api/organizer/me`, `PATCH /api/organizer/profile`). В CherryPlayList перед вызовом `/me` выполняется лёгкая проверка сессии через `session/check`, чтобы при недоступности сервера не засорять консоль.
- **Защита write-методов:** CONTRACTS §2–3 (REST и SignalR требуют JWT).
