# Контракты CherryPlay v1

Документ описывает контракты между частями проекта **в соответствии с архитектурой из [RELEASE_PLAN.md](RELEASE_PLAN.md)**: цели релиза, границы v1 (MVP), подсистемы (Accounts & Auth, Party Management, Streaming, Branding, Ops) и разделение на **Public (viewer)** и **Organizer (authorized)**.

Компоненты: **CherryPlayServer** (backend), **CherryPlayWeb** (зрители), **CherryPlayList** (организатор, desktop).

---

## 1. Роли и границы доступа (по плану §4.1)

| Роль          | Кто                                            | Доступ                                                                                                                                            |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **viewer**    | Зритель в CherryPlayWeb                        | Read-only: публичные API по `shortCode`, подключение к SignalR по `shortCode`, получение обновлений состояния. Не может отправлять write-события. |
| **organizer** | Организатор (CherryPlayList или кабинет в Web) | Write: создание/редактирование/удаление вечеринок, публикация плейлиста, управление сессией и состоянием воспроизведения. Только к своим данным.  |
| **admin**     | Организатор с ролью admin                      | Всё из `organizer` + доступ к `/api/admin/*` (управление выдачами пакетов тем).                                                                   |

В v1 авторизация write-операций: **JWT** для REST и SignalR; в Web сессия через **httpOnly cookie**. Зрители — анонимные, без логина.

### 1.1 Коды ответов по авторизации (REST)

| Код                                  | Значение                              | Когда возвращается                                                                                                               |
| ------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **401 Unauthorized**                 | Не авторизован                        | Нет или невалидный JWT, истёк токен, сессия не найдена, не передан организатор в контексте. Клиенту нужно войти заново.          |
| **403 Forbidden**                    | Доступ запрещён                       | Пользователь авторизован, но не имеет прав на действие (например, попытка изменить чужую вечеринку). Повторный логин не поможет. |
| **403 admin_only**                   | Только для admin                      | Запрос на `/api/admin/*` от не-админа (или без валидной админ-роли в БД).                                                        |
| **403 theme_not_entitled**           | Нет права на тему                     | Создание/обновление вечеринки с темой, которая не входит в доступные пакеты организатора.                                        |
| **403 theme_not_visible**            | Тема скрыта                           | Создание/обновление вечеринки с темой, у которой `isVisible=false` в каталоге тем.                                               |
| **404 package_not_found**            | Пакет не найден                       | `POST /api/admin/organizers/{id}/entitlements`: пакет не существует или `isActive=false`.                                        |
| **404 organizer_not_found**          | Организатор не найден                 | `GET /api/admin/organizers/{id}`, `GET /api/admin/organizers/{id}/entitlements` или `POST /api/admin/organizers/{id}/entitlements` для отсутствующего организатора. |
| **404 entitlement_not_found**        | Выдача не найдена                     | `GET /api/admin/entitlements/{entitlementId}`, `GET /api/admin/entitlement-revocations?entitlementId={id}`, либо legacy `DELETE`/новый `POST` для отсутствующей или чужой выдачи. |
| **404 revocation_not_found**         | Событие отзыва не найдено             | `GET /api/admin/entitlement-revocations/{revocationId}` для отсутствующего события.                                               |
| **409 entitlement_already_active**   | Выдача уже активна                    | Повторный grant активного пакета одному организатору.                                                                            |
| **409 entitlement_already_revoked**  | Выдача уже отозвана                   | Повторный revoke уже отозванной выдачи.                                                                                          |
| **409 invalid_lifecycle_transition** | Недопустимый переход жизненного цикла | Запрос смены `partyLifecycleState` вне разрешённых переходов (например `ready` → `draft`, `draft` → `completed`, `completed` → `draft`). Состояние `completed` **не** терминальное: `completed` → `ready` разрешён. |
| **400 package_is_auto_granted**      | Автовыдаваемый пакет                  | Попытка вручную выдать пакет с `isAutoGranted=true` (например `free`).                                                           |

Эндпоинты организатора при отсутствии/невалидности токена возвращают **401** (в т.ч. при срабатывании `[AuthorizeOrganizer]` до входа в действие); при валидном токене, но отсутствии прав на ресурс — **403**.

---

## 2. Контракты Public (viewer) — по плану §6.1

Зритель работает только по **shortCode**. Без авторизации.

### 2.1 Поведение (реализация v1)

- Получить вечеринку по `shortCode`: метаданные + флаг discoverability `isListedInCatalog`.
- Получить плейлист по `shortCode`.
- Получить список вечеринок **каталога** (только те, что организатор включил в каталог; по умолчанию вечеринка unlisted, но доступна по прямой ссылке).
- Подключиться к SignalR как viewer по `shortCode` и получать обновления состояния, если сессия активна.

### 2.2 REST API (Public)

Базовый URL сервера: по умолчанию `http://localhost:5000` (или из конфигурации).

| Метод | Путь                                       | Описание                                                                                   | Ответ                                                                                                            |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| GET   | `/api/parties/public/{shortCode}`          | Метаданные вечеринки по shortCode (в т.ч. discoverability: каталог vs ссылка)              | `PublicPartyDto` или 404                                                                                         |
| GET   | `/api/parties/public/{shortCode}/playlist` | Плейлист вечеринки                                                                         | `PartyPlaylistDto` или 404                                                                                       |
| GET   | `/api/parties/public/{shortCode}/state`    | Полное состояние вечеринки (плейлист + сессия + playback state)                            | `PartyStateDto` или 404                                                                                          |
| GET   | `/api/parties/public/list`                 | Список вечеринок **каталога** (только `isListedInCatalog=true` и не `draft`; `ready` и `completed` при listed допускаются; сетевой/offline статус не влияет на включение в список) | `PublicPartyListItemDto[]`                                                                                       |
| GET   | `/api/parties/public/first`                | _(опционально)_ Плейлист первой доступной вечеринки (демо)                                 | `PartyPlaylistDto` или 404                                                                                       |
| GET   | `/api/config`                              | Публичная конфигурация для UI (OAuth, страница «Инфо», ссылка на админа). Без авторизации. | 200, JSON: `{ "oauthEnabled": boolean, "partyInfoPageEnabled": boolean, "adminContactUrl": string }` (camelCase) |

Ответ `GET /api/config`: клиент должен ожидать поля **`oauthEnabled`**, **`partyInfoPageEnabled`** и **`adminContactUrl`** (camelCase). При `oauthEnabled: false` веб-приложение скрывает на странице входа вкладку и кнопки OAuth (значение задаётся конфигом `Auth:OAuthEnabled`, см. [CherryPlayServer/OPS.md](CherryPlayServer/OPS.md)). При `partyInfoPageEnabled: false` веб-приложение скрывает страницу «Инфо о вечеринке» и все ссылки на неё в UI; данные вечеринки по-прежнему хранятся на сервере. `adminContactUrl` берётся из `ADMIN_CONTACT_URL` (fallback: `Admin:ContactUrl`, далее `https://vk.com/<owner>`).

**Использует:** CherryPlayWeb (страница просмотра `party/<shortCode>`, каталог, получение состояния для отображения).

### 2.3 SignalR (viewer)

**URL Hub:** `{baseUrl}/partyHub`

**Методы, вызываемые зрителем (invoke):**

| Метод                        | Аргументы           | Возвращает              | Описание                                                                           |
| ---------------------------- | ------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `JoinPartyAsViewer`          | `shortCode: string` | —                       | Подключение к группе вечеринки; сервер может сразу отправить `OnFullStateUpdated`. |
| `RequestFullState`           | `shortCode: string` | `PartyStateDto \| null` | Запрос полного состояния (плейлист + сессия + playback state).                     |
| `JoinPartyAsViewerWithState` | `shortCode: string` | `PartyStateDto \| null` | Подключение к группе + полное состояние в ответе.                                  |

**События от сервера (on)** — зритель подписывается и получает обновления:

| Событие                       | Аргументы                                                   | Описание                                                       |
| ----------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| `OnSessionStarted`            | `partyId: string`                                           | Сессия начата.                                                 |
| `OnSessionEnded`              | `partyId: string`                                           | Сессия завершена.                                              |
| `OnFullStateUpdated`          | `partyId: string`, `state: PlaybackStateDto`                | Обновлено полное состояние воспроизведения.                    |
| `OnPartyDisplayStatusChanged` | `partyId: string`, `partyDisplayStatus: PartyDisplayStatus` | Изменился серверный статус отображения для зрителя.            |
| `OnPlaybackPositionUpdated`   | `partyId: string`, `trackId: string`, `position: number`    | Обновлена позиция текущего трека.                              |
| `OnStateChanged`              | `partyId: string`                                           | Состояние изменилось; клиент может запросить полное состояние. |
| `OnPlaylistChanged`           | `partyId: string`                                           | Плейлист вечеринки изменён.                                    |
| `Error`                       | `message: string`                                           | Ошибка (например, вечеринка не найдена).                       |

Зритель **не вызывает** методы write: `UpdatePlaybackPosition`, `UpdateFullState`, `NotifyStateChanged`, `StartSession`, `EndSession`, `JoinPartyAsOrganizer`.

---

## 3. Контракты Organizer (authorized) — по плану §6.2

Все write-операции — только с валидной авторизацией (JWT). Организатор работает с вечеринками по **partyId** (GUID).

### 3.1 Поведение (реализация v1)

- Логин/логаут: по email+паролю и через OAuth (VK, Mail.ru в v1; **OAuth2 для Telegram откладывается**).
- Управление профилем организатора (имя, логотип, ссылки).
- CRUD вечеринок (создать / редактировать метаданные / удалить).
- Управление discoverability: включение/исключение вечеринки из каталога (`isListedInCatalog`).
- **Publish плейлиста** в режиме редактирования (по кнопке; локальный проект — источник истины).
- **Live write** событий сессии и состояния в режиме сессии (только с авторизацией).

### 3.2 Auth (логин/логаут)

