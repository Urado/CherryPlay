# Операционная документация CherryPlayServer

Требования к эксплуатации по [RELEASE_PLAN.md](../RELEASE_PLAN.md) §4.5 и §2.1: один сервер/инстанс (монолит), наблюдаемость, устойчивость.

---

## Health endpoint

- **Назначение:** проверка доступности сервиса (мониторинг, балансировщики, оркестраторы).
- **Путь:** `GET /api/health`.
- **Ожидаемое поведение:** при работоспособном сервере — ответ 200, JSON `{ "status": "Healthy", "timestamp": "..." }` (ISO 8601).

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

Рекомендуется логировать минимум следующие события:

- **Auth:** вход/выход организатора, неуспешные попытки (без паролей/токенов в логе); в Dev — fallback reset URL при forgot-password (в Prod сырой токен/полный URL **не** логировать).
- **Party:** создание, обновление, удаление вечеринки (идентификатор вечеринки/организатора).
- **Session:** начало и окончание сессии по вечеринке.
- **Hub:** подключение/отключение клиентов (viewer/organizer), критические ошибки в обработчиках.

Уровень детализации (info/warning/error) и формат (структурированный JSON, plain text) — на усмотрение реализации.

---

## Резервное копирование БД

- **Перед каждым релизом:** `scripts/deploy.sh` автоматически создаёт обязательный pre-deploy dump в `~/cherryplay-deploy/backups/`; при сбое деплой не продолжается. Подробнее: [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) §0.1.
- **Частота (дополнительно):** минимум еженедельно вне деплоя (по плану §2.1) — вручную или cron.
- **Содержимое:** полный бэкап БД (Organizer, Party, PartyPlaylist, SessionState и связанные данные).
- **Хранение:** отдельно от рабочего инстанса (другой диск/сервер/облако).

### Восстановление после сбоя

1. Остановить приложение.
2. Восстановить БД из последнего известного хорошего бэкапа.
3. Запустить приложение и проверить health endpoint.
4. При необходимости проверить целостность данных (например, наличие вечеринок и организаторов).

Инструкция восстановления должна быть доступна операторам (внутренняя wiki, runbook или этот файл).

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

Минимум для v1 (план Epic G):

- Контроль доступности: опрос health endpoint (внешний мониторинг или простой алерт при падении).
- Ручной просмотр логов при инциденте (без обязательной интеграции с SIEM в v1).

При развитии: алерты на ошибки 5xx, рост времени ответа, падение подключений к БД.

---

## Деплой и откат

- **Деплой:** остановка сервиса → обновление бинарников/конфигурации → запуск → проверка health.
- **Откат:** возврат к предыдущей версии бинарников и конфигурации; при изменении схемы БД — наличие миграций с откатом (down) и порядок применения при откате описать отдельно.

**Подробная документация по деплою:** [`.github/DEPLOYMENT.md`](../.github/DEPLOYMENT.md) — настройка GitHub Secrets, автоматический деплой через GitHub Actions, ручной деплой, откат версий.

Чеклист деплоя и отката детализируется в рамках Epic G.
