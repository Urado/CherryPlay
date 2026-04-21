# Настройка CI/CD для CherryPlay

Этот документ описывает настройку автоматической сборки Docker образов и деплоя на сервер через GitHub Actions.

## Архитектура

1. **Build Workflow** (`build-images.yml`) - автоматически собирает образы при изменениях в коде
2. **Release Workflow** (`release-and-deploy.yml`) - собирает образы с тегами версий и деплоит на сервер при создании релиза

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

#### Опциональные (подставляются в docker-compose и CI/CD при деплое)

| Секрет                   | Описание                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `CORS_ORIGIN_0`          | Первый разрешённый origin (для HTTPS укажите `https://yourdomain.com`). По нему же при деплое подставляется домен в конфиг Nginx.  |
| `CORS_ORIGIN_1`          | Второй origin (например `https://www.yourdomain.com`)                                                                              |
| `OAUTH_VK_CLIENT_ID`     | ID приложения VK (для входа через VK)                                                                                              |
| `OAUTH_VK_CLIENT_SECRET` | Защищённый ключ приложения VK                                                                                                      |
| `GHCR_TOKEN`             | PAT с правами `read:packages` (и `write:packages` при сборке). Для публичного репо можно не задавать — используется `GITHUB_TOKEN` |

Миграции EF Core применяются при старте контейнера `server`: в коде вызывается `db.Database.Migrate()`, подключение к БД идёт по внутренней Docker-сети (`postgres:5432`). В `release-and-deploy.yml` при релизе принудительно выставляется `Database__AutoMigrateOnStartup=true`, чтобы накат миграций происходил автоматически.

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

При деплое через GitHub Actions секреты (`JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, `PGADMIN_EMAIL`, `PGADMIN_PASSWORD`, `CORS_ORIGIN_*`, `OAUTH_VK_CLIENT_ID`, `OAUTH_VK_CLIENT_SECRET`) берутся из GitHub Secrets и подставляются в `.env` на сервере. Полный справочник переменных — в корневом [ENV.md](../ENV.md). Если вы деплоите вручную или хотите запас на сервере, создайте `~/cherryplay-deploy/.env.production`:

```env
# Обязательно для работы сервера
JWT_SECRET_KEY=ваш_секрет_не_короче_32_символов

# PostgreSQL (должен совпадать с паролем при первом запуске контейнера postgres)
POSTGRES_PASSWORD=your_secure_password_here

# pgAdmin
PGADMIN_EMAIL=admin@yourdomain.com
PGADMIN_PASSWORD=your_admin_password

# CORS (разрешённые origins для фронта)
CORS_ORIGIN_0=https://yourdomain.com
CORS_ORIGIN_1=https://www.yourdomain.com

# VK OAuth (для входа через VK)
OAUTH_VK_CLIENT_ID=your_vk_app_id
OAUTH_VK_CLIENT_SECRET=your_vk_secure_key
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

3. **Автоматический процесс:**
   - GitHub Actions соберет образы с тегом версии
   - Образы будут опубликованы в GHCR
   - Автоматически запустится деплой на сервер
   - Старые контейнеры будут остановлены
   - Новые контейнеры будут запущены с новой версией

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
    build-images.yml              # Автоматическая сборка при изменениях
    release-and-deploy.yml        # Сборка и деплой при релизе
  FIRST_DEPLOY.md                 # Инструкция для первого деплоя
  nginx-cherryplay-https.conf    # Конфиг Nginx для HTTPS (копируется на сервер при деплое)
scripts/
  deploy.sh                       # Скрипт деплоя на сервере
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
