# Первый деплой

Пошаговая инструкция для первого выката CherryPlay на сервер. Подробности — в [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. Подготовка

### 1.1. GitHub Secrets

В репозитории: **Settings → Secrets and variables → Actions**. Добавьте:

| Секрет | Значение |
|--------|----------|
| `SSH_PRIVATE_KEY` | Приватный SSH-ключ для доступа к серверу |
| `DEPLOY_HOST` | IP или домен сервера |
| `DEPLOY_USER` | Пользователь SSH (например `deploy`, `ubuntu`) |
| `JWT_SECRET_KEY` | Не менее 32 символов |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `GHCR_TOKEN` | PAT с правом `read:packages` (для публичного репо можно не задавать) |

Для HTTPS с первого дня добавьте:

| Секрет | Значение (пример) |
|--------|--------------------|
| `CORS_ORIGIN_0` | `https://yourdomain.com` |
| `CORS_ORIGIN_1` | `https://www.yourdomain.com` |

Публичный ключ от `SSH_PRIVATE_KEY` должен быть добавлен на сервер (`~/.ssh/authorized_keys` пользователя `DEPLOY_USER`).

### 1.2. Сервер

- Установлены Docker и Docker Compose (см. [DEPLOYMENT.md — Настройка сервера](DEPLOYMENT.md#4-настройка-сервера)).
- Создана директория: `mkdir -p ~/cherryplay-deploy`
- Для приватного репо: настроен доступ к GHCR на сервере.

---

## 2. Запуск первого деплоя

1. Создайте тег и запушьте:
   ```bash
   git tag -a v1.0.0 -m "Release 1.0.0"
   git push origin v1.0.0
   ```

2. В GitHub: **Releases → Create a new release** → выберите тег `v1.0.0` → **Publish release**.

3. Дождитесь окончания workflow **Release and Deploy** в **Actions**.

---

## 3. Проверка после деплоя

На сервере:

```bash
ssh <DEPLOY_USER>@<DEPLOY_HOST>
cd ~/cherryplay-deploy
docker compose -f docker-compose.prod.yml ps
```

Должны быть в состоянии **Up**: `cherryplay-server`, `cherryplay-web`, `cherryplay-postgres`.

Проверьте доступность:

- Сайт: `http://<DEPLOY_HOST>` (или по домену, если DNS уже указывает на сервер)
- API: `http://<DEPLOY_HOST>:5000/api/health`

При ошибках: `docker compose -f docker-compose.prod.yml logs -f server`

---

## 4. HTTPS (однократно)

Если нужен HTTPS, выполните на сервере один раз.

### 4.1. Nginx и Certbot

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 4.2. Получение сертификата

Подставьте свой домен и email. Порт 80 должен быть свободен — контейнер `web` временно останавливаем:

```bash
cd ~/cherryplay-deploy
docker compose -f docker-compose.prod.yml stop web

sudo certbot certonly --standalone -d YOUR_DOMAIN -d www.YOUR_DOMAIN --non-interactive --agree-tos -m admin@YOUR_DOMAIN

docker compose -f docker-compose.prod.yml start web
```

### 4.3. Установка конфига Nginx

В `~/cherryplay-deploy/` после деплоя лежит `nginx-cherryplay-https.conf`. Если задан `CORS_ORIGIN_0`, домен в файле уже подставлен; иначе замените в нём `YOUR_DOMAIN` на свой домен.

```bash
cd ~/cherryplay-deploy
sudo cp nginx-cherryplay-https.conf /etc/nginx/sites-available/cherryplay
sudo ln -sf /etc/nginx/sites-available/cherryplay /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx
```

### 4.4. Проверка HTTPS

Откройте `https://<ваш-домен>`. Убедитесь, что сайт открывается, нет ошибок CORS и авторизация работает.

---

## 5. Дальше

- Следующие релизы: новый тег → новый Release → деплой выполнится автоматически.
- После повторных деплоев конфиг в `~/cherryplay-deploy/nginx-cherryplay-https.conf` обновляется; при необходимости скопируйте его в `/etc/nginx/sites-available/cherryplay` и выполните `sudo nginx -t && sudo systemctl reload nginx`.
- Откат: [DEPLOYMENT.md — Откат на предыдущую версию](DEPLOYMENT.md#откат-на-предыдущую-версию).
