# Accounts & Auth

Подсистема учётных записей и авторизации для разграничения доступа между организатором (write) и зрителем (read-only). Соответствует [RELEASE_PLAN.md](../../RELEASE_PLAN.md) §4.1 и §6.

## Обзор

- **Организатор** — владелец данных; все write-операции (CRUD вечеринок, публикация плейлиста, управление сессией) требуют авторизации.
- **Зритель** — анонимный доступ по shortCode к публичным API и SignalR; write-методы не вызываются.
- В v1 доступны: вход по **email+пароль** (логин/регистрация) и OAuth 2.0 провайдеры **VK**, **Mail.ru**. **OAuth2 для Telegram откладывается** на последующие версии.
- **Сброс и смена пароля (shipped):** `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` + RuSender; UI в CherryPlayWeb, CherryPlayList и shared-формах CherryPlayComponents. Email-верификация при регистрации по-прежнему вне scope.

## Роли

| Роль | Кто | REST | SignalR |
|------|-----|------|---------|
| **organizer** | CherryPlayList (desktop), кабинет в CherryPlayWeb | Bearer JWT для POST/PUT/DELETE и GET своих вечеринок | JWT при подключении к Hub; вызов StartSession, EndSession, UpdatePlaybackPosition, UpdateFullState, NotifyStateChanged, JoinPartyAsOrganizer |
| **admin** | Организатор с повышенной ролью | Всё из `organizer` + доступ к `/api/admin/*` (поиск организаторов, grant/revoke пакетов) | Нет отдельных admin-методов в Hub |
| **viewer** | CherryPlayWeb (страница party/<shortCode>) | Без авторизации: GET по shortCode (метаданные, плейлист, каталог) | Подключение по shortCode: JoinPartyAsViewer, RequestFullState; только приём событий от сервера |

## JWT

- **Access token** используется для API и SignalR.
- В токен добавляется claim `role` (`organizer` или `admin`); если claim отсутствует в старом токене, сервер трактует как `organizer`.
- В **Web** (кабинет организатора): хранение в **httpOnly cookie** (без доступа JS к токенам).
- В **CherryPlayList**: передача в заголовке Authorization (Bearer) и при вызове `JoinPartyAsOrganizer(partyId, token)`; хранение — предпочтительно защищённое хранилище ОС (например, Windows Credentials).
- В v1 допускается простая политика TTL (достаточный срок на мероприятие или ручной повторный вход). **Refresh-токены** отложены; при истечении токена или после сброса/смены пароля требуется повторный вход.
- При OAuth для Desktop допускаются только проверенные redirect URI: `cherryplaylist://auth` и `http://127.0.0.1` (для разработки).

## Сброс и смена пароля

### Forgot → email → Web reset

1. Клиент (Web или List) вызывает `POST /auth/forgot-password` с `{ email }` (без авторизации).
2. При успехе клиент всегда показывает одно и то же RU-сообщение («если аккаунт существует — инструкции отправлены»), **не** различая «нет аккаунта» и «письмо ушло».
3. Если у email есть `EmailAccount`, сервер создаёт одноразовый токен (в БД — только хеш, TTL ~1 ч) и отправляет письмо со ссылкой на CherryPlayWeb: `{PUBLIC_WEB_BASE_URL}/reset-password?token=…`.
4. Пользователь открывает ссылку **только в Web** (даже если запрос забыли пароль из List). List **не** потребляет токен.
5. Web вызывает `POST /auth/reset-password` с `{ token, newPassword }` → **204**; сервер обновляет хеш и **удаляет все** `OrganizerSessions` организатора.

### Смена пароля (авторизованный)

- `POST /auth/change-password` с `{ oldPassword, newPassword }` (JWT/cookie).
- Успех → **204**; все сессии инвалидируются (включая текущую) → клиент должен предложить повторный вход.
- Аккаунт только через OAuth (без `EmailAccount`) → **400** с ясным RU-сообщением.
- Смена пароля **не** идёт через email-ссылку; email только для forgot/reset.
- **Web UI:** форма в кабинете, аккордеон «Аккаунт» (свёрнут по умолчанию). После успеха клиент сразу разлогинивает и открывает `/login` с `state.passwordChanged` — notice о смене пароля. Структура страницы: [CherryPlayWeb/docs/pages.md](../../CherryPlayWeb/docs/pages.md) (CabinetPage).

### Политика почты (RuSender) и anti-enumeration

| Среда / условие | Поведение `forgot-password` |
| --------------- | --------------------------- |
| **Dev**, RuSender не настроен | Письмо не уходит наружу: reset URL / текст письма пишется в **лог** сервера; клиенту **200** + generic message |
| **Prod**, до lookup нет полного конфига RuSender/`EMAIL_FROM_ADDRESS` и/или нет `PUBLIC_WEB_BASE_URL` | **503** для **всех** запросов (fail-closed по конфигу) |
| **Prod**, конфиг есть, но отправка письма упала | **200** + generic message; токен **остаётся usable** (не burn) до TTL / повторной выдачи — retry/resend сможет доставить письмо, когда почта заработает. Hard-log send failure. Tradeoff: не отдавать 503 только для существующих email (иначе enumeration) |
| **Prod**, неожиданная ошибка после создания токена (не catch отправки) | **503**; токен **не** гасится. **Остаточный риск:** существующий email может получить 503 при редком сбое после create; неизвестный email на happy-path — **200**. См. [CONTRACTS.md](../../CONTRACTS.md) §3.2.0a |
| Успешная отправка / неизвестный email | **200** + одно и то же generic message |

