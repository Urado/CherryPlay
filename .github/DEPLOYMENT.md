# Настройка CI/CD для CherryPlay

Этот документ описывает настройку автоматической сборки Docker образов и деплоя на сервер через GitHub Actions.

## Архитектура

1. **Build Workflow** (`build-images.yml`) - автоматически собирает образы при изменениях в коде
2. **Release Workflow** (`release-and-deploy.yml`) - собирает образы с тегами версий и деплоит на сервер при создании релиза

## Предварительные требования

### 1. GitHub Container Registry (GHCR)

GitHub Container Registry уже настроен и доступен автоматически. Образы будут публиковаться в:
- `ghcr.io/<owner>/<repo>/server`
- `ghcr.io/<owner>/<repo>/web`

### 2. Настройка GitHub Secrets

Перейдите в Settings → Secrets and variables → Actions и добавьте следующие секреты:

#### Для деплоя (SSH):
- `SSH_PRIVATE_KEY` - приватный SSH ключ для доступа к серверу
- `DEPLOY_HOST` - IP адрес или доменное имя сервера (например: `192.168.1.100` или `deploy.example.com`)
- `DEPLOY_USER` - имя пользователя для SSH подключения (например: `deploy` или `ubuntu`)

#### Опционально:
- `GHCR_TOKEN` - персональный токен доступа GitHub (PAT) с правами `write:packages`. 
  - Если репозиторий публичный, можно использовать `GITHUB_TOKEN` (уже доступен автоматически)
  - Если репозиторий приватный, нужен PAT с правами `read:packages` и `write:packages`

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

#### Создание файла `.env.production` (опционально)

Создайте файл `~/cherryplay-deploy/.env.production` с настройками для продакшена:

```env
# PostgreSQL
POSTGRES_PASSWORD=your_secure_password_here

# pgAdmin
PGADMIN_EMAIL=admin@yourdomain.com
PGADMIN_PASSWORD=your_admin_password

# CORS
CORS_ORIGIN_0=https://yourdomain.com
CORS_ORIGIN_1=https://www.yourdomain.com

# API URLs (если нужны)
VITE_API_URL=https://api.yourdomain.com/api
VITE_SIGNALR_URL=https://api.yourdomain.com/partyHub
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
    build-images.yml          # Автоматическая сборка при изменениях
    release-and-deploy.yml     # Сборка и деплой при релизе
scripts/
  deploy.sh                    # Скрипт деплоя на сервере
docker-compose.prod.yml        # Docker Compose для продакшена
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
5. **Используйте HTTPS для продакшена (настройте reverse proxy)**

## Дополнительные настройки

### Использование собственного Docker Registry

Если вы используете собственный Docker Registry вместо GHCR:

1. Обновите `REGISTRY` в workflows
2. Добавьте секрет `REGISTRY_USERNAME` и `REGISTRY_PASSWORD`
3. Обновите логин в workflows

### Настройка reverse proxy (Nginx/Traefik)

Для продакшена рекомендуется использовать reverse proxy:

```nginx
# Пример конфигурации Nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
    }

    location /api {
        proxy_pass http://localhost:5000;
    }
}
```

## Поддержка

При возникновении проблем:
1. Проверьте логи GitHub Actions
2. Проверьте логи на сервере
3. Убедитесь, что все секреты настроены правильно
4. Проверьте документацию GitHub Actions и Docker
