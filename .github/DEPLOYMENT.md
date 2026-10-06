# Настройка CI/CD для CherryPlay

Этот документ описывает настройку автоматической сборки Docker образов и деплоя на сервер через GitHub Actions.

## Архитектура

1. **Server Tests** (`tests.yml`) — .NET-тесты на PR в `main`/`develop` и после push в `main`
2. **Verify Docker Build** (`verify-docker-build.yml`) — на PR проверяет, что образы `server`/`web` собираются (`push: false`, без публикации в GHCR)
3. **Verify Desktop Windows** (`verify-desktop-windows.yml`) — на PR в `main`/`develop` при изменениях в `CherryPlayList`/`CherryPlayComponents` выбирает наибольшую версию опубликованного Desktop prerelease с тегом `player-vX.Y.Z` и точным ZIP `CherryPlayList-X.Y.Z-x64.zip`; если такого релиза нет, использует `0.0.0`. Package version сборки — **`{base}-pr-{PR}`**, а ZIP и Actions artifact называются **`CherryPlayList-{base}-pr-{PR}-x64.zip`** и **`CherryPlayList-{base}-pr-{PR}-x64`** (например `CherryPlayList-0.6.4-pr-90-x64.zip`). Комментарий бота отдельно показывает версию пакета и имя ZIP. Без загрузки в GitHub Release — для ручного теста до релиза. Релизные ZIP остаются с чистой версией приложения.
4. **Build & Push Images** (`build-images.yml`) — собирает и пушит образы в GHCR при push в `main`/`develop`
5. **Release and Deploy** (`release-and-deploy.yml`) — собирает образы с тегами версий и деплоит на сервер при **публикации** релиза (`release: published`) или вручную (`workflow_dispatch` + tag)
6. **Release Desktop Windows** (`release-desktop-windows.yml`) — независимо собирает Windows zip CherryPlayList и загружает его в GitHub Release. Для `player-vX.Y.Z` тег задаёт версию Desktop: workflow проверяет формат и prerelease-статус, записывает `X.Y.Z` в `package.json` и `package-lock.json`, а затем проверяет версию ZIP. При `workflow_dispatch` этот тег также указывает целевой релиз.

При публикации GitHub Release (не draft) workflows **5** и **6** запускаются **параллельно** и не зависят друг от друга: сбой desktop-сборки не блокирует деплой сервера, и наоборот. Desktop-workflow не требует дополнительных Secrets (достаточно `GITHUB_TOKEN`). Draft → Publish тоже даёт `published`; событие `created` для draft GitHub не шлёт в Actions.

### Сетевое устройство и Nginx

В продакшене используется **два уровня Nginx**:

- **Внешний Nginx на хосте** (конфиг: `.github/nginx-cherryplay-https.conf`):
  - слушает порты **80/443**;
  - делает редирект HTTP → HTTPS;
  - терминирует TLS (Let's Encrypt сертификаты);
  - проксирует все запросы на контейнер `web` (по умолчанию `127.0.0.1:8080`).

- **Внутренний Nginx в контейнере `web`** (конфиг: `CherryPlayWeb/nginx.conf`):
  - раздаёт статику SPA (`/` → `index.html`);
  - проксирует:
    - ` /api` → сервис `server:8080` (Backend API),
    - ` /auth` → `server:8080` (OAuth и auth-эндпоинты),
    - ` /partyHub` → `server:8080` (SignalR Hub).

Поток запроса в продакшене:

`Клиент → Nginx на хосте (443) → контейнер web (8080) → Nginx внутри web → backend-сервис server:8080`.

## Предварительные требования

### 1. GitHub Container Registry (GHCR)

GitHub Container Registry уже настроен и доступен автоматически. Образы будут публиковаться в:

- `ghcr.io/<owner>/<repo>/server`
- `ghcr.io/<owner>/<repo>/web`

### 2. Настройка GitHub Secrets

Перейдите в **Settings → Secrets and variables → Actions** и добавьте секреты.

#### Обязательные для деплоя (Release and Deploy)

| Секрет              | Описание                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `SSH_PRIVATE_KEY`   | Приватный SSH-ключ для доступа к серверу (содержимое `id_ed25519` или `id_rsa`)            |
| `DEPLOY_HOST`       | IP или домен сервера (например `deploy.example.com`)                                       |
| `DEPLOY_USER`       | Пользователь для SSH (например `deploy`, `ubuntu`)                                         |
| `JWT_SECRET_KEY`    | Секрет для подписи JWT (не менее 32 символов). Используется сервером в production          |
| `POSTGRES_PASSWORD` | Пароль пользователя PostgreSQL (должен совпадать с тем, что на сервере при первом запуске) |
| `PGADMIN_EMAIL`     | Email для входа в pgAdmin (например `admin@yourdomain.com`)                                |
| `PGADMIN_PASSWORD`  | Пароль для входа в pgAdmin (задайте сильный пароль)                                        |
| `GRAFANA_ADMIN_PASSWORD` | Сильный отдельный пароль администратора Grafana; нужен для production-деплоя мониторинга |

#### Опциональные (подставляются в docker-compose и CI/CD при деплое)

| Секрет                   | Описание                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `CORS_ORIGIN_0`          | Первый разрешённый origin (для HTTPS укажите `https://yourdomain.com`). По нему же при деплое подставляется домен в конфиг Nginx.  |
| `CORS_ORIGIN_1`          | Второй origin (например `https://www.yourdomain.com`)                                                                              |
| `OAUTH_VK_CLIENT_ID`     | ID приложения VK (для входа через VK)                                                                                              |
| `OAUTH_VK_CLIENT_SECRET` | Защищённый ключ приложения VK                                                                                                      |
| `GHCR_TOKEN`             | PAT с правами `read:packages` (и `write:packages` при сборке). Для публичного репо можно не задавать — используется `GITHUB_TOKEN` |
| `RUSENDER_API_TOKEN`     | Bearer-токен RuSender API (`rs_ck_v1_…`). **Секрет** — нужен для отправки писем сброса пароля в Prod                               |
| `RUSENDER_SEND_KEY_ID`   | Числовой `key_id` transactional send key RuSender. **Секрет**                                                                      |

Несекретные настройки почты задаются **дефолтами в** [docker-compose.prod.yml](../docker-compose.prod.yml) (`EMAIL_FROM_ADDRESS=noreply@cherrypashkaparty.ru`, `EMAIL_FROM_NAME=CherryPlay`, `PUBLIC_WEB_BASE_URL=https://cherrypashkaparty.ru`) — на сервере их заводить не обязательно. Переопределение — опционально через `.env.production`. Без `RUSENDER_*` forgot-password в Prod отвечает 503. Полный справочник — [ENV.md](../ENV.md).

Миграции EF Core применяются при старте контейнера `server`: в коде вызывается `db.Database.Migrate()`, подключение к БД идёт по внутренней Docker-сети (`postgres:5432`). В `release-and-deploy.yml` при релизе принудительно выставляется `Database__AutoMigrateOnStartup=true`, чтобы накат миграций происходил автоматически.

**Перед остановкой контейнеров** `deploy.sh` делает обязательный `pg_dump` в `~/cherryplay-deploy/backups/` (см. [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) §0.1). Если backup не удался, деплой прерывается до миграций.

Для ручного запуска `deploy.sh` файл `compose-env.sh` должен находиться рядом со скриптом: он экранирует значения переменных для Compose `.env`.

### 3. Настройка SSH ключа

На вашем локальном компьютере:

```bash
# Создайте SSH ключ (если еще нет)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Скопируйте публичный ключ на сервер
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub <DEPLOY_USER>@<DEPLOY_HOST>
```

Добавьте приватный ключ в GitHub Secrets:

```bash
# Windows (PowerShell)
cat ~/.ssh/github_actions_deploy | Set-Clipboard

# Linux/Mac
cat ~/.ssh/github_actions_deploy | pbcopy  # Mac
cat ~/.ssh/github_actions_deploy | xclip -selection clipboard  # Linux
```

Вставьте содержимое в секрет `SSH_PRIVATE_KEY` в GitHub.

### 4. Настройка сервера

#### Установка Docker и Docker Compose

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# Или используйте официальный скрипт установки Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавьте пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker
```

#### Создание директории для деплоя

```bash
mkdir -p ~/cherryplay-deploy
```

#### Создание файла `.env.production` (для ручного деплоя или запас)

При деплое через GitHub Actions секреты (`JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, `PGADMIN_EMAIL`, `PGADMIN_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`, `CORS_ORIGIN_*`, `OAUTH_VK_CLIENT_ID`, `OAUTH_VK_CLIENT_SECRET`, `RUSENDER_API_TOKEN`, `RUSENDER_SEND_KEY_ID`) берутся из GitHub Secrets и передаются deploy script в environment. `EMAIL_FROM_*` и `PUBLIC_WEB_BASE_URL` по умолчанию из [docker-compose.prod.yml](../docker-compose.prod.yml) (действия на сервере не нужны). Полный справочник — [ENV.md](../ENV.md). Опциональный запас `~/cherryplay-deploy/.env.production`:

```env
# Обязательно для работы сервера
JWT_SECRET_KEY=ваш_секрет_не_короче_32_символов

# PostgreSQL (должен совпадать с паролем при первом запуске контейнера postgres)
POSTGRES_PASSWORD=your_secure_password_here

# pgAdmin
PGADMIN_EMAIL=admin@yourdomain.com
PGADMIN_PASSWORD=your_admin_password

# Grafana
GRAFANA_ADMIN_PASSWORD=your_separate_grafana_admin_password

# CORS (разрешённые origins для фронта)
CORS_ORIGIN_0=https://yourdomain.com
CORS_ORIGIN_1=https://www.yourdomain.com

# VK OAuth (для входа через VK)
OAUTH_VK_CLIENT_ID=your_vk_app_id
OAUTH_VK_CLIENT_SECRET=your_vk_secure_key

# RuSender tokens — опционально здесь, если не задаёте GitHub Secrets RUSENDER_*
# RUSENDER_API_TOKEN=rs_ck_v1_your_token
# RUSENDER_SEND_KEY_ID=12345

# From / public Web URL — опционально (иначе дефолты docker-compose.prod.yml)
# EMAIL_FROM_ADDRESS=noreply@cherrypashkaparty.ru
# EMAIL_FROM_NAME=CherryPlay
# PUBLIC_WEB_BASE_URL=https://cherrypashkaparty.ru
```

#### Настройка доступа к GHCR (для приватных репозиториев)

Если репозиторий приватный, настройте доступ к GHCR на сервере:

```bash
# Создайте GitHub Personal Access Token с правами read:packages
# Затем выполните:
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

Или добавьте логин в скрипт деплоя.

## Как использовать

**Первый деплой:** пошаговая инструкция — [FIRST_DEPLOY.md](FIRST_DEPLOY.md).

### Доступ к pgAdmin на сервере

На проде pgAdmin слушает только **127.0.0.1:5050** — в интернет он не вынесен. Чтобы открыть админку БД:

1. Поднимите **SSH-туннель** с вашего ПК на сервер (см. [SSH_TUNNEL_PGADMIN.md](../SSH_TUNNEL_PGADMIN.md)):
   ```bash
   ssh -L 5050:127.0.0.1:5050 ЛОГИН@АДРЕС_СЕРВЕРА
   ```
2. В браузере откройте **http://localhost:5050** — отобразится pgAdmin с сервера.
3. Войдите по логину/паролю из `PGADMIN_EMAIL` и `PGADMIN_PASSWORD`. При первом заходе (или при раскрытии серверов) pgAdmin попросит задать/ввести **мастер-пароль** для шифрования сохранённых паролей — задайте и запоминайте его, он сохраняется в томе и не сбрасывается при перезапуске. В pgAdmin добавьте сервер БД: Host `postgres`, Port `5432`, база `cherryplay`, пользователь/пароль из `POSTGRES_PASSWORD`.

### Доступ к Grafana

Grafana доступна только на loopback сервера (`127.0.0.1:3000`). Prometheus, Loki и exporters доступны только внутри Docker-сети. Для открытия панели:

1. Откройте PowerShell на своём компьютере и запустите SSH-туннель, подставив пользователя и адрес сервера:
   ```powershell
   ssh -N -L 3001:127.0.0.1:3000 <DEPLOY_USER>@<DEPLOY_HOST>
   ```
2. Оставьте это окно PowerShell открытым и перейдите в браузере на [http://localhost:3001](http://localhost:3001). Порт `3000` на компьютере уже используется frontend, поэтому для Grafana выбран `3001`; на сервере Grafana по-прежнему доступна на `127.0.0.1:3000`.
3. Войдите как `admin`, пароль — значение GitHub Secret `GRAFANA_ADMIN_PASSWORD`.
4. Откройте папку **CherryPlay** и dashboard **Обзор CherryPlay**. В нём есть текущее число соединений PartyHub, пик за выбранный период и тренд (по умолчанию последние 7 дней). В Explore выберите Loki для просмотра логов.

Чтобы завершить доступ, закройте окно туннеля. SSH-туннель шифрует соединение и не публикует Grafana в интернет.

Мониторинг запрашивает `/metrics` backend-сервера из внутренней Docker-сети. Порт `5000` backend опубликован только как `127.0.0.1:5000` для локального health check; публичные `/api`, `/auth` и `/partyHub` идут через существующую цепочку Nginx на хосте → web → `server:8080`. Для локального Swagger доступа с компьютера откройте `ssh -N -L 5000:127.0.0.1:5000 <DEPLOY_USER>@<DEPLOY_HOST>`.

Prometheus хранит данные до 168 часов и ограничивает TSDB до 2 GB; WAL, head block и filesystem overhead могут временно увеличить фактическое использование, а достижение лимита размера может сократить доступную историю. Loki настроен на retention 168 часов и ограничен ingestion rate 4 MB/s (burst 8 MB); основной ограничитель объёма — retention и ротация Docker JSON-логов. Docker JSON-логи дополнительно ограничены до 3 файлов по 10 MiB на контейнер; это аварийный локальный буфер. Loki использует обычный локальный Docker volume без filesystem quota, поэтому 7-дневный retention и rate limit не дают абсолютной гарантии свободного места; размер диска VM неизвестен. Host disk alerts срабатывают при запасе ниже 20% и 10%; правила доступны в Grafana, contact point и маршруты уведомлений не настроены.

Backend пишет структурированные JSON-логи с уровнем `Information` по умолчанию (события ASP.NET Core ниже `Warning` отфильтрованы). Штатные прикладные события могут включать внутренние `OrganizerId` и `PartyId`; email, имя, пароль, токены, содержимое запросов и плейлистов в эти события не включаются. Alloy дополнительно очищает email, IP-адреса и распространённые секреты в URL перед отправкой записей в Loki.

На одной VM установлены предварительные memory caps: PostgreSQL 1 GiB, backend 1 GiB, web 256 MiB, pgAdmin 256 MiB, Prometheus 256 MiB, Loki 256 MiB, Grafana 256 MiB, Alloy 128 MiB и exporters по 128 MiB — всего 3.625 GiB верхней границы; совокупные CPU caps — 5.5 cores. Caps для вспомогательных сервисов снижены, чтобы ограничить общий аппетит стека на VM с неизвестным размером; это лимиты, не резервирование. Фактический объём CPU, RAM и свободного диска VM пока неизвестен. Prometheus, Loki и Alloy доступны только внутренней Docker-сети. Контейнерные resource metrics отключены: сбор через cAdvisor потребовал бы доступа к Docker socket API, что добавило бы риск управления Docker daemon; в этом Compose оставлены метрики хоста, backend и PostgreSQL. Node-exporter собирает метрики хоста без privileged-режима.

### Автоматическая сборка при изменениях

При каждом push в ветки `main` или `develop` автоматически:

- Собираются образы `server` и `web`
- Образы публикуются в GHCR с тегами:
  - `latest` (только для main)
  - `<branch-name>` (имя ветки)
  - `<branch-name>-<sha>` (SHA коммита)

### Создание релиза и деплой

1. **Создайте тег в Git:**

   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

2. **Создайте Release в GitHub:**
   - Перейдите в репозиторий → Releases → Create a new release
   - Выберите созданный тег (например, `v1.0.0`)
   - Заполните название и описание
   - Нажмите "Publish release"

3. **Автоматический процесс (два независимых workflow):**
   - **`release-and-deploy.yml`**: для стабильного релиза образы с тегом версии публикуются в GHCR и деплоятся на сервер; обычный prerelease пропускает деплой
   - **`release-desktop-windows.yml`** (включая prerelease, без draft): Windows zip → asset того же Release; для тега `player-vX.Y.Z` версия ZIP берётся из тега

Для сайта и сервера публикуйте стабильный релиз с тегом `vX.Y.Z` (например, `v1.0.0`) без отметки prerelease. `release-and-deploy.yml` проверяет формат тега и использует его версию как `ClientCompatibility.ServerVersion` в образе сервера и как версию совместимости в сборке web-образа; неподдерживаемый тег останавливает workflow до сборки образов. Порог `ClientCompatibility.Desktop.MinVersion` остаётся отдельной настройкой: сервер возвращает `426 client_outdated` клиентам ниже этого порога.

Релиз приложения публикуйте как prerelease с тегом строго в формате `player-vX.Y.Z` (например, `player-v0.7.0`): три числовых компонента, без prerelease-суффикса. Для такого тега `release-and-deploy.yml` пропускает сборку образов и деплой, а `release-desktop-windows.yml` проверяет формат и prerelease-статус, записывает версию тега в `CherryPlayList/package.json` и `package-lock.json`, собирает ZIP и проверяет его версию. Уведомление Desktop и страница загрузки сайта отбирают опубликованные prerelease с тегом этого формата и точным совпадением `CherryPlayList-X.Y.Z-x64.zip`; оба выбирают наибольшую SemVer-версию. Обновление скачивается вручную через `/download`, автоустановки нет.

### Скачать Windows desktop (CherryPlayList)

#### Из pull request (до релиза)

На PR с изменениями в List/Components workflow **Verify Desktop Windows** берёт `{base}` из наибольшего опубликованного prerelease Desktop тега `player-vX.Y.Z`, если есть ZIP с тем же номером версии; иначе `{base}` равен `0.0.0`. Package version внутри сборки — `{base}-pr-{N}`, имя ZIP и artifact — **`CherryPlayList-{base}-pr-{N}-x64.zip`** / **`CherryPlayList-{base}-pr-{N}-x64`**. Скачать: PR → комментарий бота или Checks → run → **Artifacts**. Retention 14 дней. Релизные assets — без суффикса `-pr-*`.

#### Из GitHub Release

После успешного desktop-workflow на Release появляется артефакт **`CherryPlayList-{version}-x64.zip`**. Для `player-vX.Y.Z` версия `{version}` — `X.Y.Z` из тега, записанная workflow в `package.json` и `package-lock.json`; в иных случаях workflow использует версию пакета из коммита. Версии Desktop и Server/Web ведутся отдельными тегами.

URL для **последнего стабильного** (non-prerelease) релиза:

```text
https://github.com/<owner>/<repo>/releases/latest/download/CherryPlayList-{appVersion}-x64.zip
```

Пример: в `package.json` версия `0.7.0`, zip лежит на последнем non-prerelease → `…/releases/latest/download/CherryPlayList-0.7.0-x64.zip`. `/latest/` указывает только на последний **non-prerelease**; prerelease тоже получает zip-asset, но не через `/latest/`. В имени файла — версия приложения.

Страница [`/download`](../CherryPlayWeb/docs/pages.md#страница-загрузки-приложения) и Desktop уведомление используют публичный GitHub Releases API и опубликованные prerelease с тегом строго в формате `player-vX.Y.Z` (три числовых компонента без prerelease-суффикса), у которых ZIP точно совпадает с версией тега (`CherryPlayList-X.Y.Z-x64.zip`). Оба выбирают наибольшую SemVer-версию. Страница показывает версию из тега и ведёт прямо на asset. Desktop при запуске и не чаще раза в 24 часа сравнивает установленную версию с выбранным релизом. Проверка откладывается на время активной связанной сессии; сетевой сбой не блокирует приложение и повторяется через пять минут. Мягкое уведомление показывается в шапке и может быть закрыто для этой версии. Скачивание и установка выполняются пользователем вручную. Стабильный `/latest/` запасным источником не служит.

Чтобы выпустить обновление приложения для этой страницы:

1. Создайте GitHub Release с тегом `player-vX.Y.Z`, отметьте его как prerelease и опубликуйте.
2. Дождитесь успешного `Release Desktop Windows` и проверьте, что в релиз добавлен ZIP `CherryPlayList-X.Y.Z-x64.zip`, совпадающий с версией в `player-vX.Y.Z`.
3. Откройте `/download` и убедитесь, что показана эта версия и кнопка начинает загрузку ZIP.

Тег `player-vX.Y.Z` задаёт версию приложения и ZIP. Для CP-087 ZIP собирается CI без AIMP bridge.

Ручной запуск (**Actions → Release Desktop Windows → Run workflow**):

- ветка сборки — выбранная в UI (обычно `main`);
- input `tag` — существующий GitHub Release (например `v0.6.1`), в который загружается zip;
- повторная сборка в тот же тег с той же версией `package.json` **заменяет** asset (`gh release upload --clobber`);
- если версию в `package.json` подняли, загружается новый файл; старый asset с прежним именем может остаться.

Обычные prerelease не деплоят сайт/сервер, хотя workflow собирает и публикует их образы. Для тега `player-*` сборка, публикация образов и деплой пропускаются полностью; desktop-workflow отдельно собирает и прикрепляет ZIP к prerelease.

- В опубликованном zip **нет** нативного AIMP bridge (сборка CI без `stage:aimp-plugin`). Полная локальная сборка с AIMP — см. [CherryPlayList/BUILD.md](../CherryPlayList/BUILD.md).

### Откат на предыдущую версию

Для отката на предыдущую версию:

1. Создайте новый Release с тегом предыдущей версии (например, `v0.9.0`)
2. Или вручную на сервере:
   ```bash
   cd ~/cherryplay-deploy
   export VERSION=v0.9.0
   export REGISTRY=ghcr.io
   export IMAGE_NAME_SERVER=<owner>/<repo>/server
   export IMAGE_NAME_WEB=<owner>/<repo>/web
   ./deploy.sh
   ```

## Структура файлов

```
.github/
  workflows/
    tests.yml                     # Server Tests (.NET)
    verify-docker-build.yml       # Проверка Docker-сборки на PR (без push)
    verify-desktop-windows.yml    # Проверка Windows zip CherryPlayList на PR (artifact)
    build-images.yml              # Build & Push Images → GHCR (push в main/develop)
    release-and-deploy.yml        # Docker-образы и деплой при релизе
    release-desktop-windows.yml   # Windows zip CherryPlayList → asset Release
  FIRST_DEPLOY.md                 # Инструкция для первого деплоя
  nginx-cherryplay-https.conf    # Конфиг Nginx для HTTPS (копируется на сервер при деплое)
