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

С **CP-065** вход и регистрация идут через **browser SSO** на CherryPlayWeb; inline email/password и прямой OAuth из приложения **убраны**. Сброс и смена пароля — без изменений (см. ниже).

### Browser SSO (email, OAuth, регистрация)

1. **UI (Desktop):** экран «Аккаунт» — кнопка **«Войти через браузер»** (тот же CTA в блокировке Party workspace без сессии). Inline `AuthForm` не показывается. На Web session-continue CTA — **«Войти»** (не путать с Desktop).
2. **Открытие Web:** `startBrowserLogin()` открывает в системном браузере `{webBaseUrl}/login?client=desktop&return_to=…`.
   - `webBaseUrl` — из `serverConfig.development.json` / `serverConfig.production.json` (dev: `http://localhost:3000`, prod: `https://cherrypashkaparty.ru`).
   - Должен совпадать с **`PUBLIC_WEB_BASE_URL`** на сервере ([ENV.md](../../ENV.md)).
   - **`return_to`:** в **DEV** — `{origin}/auth/callback` (Vite `5173`/`5174`); в prod/packaged — `cherryplaylist://auth`. Allowlist и fallback на `DesktopAuthDeepLinkBase` — [CONTRACTS.md](../../CONTRACTS.md) §3.2.0b.
3. **На Web (`/login?client=desktop`):** проверка cookie-сессии. Ветки:
   - **Уже вошёл (session-continue):** панель с кнопкой **«Войти»** — без формы пароля/OAuth и **без** auto-redirect на загрузке. Клик → `POST /auth/desktop/code` (cookie) → `{ code }` → `buildAuthReturnUrl(resolveDesktopAuthReturnTo(return_to), code)`. При **401** / ошибке выдачи — сообщение и fallback на `AuthForm`.
   - **Нет сессии:** логин или регистрация (email+пароль или OAuth VK/Mail.ru). Флаги `client=desktop` и `return_to` сохраняются при переходе login ↔ register и при старте OAuth; API login/register отправляет заголовок `X-CherryPlay-Client: desktop`.
4. **После успеха:** Web (email/session-continue) или сервер (OAuth) возвращает одноразовый код (не JWT):
   - **Email / session-continue:** Web return UI → `buildAuthReturnUrl(resolveDesktopAuthReturnTo(return_to), code)`.
   - **OAuth:** сервер при `PUBLIC_WEB_BASE_URL` — **302** на `/login?client=desktop&code=…` (+ allowlist `return_to`); без базы — HTML return-page. Не 302 напрямую на `cherryplaylist://`.
   - **Prod / packaged app open:** `cherryplaylist://auth?code={rawCode}`;
   - **Dev:** `http://localhost:5173|5174/auth/callback?code={rawCode}` → IPC в Electron → тот же `POST /auth/desktop/exchange`.
5. **Desktop:** `POST /auth/desktop/exchange` с `{ code }` → `{ accessToken }`; сохранение JWT, загрузка организатора, auto-login.
6. **Ошибки:** истёкший или повторно использованный код → **401** («Код авторизации недействителен или устарел»); TTL кода — **3 минуты**; в URL JWT не передаётся.

```text
CherryPlayList «Войти через браузер»
  → /login?client=desktop&return_to=…  (DEV: …/auth/callback)
       │
       ├─ Web session OK → «Войти» → POST /auth/desktop/code → { code }
       │                    (401 / error → AuthForm)
       └─ no session → login/register/OAuth → server issues { code }
→ buildAuthReturnUrl(return_to, code)
→ POST /auth/desktop/exchange → JWT → auto-login
```

Контракт API (включая `POST /auth/desktop/code`, `return_to` / allowlist) и return URL: [CONTRACTS.md](../../CONTRACTS.md) §3.2.0b. Таблица кодов: [DATABASE.md](../../CherryPlayServer/DATABASE.md) — `DesktopAuthCodes` (новых таблиц для session-continue нет).

**Legacy:** прямой OAuth из Desktop (`GET /auth/{provider}/start`, `POST /auth/exchange`) описан в CONTRACTS §3.2.1; новый UI его не вызывает.

**CP-038:** согласие при регистрации — только на Web-форме; Desktop не дублирует чекбоксы.

### Прочее (без изменений)

- **Использование токена:** REST — Bearer JWT; SignalR — JWT при `JoinPartyAsOrganizer`.
- **Истечение / инвалидация:** ручной ре-логин; после сброса или смены пароля все сессии мертвы → 401.
- **Forgot password:** `POST /auth/forgot-password` на экране Account; ссылка из письма открывается в браузере на Web.
- **Change password:** `POST /auth/change-password` (старый + новый); после успеха — выход / повторный вход.

## Логин в CherryPlayWeb (organizer)

По плану §4.1.2:

- Кабинет организатора использует **httpOnly cookie**.
- Пользователь выбирает провайдера (VK или Mail.ru) на странице логина и переходит на `/auth/{provider}/web` (например `/auth/mailru/web`). Либо входит по email+пароль.
- После авторизации провайдер делает redirect на `/auth/{provider}/callback`, сервер устанавливает httpOnly cookie.
- В кабинете v1: метаданные вечеринок и публикация; **управления эфиром (сессией) нет** — только в CherryPlayList.
- **Восстановление пароля (Web, live):** маршруты `/forgot-password` (запрос письма) и `/reset-password?token=` (новый пароль → редирект на `/login`). Ссылка «Забыли пароль?» с экрана логина.
- **Смена пароля (Web, live):** в кабинете, аккордеон «Аккаунт» (свёрнут по умолчанию) — `POST /auth/change-password`; после успеха — немедленный logout и `/login` с notice (`state.passwordChanged`). UI кабинета: [pages.md](../../CherryPlayWeb/docs/pages.md).

### Регистрация email + legal consent (Web)

1. **UI:** `/register` — `EmailAuthForm` с чекбоксами обязательных согласий (`pd_consent_text`, `terms`). Deploy-time `versionId` + `contentHash` в `@cherryplay/components` (`legalDocuments.ts`); **нет** `GET` каталога документов.
2. **API sequence:** `POST /api/organizers` (email, password, name, `consents`) → при успехе `POST /auth/login` (cookie). Legacy `POST /auth/register` без consents не используется Web-формой.
3. **Хранение:** consent-мутации требуют `UseInMemoryStorage=true` (`InMemoryLegalConsentUnitOfWork`). При EF — `UnsupportedLegalConsentUnitOfWork` (мутации недоступны; таблиц consent в Postgres нет).
4. **OAuth gap:** live `/auth/{provider}/web` → callback **не** пишет consent events; consent-aware stub — `POST /api/oauth/accounts` (UI не подключён).
5. **Re-consent (CP-044):** после входа Web сравнивает `GET /api/consent-events` с deploy-config; при missing — блокирующая модалка → `POST /api/consent-events`. Write без grants → `403 consent_required` (+ `missing[]`); клиент открывает ту же модалку. **Desktop SSO:** deep-link только после успешного grant на Web (`ensureConsents`); List UI gate не дублирует.
6. Контракт, gate и HTTP 400/403/409: [CONTRACTS.md](../../CONTRACTS.md) §3.2.3. Страницы / ConsentGate: [pages.md](../../CherryPlayWeb/docs/pages.md).

## Связь с модулями приложения

- **Party workspace** — создание вечеринки и Publish требуют авторизованного организатора; вызовы идут через `partyService` с токеном.
- **Streaming** — подключение к SignalR как организатор и вызов write-методов выполняются с тем же JWT (см. [Streaming](./streaming.md)).

## Проверка сессии (CherryPlayList)

При получении текущего организатора приложение сначала вызывает лёгкий эндпоинт `GET /api/organizer/session/check`; при успехе запрашивает полный профиль через `GET /api/organizer/me`. Так при недоступности сервера в консоль не уходят лишние 404 от тяжёлого эндпоинта.

## Контракты

Детали эндпоинтов логина, обмена токенов и профиля организатора — в [CONTRACTS.md](../../CONTRACTS.md):
- **Auth (логин/логаут/пароль):** §3.2 — вход по email+пароль (`POST /auth/login`; legacy `POST /auth/register`), **Web primary register + consent** (`POST /api/organizers` → `POST /auth/login`, §3.2.3), **Desktop browser SSO** (`POST /auth/desktop/code` для session-continue, `POST /auth/desktop/exchange`, query `return_to` / `buildAuthReturnUrl`, §3.2.0b), сброс/смена пароля (`POST /auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`), OAuth 2.0 VK и Mail.ru для Web (`/auth/{provider}/web`, `/auth/{provider}/callback` с `client=desktop` и `return_to` для Desktop; live OAuth без consent events — gap), legacy Desktop OAuth (`/auth/{provider}/start`, `/auth/exchange`, §3.2.1), logout. OAuth2 для Telegram отложен.
- **Legal consent:** §3.2.3 — resource REST, InMemory-only мутации, write-path gate `403 consent_required`, Web re-consent modal, `LegalConsentException` → 400/409/403.
- **Profile:** §3.3 — управление профилем организатора (`GET /api/organizer/session/check`, `GET /api/organizer/me`, `PATCH /api/organizer/profile`). В CherryPlayList перед вызовом `/me` выполняется лёгкая проверка сессии через `session/check`, чтобы при недоступности сервера не засорять консоль.
- **Защита write-методов:** CONTRACTS §2–3 (REST и SignalR требуют JWT).