В v1 поддерживаются: **вход по email+паролю** (логин/регистрация), **сброс и смена пароля** (§3.2.0a), и OAuth 2.0 провайдеры **VK**, **Mail.ru**. **OAuth2 для Telegram откладывается** на последующие версии. OAuth использует единый паттерн эндпоинтов с параметром `{provider}` (значения: `vk`, `mailru`). На все auth-эндпоинты действует rate limiting (при превышении — 429). Для Desktop OAuth допускаются только redirect URI: `cherryplaylist://auth` и `http://127.0.0.1`.

#### 3.2.0 Email+пароль (логин и регистрация)

| Метод | Путь             | Описание                                                                                                          | Тело                                                | Ответ                                 |
| ----- | ---------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| POST  | `/auth/login`    | Вход по email и паролю. Web: httpOnly cookie + `{ accessToken }`. Desktop browser SSO (`client=desktop` или заголовок `X-CherryPlay-Client: desktop`): httpOnly cookie + `{ code }` — см. §3.2.0b. | `{ email: string, password: string }`               | `{ accessToken: string }`, `{ code: string }` или 401     |
| POST  | `/auth/register` | Регистрация организатора по email, паролю и имени. Web: cookie + `{ accessToken }`. Desktop browser SSO: cookie + `{ code }` — см. §3.2.0b. | `{ email: string, password: string, name: string }` | `{ accessToken: string }`, `{ code: string }` или 400/409 |

#### 3.2.0a Сброс и смена пароля

Self-service восстановление пароля (forgot → email → Web reset) и смена пароля для авторизованного организатора. Ссылка сброса всегда ведёт на CherryPlayWeb: `{PUBLIC_WEB_BASE_URL}/reset-password?token=…`. Доставка писем — RuSender; см. [ENV.md](ENV.md), [CherryPlayServer/OPS.md](CherryPlayServer/OPS.md). На все auth-эндпоинты действует rate limiting (429).

| Метод | Путь                      | Auth     | Описание                                                                                                                                 | Тело                                               | Ответ |
| ----- | ------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----- |
| POST  | `/auth/forgot-password`   | нет      | Запрос инструкций на email. Не раскрывает, существует ли аккаунт (при успешном пути доставки/Dev-лога).                                  | `{ email: string }`                                | см. ниже |
| POST  | `/auth/reset-password`    | нет      | Установка нового пароля по одноразовому токену из письма. Инвалидирует **все** сессии организатора; удаляет auth cookie (если была).   | `{ token: string, newPassword: string }`           | **204** или 400/429 |
| POST  | `/auth/change-password`   | JWT/cookie | Смена пароля (старый + новый). Инвалидирует **все** сессии организатора (включая текущую); удаляет auth cookie. Клиент должен войти снова. | `{ oldPassword: string, newPassword: string }` | **204** или 400/401/429 |

**`POST /auth/forgot-password` — статусы**

| Условие | Статус | Тело / заметки |
| ------- | ------ | -------------- |
| Некорректный / пустой email | **400** | Сообщение валидации (без раскрытия существования аккаунта) |
| **Production:** до lookup — нет полного конфига почты (`RUSENDER_API_TOKEN`, `RUSENDER_SEND_KEY_ID`, `EMAIL_FROM_ADDRESS`) и/или нет `PUBLIC_WEB_BASE_URL` | **503** | Сервис недоступен для **всех** запросов (одинаково, независимо от email) |
| Email неизвестен **или** известен и письмо отправлено (Prod) / залогировано (Dev без RuSender) | **200** | `{ message: string }` — одно и то же RU-сообщение, напр. «Если аккаунт с таким email существует, мы отправили инструкции» |
| **Production:** аккаунт найден, конфиг есть, но **отправка письма упала** | **200** | То же generic-сообщение; токен **остаётся usable** (не burn / не `UsedAt`) до TTL или повторной выдачи. Hard-log: `Failed to send password reset email; token left usable…`. Anti-enumeration: клиент не отличает «нет аккаунта» / «письмо ушло» / «отправка упала». Ops: валидный unused-токен до TTL допустим; мониторить send failures |
| **Production:** неожиданная ошибка **после** создания токена (внешний catch, не send) | **503** | Токен **не** гасится (остаётся usable до TTL / следующей выдачи). **Остаточный риск anti-enumeration:** существующий email может получить 503, неизвестный на happy-path — **200**. Не путать с missing-config **503** (до lookup, для всех) |
| **Development:** RuSender не настроен — полный reset URL пишется в **лог** сервера; клиенту всё равно **200** + generic message | **200** | Ссылку смотреть только в логе |
| Rate limit | **429** | Общая auth-политика |

Тела ошибок auth на этих эндпоинтах часто — **plain RU-строка** (не JSON `{ code, message }`), напр. `BadRequest("Некорректный email")` / `StatusCode(503, "…")`. Успешный forgot — JSON `{ message }`; успех reset/change — **204** без тела.

**`POST /auth/reset-password` — статусы**

| Условие | Статус |
| ------- | ------ |
| Токен валиден, пароль OK (мин. длина как у register/login) | **204** |
| Токен отсутствует / невалиден / истёк / уже использован | **400** (RU: ссылка недействительна или устарела) |
| Пароль слишком короткий | **400** |
| Rate limit | **429** |

**`POST /auth/change-password` — статусы**

| Условие | Статус |
| ------- | ------ |
| Старый пароль верный, новый OK | **204** |
| Нет авторизации | **401** |
| Неверный текущий пароль | **401** (RU: неверный текущий пароль) |
| Нет email+пароль аккаунта (только OAuth) | **400** (RU: смена пароля только для аккаунта с email и паролем) |
| Новый пароль слишком короткий | **400** |
| Rate limit | **429** |

**Побочные эффекты (reset и change):** обновление BCrypt-хеша в `EmailAccounts`; удаление всех строк `OrganizerSessions` для организатора; погашение неиспользованных `PasswordResetTokens` для аккаунта (при change — все unused; при reset — использованный токен + ранее unused при выдаче нового). TTL токена сброса — ~1 час; в БД хранится только хеш токена (см. [DATABASE.md](CherryPlayServer/DATABASE.md)). Использованные и просроченные строки reset-token дополнительно удаляются фоновым job в срок ≤30 дней (`PasswordResetTokenRecordRetention`; см. [DATABASE.md](CherryPlayServer/DATABASE.md)).

#### 3.2.0b Desktop browser SSO

Единый поток входа и регистрации для **CherryPlayList (desktop)** через **CherryPlayWeb** в системном браузере. JWT **никогда** не передаётся в URL; в deep link попадает только одноразовый код, который Desktop обменивает на JWT. Inline email/password и прямой OAuth из Desktop UI **не используются** (см. §3.2.1 — legacy).

**Режим desktop-клиента** определяется сервером, если выполнено одно из условий:

- query `client=desktop` на `POST /auth/login` или `POST /auth/register`;
- заголовок `X-CherryPlay-Client: desktop` на тех же запросах (используется CherryPlayWeb при вызове API из страницы `/login?client=desktop`);
- OAuth: `client=desktop` в state (CherryPlayWeb передаёт `?client=desktop` и опционально `?return_to=` при старте `/auth/{provider}/web`).

| Метод | Путь                      | Auth | Описание                                                                 | Тело                                      | Ответ                          |
| ----- | ------------------------- | ---- | ------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------ |
| POST  | `/auth/desktop/code`      | cookie организатора (`[AuthorizeOrganizer]`) | Выдача одноразового desktop-кода для **уже активной** Web-сессии (session-continue). Тело не требуется. Семантика кода та же, что при desktop login/register (TTL 3 мин, одноразовый, hash-at-rest). | нет / `{}` | `{ code: string }` или **401** |
| POST  | `/auth/desktop/exchange`  | нет  | Обмен одноразового desktop-кода на JWT. Создаёт сессию как при обычном login. | `{ code: string }`     | `{ accessToken: string }` или 401 |

**Выдача кода (issuance):**

| Событие | Условие | Ответ / redirect |
| ------- | ------- | ---------------- |
| Успешный `POST /auth/login` | desktop-клиент | **200** `{ code: string }` + httpOnly cookie (нужна для `ensureConsents` до deep link) |
| Успешный `POST /auth/register` | desktop-клиент | **200** `{ code: string }` + httpOnly cookie |
| `GET /auth/{provider}/callback` после OAuth | любой client (в т.ч. `desktop` в state) | **Только** validate/consume state → **302** на SPA `/oauth/complete?provider&code` (+ `client=desktop` и allowlist `return_to` из state). **Нет** exchange, cookie, JWT и desktop-кода на callback. Код для List выдаёт Web после `POST /api/oauth/accounts` → `POST /auth/desktop/code` (§3.2.2–§3.2.3). |
| `POST /auth/desktop/code` | валидная cookie-сессия организатора | **200** `{ code: string }` — cookie не меняется; **401** если сессия отсутствует / невалидна |

**`return_to` (куда вернуть одноразовый код):** query на `/login?client=desktop&return_to=…` (Desktop передаёт при открытии браузера) и на `GET /auth/{provider}/web?client=desktop&return_to=…` (сохраняется в OAuth state). После выдачи кода Web/сервер редиректит через `buildAuthReturnUrl` / `BuildAuthReturnUrl` → `{returnTo}?code={rawCode}` (`code` — URL-encoded; `&code=` если в базе уже есть query).

**Allowlist** (сервер `IsAllowedAuthReturnTo`, клиент `isAllowedAuthReturnTo` / `resolveDesktopAuthReturnTo`):

- `cherryplaylist://auth` (и URL с этим префиксом);
- `http://localhost|127.0.0.1:5173|5174/auth/callback`.

Невалидный или отсутствующий `return_to` → fallback на константу `DesktopAuthDeepLinkBase` (`cherryplaylist://auth`).

CherryPlayWeb после email login/register в desktop-режиме: cookie + `{ code }` → `ensureConsents` → redirect через `buildAuthReturnUrl(resolveDesktopAuthReturnTo(return_to), code)`. OAuth: callback → `/oauth/complete` → `POST /api/oauth/accounts` (cookie) → `ensureConsents` → `POST /auth/desktop/code` → return UI / deep link. При уже существующей Web-сессии на `/login?client=desktop` код выдаётся только после клика «Войти» через `POST /auth/desktop/code` — **без** auto-redirect и **без** повторного ввода пароля.