scripts/
  deploy.sh                       # Скрипт деплоя на сервере
  compose-env.sh                  # Экранирование значений для Compose .env
docker-compose.prod.yml           # Docker Compose для продакшена
```

## Переменные окружения

### В GitHub Actions

- `REGISTRY` - реестр Docker (по умолчанию `ghcr.io`)
- `IMAGE_NAME_SERVER` - имя образа сервера (автоматически: `<owner>/<repo>/server`)
- `IMAGE_NAME_WEB` - имя образа веб-приложения (автоматически: `<owner>/<repo>/web`)

### На сервере

Скрипт `deploy.sh` использует следующие переменные:

- `VERSION` - версия для деплоя (например, `v1.0.0`)
- `REGISTRY` - реестр Docker
- `IMAGE_NAME_SERVER` - имя образа сервера
- `IMAGE_NAME_WEB` - имя образа веб-приложения
- `GITHUB_TOKEN` - токен для доступа к GHCR (опционально)

## Мониторинг деплоя

### Просмотр логов GitHub Actions

1. Перейдите в репозиторий → Actions
2. Выберите нужный workflow run
3. Просмотрите логи каждого шага

### Просмотр логов на сервере

```bash
# Логи всех сервисов
cd ~/cherryplay-deploy
docker-compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f server
docker-compose -f docker-compose.prod.yml logs -f web
```

### Проверка статуса контейнеров

```bash
docker ps | grep cherryplay
```

## Устранение неполадок

### Ошибка: "Failed to pull image"

- Проверьте, что образы опубликованы в GHCR
- Убедитесь, что версия тега существует
- Для приватных репозиториев проверьте доступ к GHCR

### Ошибка: "SSH connection failed"

- Проверьте, что `SSH_PRIVATE_KEY` правильно настроен в GitHub Secrets
- Убедитесь, что публичный ключ добавлен на сервер
- Проверьте доступность сервера: `ssh <DEPLOY_USER>@<DEPLOY_HOST>`

### Ошибка: "Permission denied" при работе с Docker

- Убедитесь, что пользователь добавлен в группу `docker`
- Выполните: `sudo usermod -aG docker $USER` и перелогиньтесь

### Контейнеры не запускаются

- Проверьте логи: `docker-compose -f docker-compose.prod.yml logs`
- Убедитесь, что порты не заняты другими процессами
- Проверьте переменные окружения в `.env.production`

## Безопасность

1. **Никогда не коммитьте секреты в репозиторий**
2. **Используйте сильные пароли для PostgreSQL и pgAdmin**
3. **Ограничьте доступ к серверу по SSH (используйте firewall)**
4. **Регулярно обновляйте Docker и систему на сервере**
5. **Используйте HTTPS для продакшена** — см. раздел [HTTPS (Nginx + Let's Encrypt)](#https-nginx--lets-encrypt) ниже.

## HTTPS (Nginx + Let's Encrypt)

HTTPS включается на **хосте** перед Docker: внешний Nginx принимает 443, термирует TLS и проксирует на контейнер `web` (порт 80). Конфиг лежит в репозитории (`.github/nginx-cherryplay-https.conf`). При деплое в него подставляется домен из секрета **`CORS_ORIGIN_0`** (из URL берётся только хост, без `https://` и пути), и готовый файл копируется в `~/cherryplay-deploy/nginx-cherryplay-https.conf` на сервере. Если `CORS_ORIGIN_0` не задан, на сервер попадает шаблон с плейсхолдером `YOUR_DOMAIN`.

