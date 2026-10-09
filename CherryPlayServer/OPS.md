# Операционная документация CherryPlayServer

Требования к эксплуатации по [RELEASE_PLAN.md](../RELEASE_PLAN.md) §4.5 и §2.1: один сервер/инстанс (монолит), наблюдаемость, устойчивость.

---

## Liveness и readiness

- **Liveness:** `GET /api/health/live` проверяет, что процесс отвечает; БД не опрашивает. Возвращает HTTP 200 и JSON `{"status":"Healthy","timestamp":"..."}` с UTC timestamp. Старый `GET /api/health` сохранён как alias liveness.
- **Readiness:** `GET /api/health/ready` проверяет подключение к PostgreSQL (`Database.CanConnectAsync`) с timeout 3 секунды. Healthy: HTTP 200 и `{"status":"Healthy"}`; unhealthy или timeout: HTTP 503 и `{"status":"Unhealthy"}`.
- **Docker:** healthcheck сервиса `server` в [docker-compose.yml](../docker-compose.yml) и [docker-compose.prod.yml](../docker-compose.prod.yml) вызывает `/api/health/ready` внутри контейнера. [deploy.sh](../scripts/deploy.sh) также проверяет readiness на сервере.
- **Ручная проверка:** выполните `curl -i http://localhost:5000/api/health/live` и `curl -i http://localhost:5000/api/health/ready` на сервере. Для readiness успешный ответ должен содержать HTTP 200 и `{"status":"Healthy"}`. Неуспешный ответ — HTTP 503 и `{"status":"Unhealthy"}`. Проверку недоступной БД проводите в контролируемом тестовом окружении; production smoke этого сценария не заменяет.

---

## Завершение сессии (freeze)

При завершении сессии организатором (EndSession) состояние **не удаляется**: сохраняется с `IsActive=false`, `Status=Ended`. Зрители видят плейлист и пометки проигранных; блок «сейчас играет» скрыт. Подробнее: [RELEASE_PLAN.md](../RELEASE_PLAN.md) §2.1, [CONTRACTS.md](../CONTRACTS.md) §4.

---

## Временное отключение OAuth на фронте

Пока OAuth не починен, можно скрыть на странице входа кнопки и вкладку OAuth (только UI; эндпоинты `/auth/{provider}/start` и callback по-прежнему отвечают).

- **Конфиг:** `Auth:OAuthEnabled = false`.
- **appsettings.json** (или окружение): `"Auth": { "OAuthEnabled": false }`.
- **Переменная окружения:** `Auth__OAuthEnabled=false`.
- **Значение:** `true` или `false` (в JSON и env — строка или булево; .NET принимает оба варианта).

Настройка влияет **только на страницу входа в CherryPlayWeb**: фронт запрашивает `GET /api/config` и при `oauthEnabled: false` не показывает вкладку и кнопки OAuth. Форма входа в CherryPlayList (Desktop) по-прежнему может показывать OAuth. После починки OAuth вернуть `true` в конфиге.

---

## Скрытие страницы «Инфо о вечеринке» в веб-приложении

Можно отключить отображение страницы «Инфо о вечеринке» и всех ссылок на неё в CherryPlayWeb (только UI; данные вечеринки по-прежнему хранятся и доступны по API).

- **Конфиг:** `Features:PartyInfoPageEnabled`. По умолчанию `false` (если ключ отсутствует — страница и ссылки скрыты).
- **appsettings.json:** `"Features": { "PartyInfoPageEnabled": false }` или `true` (чтобы включить страницу).
- **Переменная окружения:** `Features__PartyInfoPageEnabled=true` или `false`.

Фронт читает значение из `GET /api/config` (поле `partyInfoPageEnabled`, camelCase) и при `false` скрывает страницу и навигацию к ней.

---

## Предупреждение о прекращении поддержки Desktop

Сервер отдаёт уведомления Desktop через `GET /api/config` ([CONTRACTS.md](../CONTRACTS.md) §2.2).