**Prod / packaged return URL:** `cherryplaylist://auth?code={rawCode}` (база — `DesktopAuthDeepLinkBase`).

**Dev return URL:** Desktop открывает login **с** `return_to={origin}/auth/callback` (порты Vite **5173** / **5174**). Маршрут CherryPlayList `/auth/callback?code={rawCode}` (только `import.meta.env.DEV`) пересылает код в Electron через IPC — тот же обмен `POST /auth/desktop/exchange`.

**Семантика кода:** TTL **3 минуты** (`AuthConstants.DesktopAuthCodeTtl`); **одноразовый** (`UsedAt` при exchange); в БД хранится только **SHA-256 хеш** сырого кода (таблица `desktop_auth_codes`, см. [DATABASE.md](CherryPlayServer/DATABASE.md)).

**`POST /auth/desktop/exchange` — статусы**

| Условие | Статус | Тело |
| ------- | ------ | ---- |
| Код валиден, не истёк, не использован | **200** | `{ accessToken: string }` |
| Пустой `code` | **400** | plain: `Code is required` |
| Код отсутствует / невалиден / истёк / уже использован | **401** | plain RU: «Код авторизации недействителен или устарел» |
| Rate limit | **429** | Общая auth-политика |

**Поток (Desktop, happy path):**

1. Пользователь нажимает **«Войти через браузер»** в CherryPlayList → системный браузер открывает `{webBaseUrl}/login?client=desktop&return_to=…` (конфиг Desktop: `webBaseUrl` в `serverConfig.*.json`; dev: `http://localhost:3000`, prod: `https://cherrypashkaparty.ru`; должен совпадать с `PUBLIC_WEB_BASE_URL` на сервере). В **DEV** Desktop всегда передаёт `return_to={origin}/auth/callback`; в prod/packaged — `return_to=cherryplaylist://auth`.
2. На Web (`/login?client=desktop`) CherryPlayWeb проверяет cookie-сессию (`checkAuth`). Ветки:
   - **Сессия есть (session-continue):** панель подтверждения с кнопкой **«Войти»** — **без** формы email/пароль/OAuth и **без** auto-redirect / auto-issue на загрузке. По клику — `POST /auth/desktop/code` (`credentials: 'include'`) → **200** `{ code }` → `buildAuthReturnUrl` по allowlisted `return_to`. При **401** / ошибке выдачи — сообщение об ошибке и fallback на `AuthForm`.
   - **Сессии нет:** обычная `AuthForm` (email+пароль или OAuth VK / Mail.ru); флаги `client=desktop` и `return_to` сохраняются при навигации login ↔ register и при старте OAuth (`/auth/{provider}/web`).
3. После успеха (session-continue, login/register или OAuth через `/oauth/complete`) одноразовый `code` возвращается через `buildAuthReturnUrl` (prod deep link или DEV `/auth/callback`). JWT в URL **не** передаётся.
4. Desktop вызывает `POST /auth/desktop/exchange` с `{ code }`, сохраняет JWT, загружает профиль организатора.

Не-desktop `/login` (без `client=desktop`) не меняется: `AuthForm` → кабинет.

Forgot/change password в Desktop **без изменений** (forgot → email → Web; change — в приложении с JWT).

**Consent UI (Web):** юридические чекбоксы при email register и на OAuth-вкладке / `OAuthCompletePage`; Desktop их не дублирует. **Primary Web email register:** `POST /api/organizers` (+ `consents`) → `POST /auth/login` (cookie) — §3.2.3. **OAuth one-shot:** §3.2.2–§3.2.3. Legacy `POST /auth/register` **без** `consents` — не основной путь Web-формы.

#### 3.2.1 OAuth Login (Desktop) — legacy

**Не используется новым UI CherryPlayList** (с CP-065 — browser SSO, §3.2.0b). Эндпоинты остаются для обратной совместимости.

Универсальный поток логина через провайдера **напрямую из Desktop** (без Web).

| Метод | Путь                     | Описание                                                                                                                                                                                                                                         | Тело                                 | Ответ                             |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | --------------------------------- |
| GET   | `/auth/{provider}/start` | Начало логина через выбранный провайдер. `{provider}` = `vk` или `mailru`. Допустимый redirect задаётся сервером (только `cherryplaylist://auth` или `http://127.0.0.1`). После успешной авторизации провайдер делает redirect обратно с `code`. | —                                    | Redirect на провайдер             |
| POST  | `/auth/exchange`         | Обмен `code` на JWT для **существующего** OAuth subject. **Новый** subject → **400** (`LegalConsentException`): регистрация только через `POST /api/oauth/accounts` (+ consents). | `{ code, provider, … }` | `{ accessToken }` или 400/401 |

**Поток (Desktop, legacy):**

1. Пользователь выбирает провайдера (VK или Mail.ru) в UI приложения.
2. Приложение открывает браузер на `GET /auth/{provider}/start`.
3. Сервер перенаправляет на страницу авторизации провайдера.
4. После авторизации провайдер делает redirect с `code` (и опционально `state`).
5. Приложение вызывает `POST /auth/exchange` с `{ code, provider }`.
6. Сервер обменивает `code` у провайдера: существующий subject → JWT; **новый** subject отклоняется (one-shot API — §3.2.3). То же ограничение для legacy `POST /auth/vkid/exchange`.

#### 3.2.2 OAuth Login (Web)

Для CherryPlayWeb: старт у провайдера → callback **без** сессии → SPA one-shot (`/oauth/complete` + `POST /api/oauth/accounts`).

| Метод | Путь                        | Описание                                                                                                                                                                                                                                                       | Тело           | Ответ                                |
| ----- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------ |
| GET   | `/auth/{provider}/web`      | Начало логина через провайдер. `{provider}` = `vk` или `mailru`. Опционально `?client=desktop` и `?return_to=` — browser SSO для CherryPlayList (`return_to` в state, allowlist §3.2.0b). Redirect на OAuth провайдера с `redirect_uri` на `/auth/{provider}/callback`. | —              | Redirect на провайдер                |
| GET   | `/auth/{provider}/callback` | Callback: validate/consume `state` **только** → **302** на `{PUBLIC_WEB_BASE_URL}/oauth/complete?provider&code` (без базы — относительный `/oauth/complete…`). При desktop state: + `client=desktop` и allowlist `return_to`. **Нет** token exchange, cookie, create organizer. | `code`, `state` (query) | Redirect на SPA `/oauth/complete` |
| POST  | `/auth/logout`              | Выход организатора. Удаляет httpOnly cookie (Web) или инвалидирует токен (Desktop). Требует авторизации.                                                                                                                                                       | —              | 204                                  |

**Поток (Web / Desktop SSO):**

1. Пользователь выбирает провайдера (VK или Mail.ru); UI показывает `LegalConsentBlock` на OAuth-вкладке (pending consents в storage) и открывает `/auth/{provider}/web`.
2. Сервер перенаправляет на авторизацию провайдера.
3. Провайдер → `/auth/{provider}/callback?code=…&state=…` → сервер проверяет state → redirect `/oauth/complete?provider&code` (+ desktop query).
4. `OAuthCompletePage`: `POST /api/oauth/accounts` с `consents` (из pending storage или с формы) → **201** + httpOnly cookie (`accessToken` в теле) → `ensureConsents` → кабинет **или** (desktop) `POST /auth/desktop/code` → deep link. Детали resource API — §3.2.3.

**Поддерживаемые OAuth-провайдеры в v1:**

- `vk` — VK OAuth 2.0
- `mailru` — Mail.ru OAuth 2.0

**Отложено:** OAuth2 для Telegram (планируется в последующих версиях).

#### 3.2.3 Legal consent (resource REST, CP-066)

Строгий resource REST (noun URI): регистрация организатора / OAuth one-shot и append-only журнал согласий. **Нет** публичного каталога `GET /api/legal-documents` — клиент знает `legalDocumentVersionId` + `documentHash` (deploy-time registry `legal-registry.generated.json`) и передаёт их в теле; сервер валидирует active-версию и hash.

**Web email register (primary):** CherryPlayWeb → `POST /api/organizers` (тело с `consents`) → при **201** → `POST /auth/login` (httpOnly cookie / desktop `{ code }`). Legacy `POST /auth/register` (§3.2.0) **без** `consents` — совместимость, не путь Web-формы с чекбоксами.

**OAuth one-shot (gap closed):** `GET /auth/{provider}/callback` не создаёт subject (§3.2.2). Реальный exchange — `POST /api/oauth/accounts`: **новый** subject требует `consents[]` атомарно с созданием organizer + OAuth link + consent events; **существующий** subject → login/session **без** обязательного replay consents. Ответ: `accessToken` + Set-Cookie. Web: `LegalConsentBlock` на OAuth-вкладке + `OAuthCompletePage`. Legacy `POST /auth/exchange` / `vkid/exchange` — только существующий subject (§3.2.1).

**`OAUTH_REDIRECT_BASE_URL`:** один canonical callback для start (`GET /auth/{provider}/web`) и one-shot exchange (`POST /api/oauth/accounts`): `{base}/auth/{provider}/callback` (`provider` всегда lowercase). Если env не задан — fallback `Scheme://Host` текущего запроса. Клиентский `redirectUri` принимается только если **точно** равен canonical; иначе **400**.

**Хранение:**

- Dual UoW: `UseInMemoryStorage=true` → `InMemoryLegalConsentUnitOfWork`; `false` → `EfLegalConsentUnitOfWork`. **`UnsupportedLegalConsentUnitOfWork` удалён.**
- Postgres: таблицы `legal_document_versions`, `consent_events` (миграции, напр. `20260908182106_AddLegalConsentTables`) — [DATABASE.md](CherryPlayServer/DATABASE.md).
- Без Postgres (dev): `docker compose -f docker-compose.inmemory.yml up --build`.