### Однократная настройка на сервере

#### 1. Установка Nginx и Certbot (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

#### 2. Освобождение порта 80 для первичного получения сертификата

Контейнер `web` в prod слушает порт 80. Чтобы Certbot смог получить сертификат, временно освободите 80:

```bash
cd ~/cherryplay-deploy
docker compose -f docker-compose.prod.yml stop web
```

#### 3. Получение сертификата Let's Encrypt

Подставьте свой домен и email:

```bash
sudo certbot certonly --standalone -d YOUR_DOMAIN -d www.YOUR_DOMAIN --non-interactive --agree-tos -m admin@YOUR_DOMAIN
```

Сертификаты появятся в `/etc/letsencrypt/live/YOUR_DOMAIN/` (fullchain.pem, privkey.pem).

Запустите контейнер обратно:

```bash
docker compose -f docker-compose.prod.yml start web
```

#### 4. Установка конфига Nginx

После деплоя в `~/cherryplay-deploy/` лежит файл `nginx-cherryplay-https.conf`. Если в GitHub Secrets задан **`CORS_ORIGIN_0`** (например `https://yourdomain.com`), домен в конфиге уже подставлен; иначе замените в файле `YOUR_DOMAIN` на свой домен. Затем установите конфиг:

```bash
cd ~/cherryplay-deploy
sudo cp nginx-cherryplay-https.conf /etc/nginx/sites-available/cherryplay
# Если домен не был подставлен при деплое:
# sed 's/YOUR_DOMAIN/yourdomain.com/g' nginx-cherryplay-https.conf | sudo tee /etc/nginx/sites-available/cherryplay > /dev/null
sudo ln -sf /etc/nginx/sites-available/cherryplay /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx
```