**`desktopUpdateVersion`** — автоматически: сервер запрашивает GitHub Releases (`api.github.com`) и объявляет наибольшую подходящую Desktop-сборку (prerelease `player-vX.Y.Z` + доверенный ZIP). Оператор версию в конфиге не задаёт; Desktop можно публиковать без релиза сайта. Кэш ~5 мин, таймаут ~10 с; сбой или пустой набор → в кэш кладётся `null`. Задумка: остальные поля `/api/config` остаются быстрыми; версия может появиться после заполнения кэша. Серверу нужен egress к `api.github.com`. Electron по-прежнему может проверять GitHub напрямую для своего уведомления.

**`NextMinVersion` / `NextServerVersion`** — предупреждение о будущем прекращении совместимости (будущий минимум приложения и целевой релиз сайта/сервера). Задайте в `appsettings.json` или env процесса сервера: `ClientCompatibility__Desktop__NextMinVersion`, `ClientCompatibility__Desktop__NextServerVersion`. После изменения перезапустите или передеплойте. В [docker-compose.prod.yml](../docker-compose.prod.yml) эти переменные не проброшены: для env нужны явные записи в `environment` сервиса `server`.

`MinVersion` / `NextMinVersion` в дефолтном конфиге могут быть уже заданы (например `0.7.0`); `NextServerVersion` по умолчанию пуст. Предупреждение публикуется только при валидных текущих и будущих версиях, когда будущий минимум выше `MinVersion` по major/minor, а целевой релиз выше `ServerVersion` по major/minor/patch. Пустая, частичная, некорректная или уже достигнутая политика даёт `null`. Patch не влияет на совместимость Desktop: минимум `0.7.0` допускает любой `0.7.x`.

Порядок выпуска предупреждения совместимости:

1. Опубликуйте Desktop-версию, которая удовлетворяет будущему минимуму и работает с текущим сервером. Проверьте её на `/download` и что `desktopUpdateVersion` в `/api/config` отражает подходящий GitHub-релиз (после кэша).
2. Задайте оба `Next*` поля. Текущий `MinVersion` сохраняйте до целевого релиза.
3. После перезапуска проверьте `curl -fsS http://localhost:5000/api/config`: `desktopCompatibilityWarning` должен содержать объявленные нормализованные версии. В Desktop ниже будущего major/minor включите «Онлайн», завершите активную связанную сессию и проверьте предупреждение в шапке; для подходящей версии предупреждение отсутствует.
4. При выпуске целевого релиза поднимите `ClientCompatibility:Desktop:MinVersion` до объявленного минимума и очистите оба `Next*` поля. Middleware возвращает `426 client_outdated` Desktop-клиентам ниже `MinVersion` по major/minor.

Объявление совместимости само не блокирует подключения и не повышает `MinVersion`. Для отмены очистите оба `Next*` поля и перезапустите сервер; при достижении целевой версии сервера предупреждение также перестаёт публиковаться.

---

## Коды ответов API (авторизация)

- **401 Unauthorized** — запрос без токена, с невалидным/истёкшим JWT или с несуществующей сессией. Клиенту следует предложить повторный вход.
- **403 Forbidden** — токен валиден, но у организатора нет прав на данный ресурс (например, доступ к чужой вечеринке). Подробнее см. [CONTRACTS.md](../CONTRACTS.md) §1.1.
- **403 admin_only** — доступ к `/api/admin/*` без роли admin.
- **503** на `POST /auth/forgot-password` — в Production: (1) отсутствие полного конфига почты / `PUBLIC_WEB_BASE_URL` **до** lookup; (2) редкая неожиданная ошибка **после** создания токена (токен **не** гасится, остаётся usable до TTL). Не путать с soft-fail **200** при уже настроенном провайдере, но упавшей **отправке** (anti-enumeration; токен **остаётся usable**, hard-log). См. [CONTRACTS.md](../CONTRACTS.md) §3.2.0a, [ENV.md](../ENV.md).