| Метод | Путь | Auth | Описание | Тело | Ответ |
| ----- | ---- | ---- | -------- | ---- | ----- |
| POST | `/api/organizers` | нет | Регистрация по email+паролю с обязательными grants. Идемпотентный replay: тот же email + те же consent `id`/payload → **201** с существующим организатором. | `RegisterOrganizerRequest` | **201** `RegisterOrganizerResponse` + `Location: /api/organizers/{id}` |
| POST | `/api/oauth/accounts` | нет | Реальный OAuth exchange. Новый subject: обязательные grants атомарно. Существующий: обновление `LastUsedAt` / профиля, login без replay consents. | `CreateOAuthAccountRequest` | **201** `CreateOAuthAccountResponse` (`accessToken`) + cookie + `Location: /api/oauth/accounts/{id}` (`id` = **organizerId**) |
| GET | `/api/consent-events` | JWT organizer | Список consent events текущего организатора (append-only). | — | **200** `ConsentEventDto[]` |
| POST | `/api/consent-events` | JWT organizer | Пакетное добавление событий. `ConsentInputDto.id` — **client UUID = idempotency key**: тот же id + тот же payload → тот же результат; конфликт payload → conflict. | `CreateConsentEventsRequest` | **201** `ConsentEventDto[]` + `Location` на первый id (или коллекцию) |
| GET | `/api/organizers/{id}/consent-events` | JWT organizer | То же, что list, но `id` должен совпадать с организатором из токена; иначе **403**. | — | **200** `ConsentEventDto[]` |

**Обязательные документы при register / oauth create (новый subject):** active `pd_consent_text` и `terms` с `decision: "grant"` и верным hash. Типы: `pd_consent_text`, `terms`, `privacy_policy`, `cookie_policy`. Решения: `grant` \| `withdraw` \| `deny`. Статусы версии: `draft` \| `active` \| `retired`.

**Ошибки домена → HTTP (`GlobalExceptionHandler`):** `LegalConsentException` с `LegalConsentFailureKind.Validation` → **400**; `Conflict` → **409**; `ConsentRequired` → **403** (ProblemDetails / JSON gate). Validation: нет/неверные consents (новый OAuth/email), неверный hash/версия, пустой OAuth code, non-canonical `redirectUri`, soft-deleted OAuth organizer, new subject на legacy exchange. Conflict: email занят, OAuth link race, conflict id события. Пустое тело → **400**.

**Write-path consent gate (`ConsentGateMiddleware`):** **всегда включён** (нет `ConsentGateOptions`, не зависит от `UseInMemoryStorage`). После JWT, для организатора с identity на **POST/PUT/PATCH/DELETE**. Без grant на все active required → **403** `{ "code": "consent_required", "message": "Consent required", "missing": ["<versionId>", ...] }`. Exempt (prefix): `/api/consent-events`, `/api/admin`, `/auth/` (и exact `/auth`). GET не гейтится. Seed `legacy@t.ru` без consents — write блокируется до `POST /api/consent-events`. **SignalR / PartyHub** — out of scope MVP; HTTP write-path only.

**Re-consent UI (Web, CP-044):** `ConsentGateProvider` в App shell. Proactive: после auth `GET /api/consent-events` + сравнение с deploy-config `REQUIRED_CONSENT_DOCUMENTS` → блокирующая модалка (`LegalConsentBlock`) → `POST /api/consent-events`. Reactive: `apiFetch` на `403` + `code: "consent_required"` открывает ту же модалку. Cookie-notice скрыт, пока gate open. **Desktop browser SSO:** deep-link в CherryPlayList **только после** `ensureConsents() === 'ok'`; List своей модалки не имеет.

**Seed (active, InMemory + EF HasData / registry):** `documentVersion` label = **`1.0`** (не `v1`). Active hashes (SHA-256 из `legal-registry.generated.json`): `aaaaaaaa-…` (`pd_consent_text`) `1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f`; `bbbbbbbb-…` (`terms`) `c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d`. Retired sample `cccccccc-…` может хранить placeholder hash `pd-consent-hash-v1`. API матчит **id + hash**, не строку label.

DTO — §6.9. Обзор dual storage / UoW: [ARCHITECTURE.md](ARCHITECTURE.md). Интеграционный обзор: [docs/integration/accounts-and-auth.md](docs/integration/accounts-and-auth.md).

### 3.3 Profile (профиль организатора)

Управление профилем организатора (имя, логотип, ссылки). По плану §4.2.

| Метод | Путь                           | Описание                                                                                                                                                                                   | Тело                 | Ответ                      |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | -------------------------- |
| GET   | `/api/organizer/session/check` | Лёгкая проверка валидности сессии (без тела ответа). В CherryPlayList вызывается **до** `/api/organizer/me`, чтобы при недоступности сервера не спамить консоль 404 от тяжёлого эндпоинта. | —                    | 200 (OK) или 401           |
| GET   | `/api/organizer/me`            | Получить профиль текущего организатора.                                                                                                                                                    | —                    | `OrganizerDto` или 401     |
| PATCH | `/api/organizer/profile`       | Обновить профиль организатора (имя, логотип, ссылки).                                                                                                                                      | `UpdateOrganizerDto` | `OrganizerDto` или 401/400 |
| DELETE | `/api/organizer/account`      | Удаление аккаунта текущего организатора (CP-040). В `IAppUnitOfWork`: `IsDeleted`; scrub (`OrganizerAccountScrub`): `name` → «Удалённый пользователь», `logoUrl`/`links`/`timeZone`/`defaultCustomizationSettings`/`defaultPartyThemeId` → `null`, `role` → `organizer`; hard-delete email/OAuth identity и всех сессий. Вечеринки **не** удаляются. Отзыв активных согласий — **best-effort до** App UoW (вне транзакции удаления; при недоступном consent store — skip + log). Уже удалённый / не найденный организатор → **204** (идемпотентно). Cookie сессии **не** сбрасывается этим DELETE — клиент вызывает logout. | — | **204** или 401 |

**OrganizerDto**

| Поле                           | Тип                               | Описание                                                |
| ------------------------------ | --------------------------------- | ------------------------------------------------------- |
| `id`                           | `string`                          | GUID организатора.                                      |
| `name`                         | `string`                          | Название организации / отображаемое имя.                |
| `logoUrl`                      | `string \| null`                  | URL логотипа (опционально).                             |
| `links`                        | `Record<string, string> \| null`  | Ссылки (соцсети, сайт) — JSON-объект.                   |
| `defaultPartyThemeId`          | `string \| null`                  | Тема по умолчанию.                                      |
| `defaultCustomizationSettings` | `Record<string, unknown> \| null` | Настройки оформления по умолчанию (generic JSON).       |
| `timeZone`                     | `string \| null`                  | Часовой пояс организатора.                              |
| `role`                         | `"organizer" \| "admin"`          | Роль организатора (возвращается в `/api/organizer/me`). |
| `createdAt`                    | `string`                          | ISO 8601.                                               |
| `updatedAt`                    | `string \| null`                  | ISO 8601.                                               |

**UpdateOrganizerDto**

| Поле       | Тип                      | Обязательное | Описание                |
| ---------- | ------------------------ | ------------ | ----------------------- |
| `name`     | `string`                 | нет          | Название организации.   |
| `logoUrl`  | `string`                 | нет          | URL логотипа.           |
| `links`    | `Record<string, string>` | нет          | Ссылки (соцсети, сайт). |
| `timeZone` | `string`                 | нет          | Часовой пояс.           |

`defaultPartyThemeId` в MVP не принимается в `UpdateOrganizerDto`: сервер его не ожидает в контракте PATCH и не меняет значение в БД через `/api/organizer/profile`.

### 3.4 REST API (вечеринки)

Все запросы с авторизацией (JWT в заголовке или cookie по плану).

| Метод  | Путь                               | Описание                                                                                                                                      | Тело                          | Ответ                      |
| ------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------- |
| POST   | `/api/parties`                     | Создать вечеринку в `partyLifecycleState: ready` (с проверкой доступа к `partyThemeId`; при отсутствии поля — `PartyThemeDefaults.Id` / `basic`, как клиентский `DEFAULT_PARTY_THEME_ID`) | `CreatePartyDto`              | `PartyDto`                 |
| GET    | `/api/parties`                     | Список вечеринок текущего организатора (включая `draft`, `ready`, `completed`)                                                               | —                             | `PartyDto[]`               |
| GET    | `/api/parties/{partyId}`           | Получить вечеринку (свою)                                                                                                                     | —                             | `PartyDto` или 404         |
| PUT    | `/api/parties/{partyId}`           | Редактировать метаданные вечеринки; проверка доступа к теме выполняется только когда `partyThemeId` передан и отличается от текущего значения | `UpdatePartyDto`              | 204 или 404                |
| DELETE | `/api/parties/{partyId}`           | Удалить вечеринку                                                                                                                             | —                             | 204 или 404                |
| PUT    | `/api/parties/{partyId}/playlist`  | Опубликовать плейлист (Publish в edit mode; перетирает серверную версию)                                                                      | `PartyPlaylistDto`            | 204 или 404                |
| POST   | `/api/parties/{partyId}/lifecycle` | Перевести вечеринку в целевое состояние `partyLifecycleState` (идемпотентно, если уже в целевом состоянии)                                    | `TransitionPartyLifecycleDto` | `PartyDto` или 404/403/409 |

Разрешённые переходы `partyLifecycleState`: `draft` → `ready`; `ready` → `completed` (архив / UI **В архив**); `completed` → `ready` (UI **Вернуть из архива**). Переход `ready` → `draft` **запрещён**. Состояние `completed` **не** терминальное. Запрос с тем же целевым состоянием, что и текущее — идемпотентный no-op (в т.ч. `draft` → `draft`); целевой `draft` из `ready`/`completed` — **не** «return to draft», а **409**. При недопустимом переходе — **409** с телом `{ code: "invalid_lifecycle_transition", message, currentState, requestedState }` (значения состояний — snake_case: `draft`, `ready`, `completed`).