#### 5. CORS для HTTPS

В GitHub Secrets задайте origins с протоколом **https**:

| Секрет          | Значение (пример)            |
| --------------- | ---------------------------- |
| `CORS_ORIGIN_0` | `https://yourdomain.com`     |
| `CORS_ORIGIN_1` | `https://www.yourdomain.com` |

При следующем деплое бэкенд будет отдавать эти origins в заголовках CORS. Если деплоите вручную, добавьте те же значения в `~/cherryplay-deploy/.env` или `.env.production` и перезапустите контейнеры.

#### 6. Автообновление сертификатов

```bash
sudo certbot renew --dry-run
```

Таймер `certbot.timer` обычно уже настроен (`sudo systemctl status certbot.timer`).

### Если Nginx и Docker оба претендуют на порт 80

По умолчанию контейнер `web` публикует порт `80:80`. Внешний Nginx на хосте должен проксировать на тот же порт. Если вы хотите, чтобы Nginx слушал 80 на хосте, измените в `docker-compose.prod.yml` маппинг для сервиса `web` на другой порт, например:

```yaml
web:
  ports:
    - "8080:80"
```

Тогда в конфиге Nginx замените `proxy_pass http://127.0.0.1:80` на `proxy_pass http://127.0.0.1:8080`. Конфиг-пример в репозитории рассчитан на вариант `80:80`.

## Дополнительные настройки

### Использование собственного Docker Registry

Если вы используете собственный Docker Registry вместо GHCR:

1. Обновите `REGISTRY` в workflows
2. Добавьте секрет `REGISTRY_USERNAME` и `REGISTRY_PASSWORD`
3. Обновите логин в workflows

## Поддержка

При возникновении проблем:

1. Проверьте логи GitHub Actions
2. Проверьте логи на сервере
3. Убедитесь, что все секреты настроены правильно
4. Проверьте документацию GitHub Actions и Docker