---

## RuSender и сброс пароля (ops)

Транзакционная почта для forgot-password идёт только через **RuSender** (без Western ESP).

### Секреты и ENV

| Переменная             | Где задавать                                                                               | Примечание                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `RUSENDER_API_TOKEN`   | GitHub Secrets / серверный `.env.production` / локально `.env.development` (debug compose) | Никогда не коммитить                          |
| `RUSENDER_SEND_KEY_ID` | То же                                                                                      | Numeric send key id из кабинета RuSender      |
| `EMAIL_FROM_ADDRESS`   | Дефолт `docker-compose.prod.yml` / локально `.env.development` (не Secrets)                | `noreply@cherrypashkaparty.ru` в prod compose |
| `EMAIL_FROM_NAME`      | То же                                                                                      | `CherryPlay`                                  |
| `PUBLIC_WEB_BASE_URL`  | То же                                                                                      | `https://cherrypashkaparty.ru` в prod compose |

Проброс в контейнер `server`:

- **debug:** `env_file: .env.development` в [docker-compose.debug.yml](../docker-compose.debug.yml);
- **prod:** дефолты From / `PUBLIC_WEB_BASE_URL` в [docker-compose.prod.yml](../docker-compose.prod.yml); `RUSENDER_*` из CI Secrets (через `deploy.sh` → `.env`). На сервере для почты ничего заводить не обязательно.

Полный справочник: [ENV.md](../ENV.md). Шаблоны без секретов: [.env.example](../.env.example).

### Верификация домена (SPF/DKIM)

1. В кабинете RuSender добавить/подтвердить домен отправки (для CherryPlay — `cherrypashkaparty.ru`).
2. Выполнить инструкции RuSender по **SPF** и **DKIM** в DNS домена.
3. Дождаться статуса verified; создать transactional send key и прописать `RUSENDER_SEND_KEY_ID` + API token.
4. Smoke: `POST /auth/forgot-password` с тестовым зарегистрированным email → письмо со ссылкой на `{PUBLIC_WEB_BASE_URL}/reset-password?token=…`.

Пока домен/ключи не готовы: в Prod без конфига forgot вернёт **503** на все запросы; при конфиге, но сбое отправки — **200** generic, токен **остаётся usable** до TTL (допустимо; мониторить send failures — в логе `token left usable`). Dev без RuSender пишет ссылку в лог.

### Ops follow-up (prod mail)

Перед опорой на forgot-password в production проверить:

- домен `cherrypashkaparty.ru` **verified** в RuSender (SPF/DKIM);
- `PUBLIC_WEB_BASE_URL` — дефолт HTTPS в `docker-compose.prod.yml` (`https://cherrypashkaparty.ru`).

Таблица токенов: [DATABASE.md](DATABASE.md) — `PasswordResetTokens`.

---

## Логирование

Backend пишет структурированные JSON-записи в консоль. По умолчанию записываются события уровня `Information` и выше; для категории `Microsoft.AspNetCore` уровень `Information` отфильтрован, поэтому остаются `Warning` и выше. События `Debug` и `Trace` по умолчанию не попадают в журнал.

Каждый HTTP-запрос оборачивается logging scope с `TraceId`, `SpanId` и `RequestId`; JSON console пишет scope в поле `Scopes`. Если входящий запрос содержит валидный W3C `traceparent`, новый request activity продолжает его trace. Без существующей activity middleware создаёт W3C activity для запроса.

Сейчас прикладные события покрывают успешную регистрацию и вход, выход и смену пароля, неуспешный вход без идентификатора учётной записи, создание/изменение/удаление вечеринки и плейлиста, переходы состояния вечеринки и сессии, отдельные операции SignalR, а также предупреждения и ошибки. В событиях, где идентификаторы доступны, указываются внутренние `OrganizerId` и `PartyId`; они не присутствуют в каждом событии. Это описание текущего логирования, а не требование логировать все перечисленные операции.