**Использует:** CherryPlayList (создание, список, Publish, привязка partyId к проекту, lifecycle); кабинет организатора в Web (CRUD, toggle каталога, lifecycle — те же продуктовые метки/действия, см. [GLOSSARY.md](GLOSSARY.md#cherryplaylist-lifecycle-ui-labels)).

### 3.5 SignalR (organizer)

**Методы, вызываемые организатором (invoke)** — все с авторизацией (JWT):

На каждом вызове сервер проверяет JWT и наличие живой `OrganizerSession` по идентификатору сессии из JWT, принадлежащей тому же организатору. Проверка действует и для параметра `token` в `JoinPartyAsOrganizer`. После logout или отзыва соответствующей сессии, сброса или смены пароля прежний JWT не разрешает дальнейшие organizer-вызовы, в том числе на уже открытом соединении. При отказе caller получает событие `Error`: `Authentication token is required` для join, `Authentication required` для остальных методов; состояние не изменяется и события успешной операции не рассылаются.

| Метод                    | Аргументы                                                | Описание                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `JoinPartyAsOrganizer`   | `partyId: string`, `token: string`                       | Подключение к группе вечеринки (token — JWT).                                                                                                                                              |
| `StartSession`           | `partyId: string`                                        | Начало сессии; сервер рассылает `OnSessionStarted`. При наличии сохранённого состояния в БД оно восстанавливается (текущий трек, позиция, проигранные/отключённые); иначе создаётся новое. |
| `EndSession`             | `partyId: string`                                        | Окончание сессии; состояние сохраняется с IsActive=false, Status=Ended (freeze); сервер рассылает `OnSessionEnded`. Состояние сессии при отключении организатора сохраняется в БД.         |
| `UpdatePlaybackPosition` | `partyId: string`, `trackId: string`, `position: number` | Обновление позиции воспроизведения.                                                                                                                                                        |
| `UpdateFullState`        | `partyId: string`, `state: PlaybackStateDto`             | Обновление полного состояния воспроизведения.                                                                                                                                              |
| `NotifyStateChanged`     | `partyId: string`                                        | Уведомление об изменении состояния.                                                                                                                                                        |
| `NotifyPlaylistChanged`  | `partyId: string`                                        | Уведомление зрителей об изменении плейлиста (опционально; сервер рассылает `OnPlaylistChanged` и после PUT `.../playlist`). Только организатор, владелец вечеринки.                        |

Обновление плейлиста в session mode может идти через REST PUT `.../playlist` или по контракту «live» (по плану — изменения плейлиста и состояния в session идут live). Сервер при PUT плейлиста рассылает зрителям `OnPlaylistChanged`.

### 3.6 Theme access (organizer)

| Метод | Путь                             | Описание                                                                                               | Ответ            |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- |
| GET   | `/api/organizer/me/theme-access` | Сводка доступа к темам для текущего организатора: доступные темы, публичные locked и ссылка на контакт | `ThemeAccessDto` |

`ThemeAccessDto`:

- `grantedThemeIds: string[]` — темы с доступом (включая auto-granted пакеты).
- `visibleLockedThemes: VisibleLockedThemeDto[]` — публичные темы без доступа, которые нужно показывать с замком.
- `contactUrl: string` — ссылка на администратора (из `ADMIN_CONTACT_URL` / `Admin:ContactUrl`).

`VisibleLockedThemeDto`:

- `themeId: string`
- `packageCode: string`
- `packageName: string`

### 3.7 Admin API

Все эндпоинты ниже защищены `AuthorizeAdmin`, требуют админскую роль и используют rate limit `admin-strict`.

| Метод  | Путь                                                      | Описание                                                 | Ответ                      |
| ------ | --------------------------------------------------------- | -------------------------------------------------------- | -------------------------- |
| GET    | `/api/admin/theme-packages`                               | Список пакетов тем (с `themeIds`)                        | `AdminThemePackageListDto` |
| GET    | `/api/admin/organizers`                                   | Поиск/список организаторов (`query`, `page`, `pageSize`) | `AdminOrganizerListDto`    |
| GET    | `/api/admin/organizers/{id}`                              | Карточка организатора и история выдач                    | `AdminOrganizerDetailDto`  |
| GET    | `/api/admin/organizers/{id}/entitlements?status=active`    | Выдачи организатора; `status` принимает `active` или `all`, по умолчанию `all` | `EntitlementDto[]`       |
| POST   | `/api/admin/organizers/{id}/entitlements`                 | Выдать пакет организатору                                | `EntitlementDto` (201)     |
| GET    | `/api/admin/entitlements/{entitlementId}`                 | Получить выдачу                                          | `EntitlementDto`           |
| GET    | `/api/admin/entitlement-revocations?entitlementId={id}`   | История отзывов                                          | `EntitlementRevocationDto[]` |
| GET    | `/api/admin/entitlement-revocations/{revocationId}`       | Получить событие отзыва                                  | `EntitlementRevocationDto`  |
| POST   | `/api/admin/entitlement-revocations`                      | Создать событие отзыва                                   | `EntitlementRevocationDto` (201) |
| DELETE | `/api/admin/organizers/{id}/entitlements/{entitlementId}` | Совместимость со старым CherryPlayWeb, включая `note` | 204 (legacy) |

Правила:

- `POST grant` возвращает `404 package_not_found`, если пакет отсутствует или неактивен.
- `POST grant` возвращает `400 package_is_auto_granted` для пакетов `isAutoGranted=true`.
- `POST grant` возвращает `409 entitlement_already_active` и `existingEntitlementId`, если активная выдача уже есть.
- `POST grant` возвращает `Location: /api/admin/entitlements/{entitlementId}`.
- `GET /api/admin/organizers/{id}/entitlements` принимает `status=active` или `status=all`; без `status` возвращает все выдачи, неизвестное значение — `400`.
- `POST /api/admin/entitlement-revocations` принимает `{ "id": "<client UUID>", "entitlementId": "<UUID>", "note": "..." }`; запись аудита отзыва одновременно является неизменяемым событием revocation и использует клиентский UUID как `id`.
- Первый успешный POST атомарно заполняет `revokedAt` и добавляет запись аудита; ответ — `201` с `Location: /api/admin/entitlement-revocations/{revocationId}`. Повтор того же запроса с теми же UUID возвращает `200` и существующий ресурс.
- Событие остаётся доступно через GET по `revocationId`, даже если entitlement физически удалён; в этом случае `entitlementId` в DTO равен `null`. Список по entitlement после удаления недоступен, поскольку FK аудита становится `NULL`.
- Повтор с тем же UUID и entitlement возвращает тот же ресурс с `200`; другой UUID для уже отозванной выдачи возвращает `409 entitlement_already_revoked`.
- Повтор UUID, уже занятого другой записью аудита/отзыва, возвращает `409 revocation_id_conflict`; отсутствующая выдача — `404 entitlement_not_found`, пустые UUID — `400`.
- Legacy `DELETE revoke` сохранён для совместимости со старыми клиентами. Он принимает `note`, записывает её в аудит и дописывает к `OrganizerEntitlement.Note` с разделителем `--- revoke: <UTC ISO8601> ---`; это совместимое исключение из append-only контракта. CherryPlayWeb использует ресурс событий POST.

---

## 4. Streaming (Desktop ↔ Server ↔ Web) — по плану §4.3

- **Write** — только от организатора (JWT).
- **Viewer** подключается по `shortCode`, получает плейлист (REST) и/или последнее сохранённое состояние, живые обновления по SignalR при активной сессии.
- Точность позиции: «в целом совпадает», без жёстких требований к секундам.
- **Offline/freeze (по плану §2.1, §4.3):** при потере связи у зрителя (`server_unreachable` / disconnect без organizer-offline freeze) — блок «сейчас играет» скрывается; плейлист и пометки проигранных остаются видимыми. При обрыве **организатора** зритель держит now-playing до 60 с (freeze), затем скрывает; сброс freeze — `OnConnectionStatusChanged(true)` или restore via full state / session start.
- **Завершение сессии (freeze):** при EndSession организатором состояние на сервере сохраняется (IsActive=false, Status=Ended); зрители видят плейлист и пометки, блок «сейчас играет» скрыт (см. [RELEASE_PLAN.md](RELEASE_PLAN.md) §2.1).

Связь локального проекта и серверной вечеринки (§3.3 плана): создать на сервере → сохранить `partyId` в локальном проекте; при Publish в edit режиме локальный проект перетирает серверную версию плейлиста.

---

## 5. Идентичность вечеринки и ссылки — по плану §3.1

- **Публичная ссылка для зрителя:** `party/<shortCode>` (просмотр плейлиста и сессии), `party/<shortCode>/info` (информация о вечеринке: описание, город, место, дата, расписание, ссылки).
- **shortCode:** уникальный, короткий, устойчивый к похожим символам (0/O, 1/l); **неизменяемый** после создания; используется в каталоге и шаринге.
- **partyId:** GUID вечеринки; используется в API и SignalR организатора. В публичных эндпоинтах и для зрителя идентификатор — только `shortCode`.

_Примечание:_ в текущей реализации веб может использовать `?party={shortCode}`; целевой формат по плану — path `party/<shortCode>` и `party/<shortCode>/info`.

---

## 6. Модели данных (DTO) — по плану §3.2 и текущая реализация

Имена полей в JSON — **camelCase**.

### 6.1 Данные на сервере (план §3.2)

- **Вечеринка:** название, описание, организатор, место, город, дата/расписание, тема, флаг «в каталоге», shortCode; для карточки каталога — краткое описание (макс. 200 символов), внешняя ссылка (URL + текст), теги танцев (до 20).
- **Плейлист:** только отображаемые поля (id, name/title, duration, структура групп), **без абсолютных путей** к файлам.
- **Состояние сессии:** минимум для отображения зрителю (played/disabled, «сессия активна/нет», последнее известное состояние).

### 6.2 Плейлист и элементы

**PartyPlaylistDto**

| Поле            | Тип            | Описание                             |
| --------------- | -------------- | ------------------------------------ |
| `items`         | `PlayerItem[]` | Элементы плейлиста (треки и группы). |
| `totalDuration` | `number`       | Общая длительность, сек.             |
| `totalTracks`   | `number`       | Количество треков.                   |

**PlayerItem**

| Поле           | Тип                         | Описание                         |
| -------------- | --------------------------- | -------------------------------- |
| `id`           | `string`                    | Уникальный идентификатор.        |
| `type`         | `"track" \| "group"`        | Тип элемента.                    |
| `name`         | `string`                    | Название.                        |
| `displayOrder` | `number`                    | Порядок отображения.             |
| `level`        | `number`                    | Уровень вложенности.             |
| `duration`     | `number \| null`            | Длительность в сек. (для трека). |
| `items`        | `PlayerItem[] \| undefined` | Вложенные элементы (для группы). |

### 6.3 Состояние воспроизведения

**PlaybackStateDto**

| Поле               | Тип                                          | Описание                              |
| ------------------ | -------------------------------------------- | ------------------------------------- |
| `currentTrackId`   | `string \| null`                             | ID текущего трека.                    |
| `status`           | `"idle" \| "playing" \| "paused" \| "ended"` | Статус плеера на wire (REST/SignalR). |
| `position`         | `number`                                     | Позиция, сек.                         |
| `duration`         | `number`                                     | Длительность текущего трека, сек.     |
| `volume`           | `number`                                     | Громкость (0–1).                      |
| `mode`             | `"preparation" \| "session"`                 | Режим.                                |
| `playedTrackIds`   | `string[]`                                   | ID отыгранных треков.                 |
| `disabledTrackIds` | `string[]`                                   | ID отключённых треков.                |
| `disabledGroupIds` | `string[]`                                   | ID отключённых групп.                 |
| `lastUpdatedAt`    | `string`                                     | ISO 8601.                             |

**Статусы плеера: wire vs локальный store (CherryPlayList).** На wire допустимы только четыре значения выше — они совпадают с enum `PlaybackStatus` на сервере. Встроенный плеер CherryPlayList в store additionally использует переходные статусы `loading`, `buffering`, `error`; перед вызовом `UpdateFullState` клиент **обязан** привести их к wire-контракту: `loading`/`buffering` → `playing`, `error` → `idle`. Промежуточные store-статусы не публикуются отдельно (смена `playing` → `loading` → `playing` не должна слать лишний `UpdateFullState`, если wire-статус не изменился). Маппинг: `CherryPlayList/src/shared/contracts/playbackState.ts` (`mapStoreStatusToWireStatus`, `mapAimpPlaybackStatusToWireStatus`).

### 6.4 Вечеринка (публичная и организаторская)

#### Дата/время и таймзона

- **eventDateTime**: в API и БД строка в формате **ISO 8601 в UTC**. Клиент при отображении переводит в местное время выбранной таймзоны; при сохранении передаёт в API уже сконвертированное в UTC значение. Может отсутствовать (`null`/`undefined`), если время начала ещё не задано.
- **eventEndDateTime**: опциональное время окончания мероприятия в формате **ISO 8601 в UTC**. При отсутствии (`null`/`undefined`) считается, что у вечеринки нет явного конца; клиенты (CherryPlayWeb, CherryPlayList) в этом случае показывают только начало или полностью скрывают строку интервала.
- **timeZone**: строка — идентификатор **IANA** (например `Europe/Moscow`). Используется для интерпретации пользовательского ввода и отображения (местное время этой таймзоны).
- Схема БД расширена nullable‑колонкой `EventEndDateTime` в таблице `Party` (см. [CherryPlayServer/DATABASE.md](CherryPlayServer/DATABASE.md)). Добавление поля выполнено как обратно совместимое: старые записи без конца продолжают корректно сериализоваться с `eventEndDateTime = null`/отсутствующим полем.

**PublicPartyDto** (ответ публичного API; по плану — метаданные + флаг «в каталоге»)

| Поле                                                         | Тип                                    | Описание                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                         | `string`                               | GUID вечеринки.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `name`                                                       | `string`                               | Название.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `title`                                                      | `string \| undefined`                  | Заголовок на экране; если пусто — отображается `name`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `subtitle`                                                   | `string \| undefined`                  | Подзаголовок под заголовком.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `eventDateTime`                                              | `string \| undefined`                  | Время начала мероприятия в UTC, ISO 8601.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `eventEndDateTime`                                           | `string \| undefined`                  | Опциональное время окончания мероприятия в UTC, ISO 8601.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `partyLifecycleState`                                        | `string`                               | Жизненный цикл: `draft`, `ready`, `completed` (см. [DATABASE.md](CherryPlayServer/DATABASE.md)).                                                                                                                                                                                                                                                                                                                                                                         |
| `partyDisplayStatus`                                         | `string`                               | Статус для зрителя (сервер): `draft`, `scheduled`, `starting_soon`, `live`, `organizer_offline`, `party_ended` (см. §6.7).                                                                                                                                                                                                                                                                                                                                               |
| `partyThemeId`                                               | `PartyThemeId`                         | PartyTheme идентификатор (см. GLOSSARY.md).                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `customizationSettings`                                      | `Record<string, unknown> \| undefined` | Оформление (generic JSON). Для `basic` канонический формат: `{ paletteId, customPalette }`, где `customPalette` содержит 5 цветов (`accentPrimary`, `textPrimary`, `backgroundPrimary`, `trackAreaBackground`, `trackBackground`). Палитра по умолчанию: `base`; в UI `custom` показывается вторым пунктом после `base`; при выборе предустановленной палитры её цвета синхронизируются в `customPalette`. Legacy-flat ключи `custom*` поддерживаются для совместимости. |
| `hasActiveSession`                                           | `boolean`                              | Идёт ли сессия.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `sessionStartedAt`                                           | `string \| undefined`                  | ISO 8601 начала сессии.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `timeZone`                                                   | `string \| undefined`                  | IANA (см. [Дата/время и таймзона](#датавремя-и-таймзона)).                                                                                                                                                                                                                                                                                                                                                                                                               |
| `isListedInCatalog`                                          | `boolean`                              | Включена ли вечеринка в каталог. Legacy-поле сохраняется для совместимости и отвечает только за browse-discoverability.                                                                                                                                                                                                                                                                                                                                                |
| _(по плану)_ описание, место, город, дата/расписание, ссылки | —                                      | Для страницы `/info`.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**PublicPartyListItemDto** (элемент каталога — только вечеринки, включённые в каталог)

Ответ GET `/api/parties/public/list`. В карточке каталога (PartyListPage) отображаются **только** 6 полей в порядке: название, краткое описание, город, дата/время, теги танцев, внешняя ссылка. Остальные поля (theme, track count, duration, shortCode, кнопка «Подробнее», бейдж «В эфире») на карточке не показываются.

| Поле                  | Тип                     | Описание                                                                                         |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                  | `string`                | GUID.                                                                                            |
| `name`                | `string`                | Название.                                                                                        |
| `title`               | `string \| undefined`   | Заголовок на экране.                                                                             |
| `subtitle`            | `string \| undefined`   | Подзаголовок.                                                                                    |
| `shortCode`           | `string`                | Короткий код.                                                                                    |
| `partyThemeId`        | `PartyThemeId`          | PartyTheme идентификатор (см. GLOSSARY.md).                                                      |
| `hasActiveSession`    | `boolean`               | Активна ли сессия.                                                                               |
| `isListedInCatalog`   | `boolean`               | Флаг каталога в публичном ответе. Для `GET /api/parties/public/list` фактически всегда `true`, поле возвращается для единообразия discoverability-контракта. |
| `createdAt`           | `string`                | ISO 8601.                                                                                        |
| `totalTracks`         | `number`                | Количество треков.                                                                               |
| `totalDuration`       | `number`                | Длительность, сек.                                                                               |
| `eventDateTime`       | `string \| undefined`   | Время начала мероприятия в UTC, ISO 8601 (см. [Дата/время и таймзона](#датавремя-и-таймзона)).   |
| `eventEndDateTime`    | `string \| undefined`   | Опциональное время окончания мероприятия в UTC, ISO 8601.                                        |
| `partyLifecycleState` | `string`                | Жизненный цикл: `draft`, `ready`, `completed` (см. [DATABASE.md](CherryPlayServer/DATABASE.md)). |
| `timeZone`            | `string \| undefined`   | IANA (см. [Дата/время и таймзона](#датавремя-и-таймзона)).                                       |
| `city`                | `string \| undefined`   | Город.                                                                                           |
| `shortDescription`    | `string \| undefined`   | Краткое описание для карточки (макс. 200 символов).                                              |
| `externalLinkUrl`     | `string \| undefined`   | URL внешней ссылки.                                                                              |
| `externalLinkText`    | `string \| undefined`   | Текст ссылки (подпись).                                                                          |
| `danceTags`           | `string[] \| undefined` | Теги танцев (до 20: предопределённые + свои).                                                    |

**PartyDto** (API организатора)

| Поле                    | Тип                                    | Описание                                                                                                                        |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | `string`                               | GUID.                                                                                                                           |
| `name`                  | `string`                               | Название.                                                                                                                       |
| `title`                 | `string \| undefined`                  | Заголовок на экране; если пусто — отображается `name`.                                                                          |
| `subtitle`              | `string \| undefined`                  | Подзаголовок.                                                                                                                   |
| `shortCode`             | `string`                               | Неизменяемый короткий код.                                                                                                      |
| `partyThemeId`          | `PartyThemeId`                         | PartyTheme идентификатор (см. GLOSSARY.md).                                                                                     |
| `customizationSettings` | `Record<string, unknown> \| undefined` | Оформление темы (generic JSON), семантика как у **PublicPartyDto**; для `basic` — канонический формат как у **CreatePartyDto**. |
| `createdAt`             | `string`                               | ISO 8601.                                                                                                                       |
| `hasActiveSession`      | `boolean`                              | Активна ли сессия.                                                                                                              |
| `eventDateTime`         | `string \| undefined`                  | Время начала мероприятия в UTC, ISO 8601 (см. [Дата/время и таймзона](#датавремя-и-таймзона)).                                  |
| `eventEndDateTime`      | `string \| undefined`                  | Опциональное время окончания мероприятия в UTC, ISO 8601.                                                                       |
| `partyLifecycleState`   | `string`                               | Жизненный цикл: `draft`, `ready`, `completed` (см. [DATABASE.md](CherryPlayServer/DATABASE.md)).                                |
| `timeZone`              | `string \| undefined`                  | IANA (см. [Дата/время и таймзона](#датавремя-и-таймзона)).                                                                      |
| `isListedInCatalog`     | `boolean`                              | Включена ли в каталог. Legacy-поле каталога; не описывает доступ по прямой ссылке.                                             |
| `description`           | `string \| undefined`                  | Описание для страницы `/info`.                                                                                                  |
| `place`                 | `string \| undefined`                  | Место проведения.                                                                                                               |
| `city`                  | `string \| undefined`                  | Город.                                                                                                                          |
| `schedule`              | `string \| undefined`                  | Расписание.                                                                                                                     |
| `shortDescription`      | `string \| undefined`                  | Краткое описание для карточки каталога (макс. 200 символов).                                                                    |
| `externalLinkUrl`       | `string \| undefined`                  | URL внешней ссылки.                                                                                                             |
| `externalLinkText`      | `string \| undefined`                  | Текст ссылки (подпись).                                                                                                         |
| `danceTags`             | `string[] \| undefined`                | Теги танцев (до 20: предопределённые + свои).                                                                                   |

#### Источник правды для темы вечеринки

Для организаторских ответов **PartyDto** актуальные `partyThemeId` и `customizationSettings` соответствуют значениям, сохранённым в БД после последних успешных операций создания/обновления (POST/PUT). Клиенты (в т.ч. CherryPlayList) при синхронизации считают эти поля эталоном для опубликованной вечеринки. Локальные копии в persist и в файле проекта `.cherry` — кэш/черновик и не подменяют сервер после успешного получения данных с API; см. [CherryPlayList: клиентское состояние](CherryPlayList/docs/modules/systems/persisted-client-state.md).

Ответ авторизованного `GET /api/parties/{partyId}` (и списка `GET /api/parties`) должен включать сохранённые настройки темы в `customizationSettings`; иначе клиенты (CherryPlayList) не могут восстановить палитру после перезапуска.

**CreatePartyDto** (тело POST `/api/parties`)

| Поле                    | Тип                       | Обязательное | Описание                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                  | `string`                  | да           | Название (1–200 символов).                                                                                                                                                                                                                                                                                                                                                                                     |
| `title`                 | `string`                  | нет          | Заголовок на экране; если пусто — отображается название.                                                                                                                                                                                                                                                                                                                                                       |
| `subtitle`              | `string`                  | нет          | Подзаголовок.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `partyThemeId`          | `PartyThemeId`            | нет          | По умолчанию `PartyThemeDefaults.Id` (`basic`), согласован с клиентским `DEFAULT_PARTY_THEME_ID`.                                                                                                                                                                                                                                                                                                              |
| `customizationSettings` | `Record<string, unknown>` | нет          | Настройки темы (generic JSON). Для `basic` канонический формат `{ paletteId, customPalette }`, где `customPalette` содержит 5 цветов (`accentPrimary`, `textPrimary`, `backgroundPrimary`, `trackAreaBackground`, `trackBackground`); палитра по умолчанию — `base`; при выборе предустановленной палитры её цвета синхронизируются в `customPalette`; legacy-flat `custom*` поддерживаются для совместимости. |
| `playlistData`          | `PartyPlaylistDto`        | нет          | Начальный плейлист.                                                                                                                                                                                                                                                                                                                                                                                            |
| `eventDateTime`         | `string` (ISO 8601, UTC)  | нет          | Дата/время начала мероприятия в UTC (см. [Дата/время и таймзона](#датавремя-и-таймзона)).                                                                                                                                                                                                                                                                                                                      |
| `eventEndDateTime`      | `string` (ISO 8601, UTC)  | нет          | Опциональное время окончания мероприятия в UTC. Может быть опущено; при отсутствии считается, что конец явно не задан.                                                                                                                                                                                                                                                                                         |
| `timeZone`              | `string` (IANA)           | нет          | Часовой пояс (см. [Дата/время и таймзона](#датавремя-и-таймзона)).                                                                                                                                                                                                                                                                                                                                             |
| `isListedInCatalog`     | `boolean`                 | нет          | Опция «создать открытой в каталоге»: по умолчанию `false` (unlisted / **По ссылке**); `true` — сразу в каталоге (**В каталоге**), при `ready` после create. Управляет только discoverability; не задаёт lifecycle.                                                                                                                                                                                                                                                          |
| `description`           | `string`                  | нет          | Описание вечеринки (для страницы `/info`).                                                                                                                                                                                                                                                                                                                                                                     |
| `place`                 | `string`                  | нет          | Место проведения.                                                                                                                                                                                                                                                                                                                                                                                              |
| `city`                  | `string`                  | нет          | Город.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `schedule`              | `string`                  | нет          | Расписание (текст или структурированный JSON).                                                                                                                                                                                                                                                                                                                                                                 |
| `shortDescription`      | `string`                  | нет          | Краткое описание для карточки каталога (макс. 200 символов).                                                                                                                                                                                                                                                                                                                                                   |
| `externalLinkUrl`       | `string`                  | нет          | URL внешней ссылки.                                                                                                                                                                                                                                                                                                                                                                                            |
| `externalLinkText`      | `string`                  | нет          | Текст ссылки (подпись).                                                                                                                                                                                                                                                                                                                                                                                        |
| `danceTags`             | `string[]`                | нет          | Теги танцев (до 20: предопределённые + свои).                                                                                                                                                                                                                                                                                                                                                                  |

**TransitionPartyLifecycleDto** (тело POST `/api/parties/{partyId}/lifecycle`)

| Поле                  | Тип                   | Обязательное | Описание                                                              |
| --------------------- | --------------------- | ------------ | --------------------------------------------------------------------- |
| `partyLifecycleState` | `PartyLifecycleState` | да           | Целевое состояние: `draft`, `ready`, `completed` (snake_case в JSON). |

Целевой `draft` **не** означает «вернуть в черновик»: переход `ready` → `draft` (и любой другой недопустимый, в т.ч. `completed` → `draft`) → **409** `invalid_lifecycle_transition`. Запрос с `partyLifecycleState: "draft"` валиден только как идемпотентный no-op, когда вечеринка **уже** в `draft` (как и для любого другого целевого состояния при совпадении с текущим — см. §3.4). Разрешённые смены состояния: `draft` → `ready`, `ready` → `completed`, `completed` → `ready`.

**UpdatePartyDto** (тело PUT `/api/parties/{partyId}`)

Все поля опциональны (частичное обновление). Формат и лимиты — как в CreatePartyDto для соответствующих полей.

| Поле                    | Тип            | Описание                                            |
| ----------------------- | -------------- | --------------------------------------------------- |
| `name`                  | `string`       | Название (1–200 символов).                          |
| `title`                 | `string`       | Заголовок на экране.                                |
| `subtitle`              | `string`       | Подзаголовок.                                       |
| `partyThemeId`          | `PartyThemeId` | PartyTheme идентификатор.                           |
| `eventDateTime`         | `string`       | Время начала мероприятия в UTC, ISO 8601.           |
| `eventEndDateTime`      | `string`       | Опциональное время окончания мероприятия в UTC.     |
| `timeZone`              | `string`       | IANA.                                               |
| `customizationSettings` | `object`       | Настройки темы.                                     |
| `isListedInCatalog`     | `boolean`      | Включена ли в каталог.                              |
| `description`           | `string`       | Описание для страницы `/info`.                      |
| `place`                 | `string`       | Место проведения.                                   |
| `city`                  | `string`       | Город.                                              |
| `schedule`              | `string`       | Расписание.                                         |
| `shortDescription`      | `string`       | Краткое описание для карточки (макс. 200 символов). |
| `externalLinkUrl`       | `string`       | URL внешней ссылки.                                 |
| `externalLinkText`      | `string`       | Текст ссылки (подпись).                             |
| `danceTags`             | `string[]`     | Теги танцев (до 20).                                |

Сервер принимает `customizationSettings` как generic JSON-объект (включая вложенные объекты/массивы) и не выполняет строгую валидацию схемы по `partyThemeId`. Нормализация ограничивается приведением входного JSON к сериализуемым JSON-совместимым значениям.

### 6.5 Профиль организатора

**OrganizerDto** (ответ GET `/api/organizer/me`, PATCH `/api/organizer/profile`)

| Поле                           | Тип                               | Описание                                                                         |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------------------------- |
| `id`                           | `string`                          | GUID организатора.                                                               |
| `name`                         | `string`                          | Название организации / отображаемое имя.                                         |
| `logoUrl`                      | `string \| null`                  | URL логотипа (опционально).                                                      |
| `links`                        | `Record<string, string> \| null`  | Ссылки (соцсети, сайт) — JSON-объект.                                            |
| `defaultPartyThemeId`          | `string \| null`                  | PartyTheme по умолчанию организатора. Продуктовый дефолт сервера — `PartyThemeDefaults.Id` (`basic`), согласован с клиентским `DEFAULT_PARTY_THEME_ID`; также cyberpunk, sakura, art-deco, spring-cross-step. |
| `defaultCustomizationSettings` | `Record<string, unknown> \| null` | Настройки оформления по умолчанию (generic JSON).                                |
| `timeZone`                     | `string \| null`                  | Часовой пояс организатора.                                                       |
| `role`                         | `"organizer" \| "admin"`          | Роль организатора.                                                               |
| `createdAt`                    | `string`                          | ISO 8601.                                                                        |
| `updatedAt`                    | `string \| null`                  | ISO 8601.                                                                        |

**UpdateOrganizerDto** (тело PATCH `/api/organizer/profile`)

| Поле       | Тип                      | Обязательное | Описание                |
| ---------- | ------------------------ | ------------ | ----------------------- |
| `name`     | `string`                 | нет          | Название организации.   |
| `logoUrl`  | `string`                 | нет          | URL логотипа.           |
| `links`    | `Record<string, string>` | нет          | Ссылки (соцсети, сайт). |
| `timeZone` | `string`                 | нет          | Часовой пояс.           |

### 6.6 Состояние вечеринки (SignalR)

**PartyStateDto**

| Поле                 | Тип                             | Описание                                                                                                |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `partyId`            | `string`                        | GUID вечеринки.                                                                                         |
| `isSessionActive`    | `boolean`                       | Активна ли сессия.                                                                                      |
| `partyDisplayStatus` | `PartyDisplayStatus`            | Статус для зрителя (сервер вычисляет, см. §6.7).                                                        |
| `playbackState`      | `PlaybackStateDto \| undefined` | Текущее состояние воспроизведения.                                                                      |
| `playlist`           | `PartyPlaylistDto`              | Плейлист.                                                                                               |
| `serverTrackIds`     | `string[]`                      | Список ID треков плейлиста на сервере (только треки, без групп), для индикатора «трека нет на сервере». |

### 6.7 Перечисляемые типы

**PartyThemeId:** `"cyberpunk"` \| `"sakura"` \| `"art-deco"` \| `"basic"` \| `"spring-cross-step"` (PartyTheme идентификатор)  
**PartyLifecycleState:** `"draft"` \| `"ready"` \| `"completed"` — жизненный цикл вечеринки (JSON snake_case). Новая вечеринка создаётся в `ready` (`POST /api/parties`; breaking change относительно прежнего create → `draft`). Значение `draft` остаётся для legacy-вечеринок; перевод в `ready` — через UI **Сделать доступной** / `POST .../lifecycle` (снова доступен из списка организатора). Список организатора `GET /api/parties` **включает** `draft`. Публичный каталог `GET /api/parties/public/list` **не включает** `draft` (нужны `isListedInCatalog=true` и не `draft`; `completed` с флагом каталога **может** попадать в каталог). Переходы — только через `POST /api/parties/{partyId}/lifecycle` (см. §3.4); `completed` **не** терминальное (`completed` → `ready` разрешён).  
**PlaybackStatus:** `"idle"` \| `"playing"` \| `"paused"` \| `"ended"`  
**PlaybackMode:** `"preparation"` \| `"session"`  
**PartyDisplayStatus:** `"draft"` \| `"scheduled"` \| `"starting_soon"` \| `"live"` \| `"organizer_offline"` \| `"party_ended"` — вычисляется на сервере для зрителя. Клиент дополнительно может показывать `connecting`, `server_unreachable` и `program_ended` («Конец программы» — последний трек программы доигран, по snapshot `playbackState` + плейлист; не приходит с API). Приоритет на сервере: `party_ended` (только lifecycle `completed`) → `draft` → `organizer_offline` (сессия активна, организатор отключён ≥ grace) → `live` → `starting_soon` (организатор в Hub, сессия не активна, в т.ч. после `EndSession`) → `scheduled` (сессии нет, организатор не в Hub). При отключении организатора от Hub сессия **не** завершается автоматически (grace ~60 с, см. [docs/integration/streaming.md](docs/integration/streaming.md)).

### 6.8 DTO Theme Monetization

| DTO                         | Поля                                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ThemeAccessDto`            | `grantedThemeIds`, `visibleLockedThemes`, `contactUrl`                                                                                                                                          |
| `VisibleLockedThemeDto`     | `themeId`, `packageCode`, `packageName`                                                                                                                                                         |
| `AdminThemePackageDto`      | `id`, `code`, `name`, `isAutoGranted`, `isActive`, `themeIds`                                                                                                                                   |
| `AdminThemePackageListDto`  | `items: AdminThemePackageDto[]`                                                                                                                                                                 |
| `AdminOrganizerListItemDto` | `id`, `name`, `email`, `oauthProviders`, `role`, `activeEntitlementsCount`, `createdAt`                                                                                                         |
| `AdminOrganizerListDto`     | `items`, `total`, `page`, `pageSize`                                                                                                                                                            |
| `AdminOrganizerDetailDto`   | `id`, `name`, `email`, `oauthAccounts`, `role`, `createdAt`, `entitlements`                                                                                                                     |
| `AdminOauthAccountDto`      | `provider`, `providerUserId`, `providerUserName`                                                                                                                                                |
| `EntitlementDto`            | `id`, `packageId`, `packageCode`, `packageName`, `kind`, `source`, `grantedAt`, `grantedByAdminId`, `grantedByAdminName`, `expiresAt`, `usesRemaining`, `revokedAt`, `revokedByAdminId`, `note` |
| `GrantEntitlementRequest`   | `packageId`, `note?` (`maxLength: 2000`)                                                                                                                                                        |
| `RevokeEntitlementRequest`  | `note?` (`maxLength: 2000`)                                                                                                                                                                     |
| `CreateEntitlementRevocationRequest` | `id`, `entitlementId` (обязательные UUID), `note?` (`maxLength: 2000`)                                                                                                            |
| `EntitlementRevocationDto` | `id`, `entitlementId?`, `adminId`, `note`, `createdAt`; `entitlementId` может быть `null` после hard-delete выдачи                                                                                |

Дополнительно по `EntitlementDto`:

- `grantedByAdminId`/`grantedByAdminName` и `revokedByAdminId` восстанавливаются по последним audit-записям `grant_package`/`revoke_package` для entitlement.
- Поля админа могут быть `null` для legacy-записей (например, если исторический аудит отсутствует).

### 6.9 DTO Legal consent (CP-066)

| DTO / enum | Поля / значения |
| ---------- | --------------- |
| `ConsentInputDto` | `id` (client UUID), `legalDocumentVersionId`, `documentHash`, `decision` |
| `ConsentEventDto` | `id`, `legalDocumentVersionId`, `documentHash`, `decision`, `eventAt` |
| `CreateConsentEventsRequest` | `events: ConsentInputDto[]` |
| `RegisterOrganizerRequest` | `email`, `password`, `name`, `consents: ConsentInputDto[]` |
| `RegisterOrganizerResponse` | `id`, `email`, `name` |
| `CreateOAuthAccountRequest` | `provider` (`OAuthProvider`), `code`, `consents: ConsentInputDto[]`, опц. `redirectUri` (только = canonical `{OAUTH_REDIRECT_BASE_URL\|Scheme://Host}/auth/{provider}/callback`), опц. `deviceId` |
| `CreateOAuthAccountResponse` | `id` (organizerId), `email`, `providerSubject`, `accessToken` |
| `ConsentDecision` | `"grant"` \| `"withdraw"` \| `"deny"` |
| `LegalDocumentType` | `"pd_consent_text"` \| `"terms"` \| `"privacy_policy"` \| `"cookie_policy"` |
| `LegalDocumentVersionStatus` | `"draft"` \| `"active"` \| `"retired"` |

Эндпоинты — §3.2.3. JSON enum — string (camel/`snake` как в таблице).

---

## 7. Branding (Organizer + Party) — по плану §4.4

Модель двухуровневая: дефолт на уровне organizer, override на уровне party (опционально). В v1 в вебе: логотип + имя организатора + базовые поля info. Доступ к PartyTheme работает через monetization-модель (пакеты, entitlement, `isAutoGranted`, `visibility=private/public`) по [FEATURE_THEME_MONETIZATION.md](FEATURE_THEME_MONETIZATION.md) и разделам §3.6–§3.7 этого документа. Контракты профиля организатора и полей вечеринки для info уточняются в Epic C/D.

---

## 8. Ops — по плану §4.5, §2.1

- **Health endpoint:** GET `/api/health` — проверка доступности сервиса.
- **Логи:** auth, create/update party, start/end session, подключение к Hub.
- **Rate limiting:** на публичные ручки и Hub; лимиты по вечеринкам (антиспам каталога).
- **Бэкап БД:** Postgres self-hosted на VM Cloud.ru (не DBaaS); регулярные бэкапы пока не ведутся; обязательные pre-deploy dumps (`scripts/deploy.sh`), retention по числу файлов (последние 10). При введении регулярных бэкапов — retention ≤30 дней; после restore — повторно применить удаление/очистку. Инструкция: [BACKUP_RESTORE.md](BACKUP_RESTORE.md), [CherryPlayServer/OPS.md](CherryPlayServer/OPS.md).

Эндпоинты и формат логов задаются при реализации Epic G.

---

## 9. Соответствие компонентов архитектуре

| Компонент            | Роль                                  | REST                                      | SignalR                                                          | Примечание                                                                                                                                                                   |
| -------------------- | ------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CherryPlayServer** | —                                     | Реализует Public и Organizer API, Hub     | Рассылает события viewer/organizer                               | JWT для write; discoverability через `isListedInCatalog`                                                                                                                     |
| **CherryPlayWeb**    | viewer (+ кабинет organizer по плану) | GET public: party, playlist, list         | JoinPartyAsViewer, RequestFullState; on: все события             | Страницы `party/<shortCode>`, `party/<shortCode>/info`; freeze при потере связи                                                                                              |
| **CherryPlayList**   | organizer                             | POST/GET/PUT/DELETE parties, PUT playlist | JoinPartyAsOrganizer, StartSession, EndSession, Update*, Notify* | partyId в проекте; Publish в edit; live в session; дата/время вечеринки — те же правила, что в Web (утилиты @cherryplay/components, порядок полей, дата в модалке привязки). |

---

## 10. Версионирование и обратная совместимость

- Изменения имён методов Hub, событий и полей DTO считаются ломающими.
- Новые необязательные поля и новые события Hub — обратно совместимы.
- Формат shortCode и маршруты `party/<shortCode>`, `party/<shortCode>/info` по плану — «дорогие изменения»; при смене нужна явная стратегия миграции.

---

_Контракты приведены в соответствие с [RELEASE_PLAN.md](RELEASE_PLAN.md). При изменении плана или реализации обновляйте этот файл._

---

## Связанные документы

- [RELEASE_PLAN.md](RELEASE_PLAN.md) — план релиза v1, архитектура подсистем.
- [GLOSSARY.md](GLOSSARY.md) — глоссарий терминов (shortCode, partyId, organizer, viewer и др.).
- [CherryPlayServer/API.md](CherryPlayServer/API.md) — указатель на разделы этого документа (для разработки сервера).
- [CherryPlayServer/DATABASE.md](CherryPlayServer/DATABASE.md) — схема БД. **При добавлении миграций или новых колонок** описание таблиц в DATABASE.md должно быть обновлено.
- [docs/integration/README.md](docs/integration/README.md) — подсистемы интеграции приложение–сервер–веб.