Секреты и доменная верификация (SPF/DKIM для `cherrypashkaparty.ru` в RuSender): [ENV.md](../../ENV.md), [OPS.md](../../CherryPlayServer/OPS.md). Таблица токенов: [DATABASE.md](../../CherryPlayServer/DATABASE.md) — `PasswordResetTokens`.

## Реализация (v1)

- **JWT**: секретный ключ задаётся переменной окружения/конфигом `JWT_SECRET_KEY` (обязательно, не менее 32 символов; в production дефолтный ключ запрещён).
- **Rate limiting**: на все эндпоинты auth действует лимит (например, 10 запросов в минуту); при превышении — 429.
- **Валидация redirect URI**: для Desktop OAuth принимаются только `cherryplaylist://auth` и `http://127.0.0.1`; произвольный redirect из запроса отклоняется.
- **Пароли**: хеширование BCrypt с уникальной солью на каждый пароль; минимальная длина пароля и лимиты имени организатора заданы константами (сервер и клиенты согласованы).
- **Ошибки входа и forgot-password**: единые сообщения без раскрытия «существует ли email» (на успешном пути forgot и при soft-fail отправки в Prod).
- **Сессии после reset/change**: удаляются все строки сессий организатора; JWT без живой сессии не проходит авторизацию.
- **Проверка admin-доступа**: для `/api/admin/*` сервер дополнительно проверяет роль организатора по БД (не только по JWT claim).

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
4. **Истечение / инвалидация**: простая стратегия v1 (ручной ре-логин); после сброса или смены пароля все сессии мертвы → 401 и повторный вход.
5. **Forgot password (List, live):** на экране Account — запрос `POST /auth/forgot-password` и generic RU-успех («проверьте почту»); ссылка из письма открывается в системном браузере на Web. Токен в List не обрабатывается.
6. **Change password (List, live):** на экране Account — `POST /auth/change-password` (старый + новый); после успеха — выход / повторный вход.

## Логин в CherryPlayWeb (organizer)

По плану §4.1.2:

- Кабинет организатора использует **httpOnly cookie**.
- Пользователь выбирает провайдера (VK или Mail.ru) на странице логина и переходит на `/auth/{provider}/web` (например `/auth/mailru/web`). Либо входит по email+пароль.
- После авторизации провайдер делает redirect на `/auth/{provider}/callback`, сервер устанавливает httpOnly cookie.
- В кабинете v1: метаданные вечеринок и публикация; **управления эфиром (сессией) нет** — только в CherryPlayList.
- **Восстановление пароля (Web, live):** маршруты `/forgot-password` (запрос письма) и `/reset-password?token=` (новый пароль → редирект на `/login`). Ссылка «Забыли пароль?» с экрана логина.
- **Смена пароля (Web, live):** в кабинете, аккордеон «Аккаунт» (свёрнут по умолчанию) — `POST /auth/change-password`; после успеха — немедленный logout и `/login` с notice (`state.passwordChanged`). UI кабинета: [pages.md](../../CherryPlayWeb/docs/pages.md).

## Связь с модулями приложения

- **Party workspace** — создание вечеринки и Publish требуют авторизованного организатора; вызовы идут через `partyService` с токеном.
- **Streaming** — подключение к SignalR как организатор и вызов write-методов выполняются с тем же JWT (см. [Streaming](./streaming.md)).

## Проверка сессии (CherryPlayList)

При получении текущего организатора приложение сначала вызывает лёгкий эндпоинт `GET /api/organizer/session/check`; при успехе запрашивает полный профиль через `GET /api/organizer/me`. Так при недоступности сервера в консоль не уходят лишние 404 от тяжёлого эндпоинта.

## Контракты

Детали эндпоинтов логина, обмена токенов и профиля организатора — в [CONTRACTS.md](../../CONTRACTS.md):
- **Auth (логин/логаут/пароль):** §3.2 — вход по email+пароль (`POST /auth/login`, `POST /auth/register`), сброс/смена пароля (`POST /auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`), OAuth 2.0 провайдеры VK и Mail.ru для Desktop (`/auth/{provider}/start`, `/auth/exchange`) и Web (`/auth/{provider}/web`, `/auth/{provider}/callback`), logout. OAuth2 для Telegram отложен.
- **Profile:** §3.3 — управление профилем организатора (`GET /api/organizer/session/check`, `GET /api/organizer/me`, `PATCH /api/organizer/profile`). В CherryPlayList перед вызовом `/me` выполняется лёгкая проверка сессии через `session/check`, чтобы при недоступности сервера не засорять консоль.
- **Защита write-методов:** CONTRACTS §2–3 (REST и SignalR требуют JWT).