Штатные прикладные события не включают email, имя, пароль, токены, содержимое HTTP-запросов или плейлистов. Dev email fallback пишет только факт вызова и не пишет reset URL. Перед отправкой контейнерных логов в Loki Alloy дополнительно маскирует email, IP-адреса и значения query-параметров URL. Эти фильтры дополняют правила приложения и не заменяют проверку новых логов при изменении кода.

### Метрики и локальный просмотр мониторинга

HTTP instrumentation публикует `http_requests_received_total` (счётчик запросов по классу status code, включая `5xx`) и `http_request_duration_seconds` (гистограмма задержки). В Grafana обзор показывает скорость запросов по классу ответа и p95 задержки. Снижение cardinality status code включено через `ReduceStatusCodeCardinality`; не добавляйте в labels user/request IDs, токены, полный URL или другие значения, меняющиеся на каждом запросе. Kestrel слушает `0.0.0.0:8080` внутри Compose-сервиса `server`; `/metrics` использует тот же server port, отдельного host port для метрик нет. Prometheus читает `http://server:8080/metrics` по внутренней Compose-сети. В production host port сервера опубликован как `127.0.0.1:5000`; в локальном `docker-compose.yml` — `5000:8080`.

Локальный запуск и учётные данные Grafana описаны в [DEV_SETUP.md](../DEV_SETUP.md#локальный-стек-с-grafana); локальный host port задаётся как `3001` в `.env.monitoring.local.example`. В production Grafana опубликована только на loopback хоста (`127.0.0.1`, `GRAFANA_HOST_PORT`, по умолчанию `3000`); доступ к ней выполняйте с сервера или через SSH-туннель, не открывая этот порт в интернет. Prometheus и Loki доступны Grafana внутри Compose и не публикуют host ports.

В Grafana откройте папку **CherryPlay** → **Обзор CherryPlay**. Панель **Логи контейнеров** показывает записи Loki. Для ошибок backend используйте фильтр `{job="docker"} | json | Category=~"CherryPlayServer\\..+" | LogLevel=~"Error|Critical"`; поле `Scopes` содержит `TraceId`, `SpanId` и `RequestId` для корреляции запроса. Общий запрос `{job="docker"}` помогает найти другие контейнерные сообщения. Alloy маскирует email, IP и значения query-параметров; маскирование — дополнительная защита, а не разрешение помещать секреты в лог.

Правило **CherryPlay HTTP 5xx** становится warning при любом 5xx, учтённом за скользящие последние 5 минут; его summary указывает на обнаружение HTTP 5xx за этот интервал. Правило **CherryPlay application errors** срабатывает на backend-событие уровня `Error` или `Critical` за тот же интервал, но его summary содержит только общее сообщение об ошибках приложения. Для обоих правил задержка `for` равна нулю, проверка правил выполняется раз в минуту; при отсутствии данных эти два правила остаются нормальными. Они автоматически возвращаются в норму после выхода события/ошибки из пятиминутного окна (с учётом интервала вычисления). Ни одно из этих уведомлений не включает текст события или correlation IDs: откройте Loki Explore или панель **Логи контейнеров** и найдите backend-запись, чтобы увидеть детали и поля `TraceId`, `SpanId`, `RequestId` в `Scopes`. Настройка каналов доставки уведомлений не входит в текущий локальный smoke.

---

## Резервное копирование БД

- **Инфраструктура:** сервер — VM на Cloud.ru; PostgreSQL установлен Оператором самостоятельно (Docker), **не** управляемый DBaaS Cloud.ru. Отдельного SLA/политики retention управляемых бэкапов Cloud.ru для этой БД нет.
- **Регулярные бэкапы:** на момент фиксации Оператором **не ведутся** (нет расписания dumps / disk snapshots вне деплоя).
- **Перед каждым релизом:** `scripts/deploy.sh` автоматически создаёт обязательный pre-deploy dump в `~/cherryplay-deploy/backups/`; при сбое деплой не продолжается. Retention — **по числу файлов** (последние **10**, `BACKUP_RETENTION_COUNT`), не по календарным дням. Подробнее: [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) §0.1.
- **Когда регулярные бэкапы будут введены:** срок хранения копий должен быть **≤ 30 дней**; после restore удалённые ранее данные могут вернуться — обязательно повторно применить удаление/очистку (аккаунт, согласия, токены и т.п.) до возврата в рабочий контур.
- **Содержимое dump:** полный бэкап БД (Organizer, Party, PartyPlaylist, SessionState и связанные данные).
- **Хранение dumps:** каталог на сервере (`BACKUP_DIR`); при появлении регулярной политики — отдельно от рабочего инстанса (другой диск/сервер).

### Восстановление после сбоя

1. Остановить приложение.
2. Восстановить БД из последнего известного хорошего бэкапа.
3. Повторно применить удаление/очистку для субъектов, чьи данные уже были удалены из рабочего контура до сбоя (иначе restore «воскресит» их).
4. Запустить приложение и проверить health endpoint.
5. При необходимости проверить целостность данных (например, наличие вечеринок и организаторов).

Инструкция восстановления: [BACKUP_RESTORE.md](../BACKUP_RESTORE.md).

---

## Rate limiting и антиспам

По плану §2.1:

- **Публичные ручки и Hub:** применить rate limiting, чтобы снизить риск злоупотреблений и DDoS.
- **Админские ручки `/api/admin/*`:** применяется отдельный строгий лимитер `admin-strict`.
- **Лимиты по вечеринкам:** ограничение числа «будущих» вечеринок на организатора (например, 2), чтобы каталог нельзя было «заспамить». Повышение лимита — вручную (без админки в v1).

Конкретные лимиты (запросов в минуту, число вечеринок) задаются при реализации.

---

## Выдача роли admin

Первого администратора задают вручную в БД:

```sql
UPDATE organizers SET role = 'admin' WHERE email = '<admin-email>';
```

Альтернатива по идентификатору:

```sql
UPDATE organizers SET role = 'admin' WHERE id = '<organizer-guid>';
```

Проверка:

- выполнить `GET /api/organizer/me` под этой учётной записью и убедиться, что `role = "admin"`;
- убедиться, что `GET /api/admin/organizers` возвращает 200.

---

## Алерты и мониторинг

Compose запускает Prometheus, Loki, Alloy и Grafana с provisioned dashboard и alert rules. Кроме HTTP 5xx и backend `Error`/`Critical` alerts, production provisioned rules контролируют доступность monitoring targets, свободное место корневой файловой системы и доступную память host. Текущие HTTP/backend alert semantics и ручной просмотр логов описаны выше в разделе «Логирование»; локальный запуск — в [DEV_SETUP.md](../DEV_SETUP.md#локальный-стек-с-grafana).

HTTP latency показывается на dashboard, но отдельного latency alert нет. Alerts на состояние PostgreSQL и jobs, а также доставка уведомлений по email/Telegram в текущую конфигурацию не входят; Telegram вынесен в отдельную задачу мониторинга.

---

## Деплой и откат

- **Деплой:** остановка сервиса → обновление бинарников/конфигурации → запуск → проверка health.
- **Откат приложения не откатывает EF Core migrations.** Перед возвратом старого приложения убедитесь в его совместимости с текущей схемой. Production workflow не выполняет downgrade миграций; возврат БД по pre-deploy dump перезаписывает более новые данные и требует повторного применения последующих удалений/очисток.

**Операторский чеклист беты:** [BETA_RELEASE_RUNBOOK.md](../.github/BETA_RELEASE_RUNBOOK.md) — preflight, deploy, verify и rollback. Подробности CI/CD: [`.github/DEPLOYMENT.md`](../.github/DEPLOYMENT.md); backup/restore: [BACKUP_RESTORE.md](../BACKUP_RESTORE.md).

Операторский порядок действий и проверки перед релизом собраны в runbook CP-031.
