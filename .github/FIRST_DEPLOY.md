# Первый деплой

Пошаговая инструкция для первого выката CherryPlay на сервер. Подробности — в [DEPLOYMENT.md](DEPLOYMENT.md). Полный справочник переменных окружения (назначение, dev/prod, безопасность) — в [ENV.md](../ENV.md) в корне репозитория.

---

## 1. Подготовка

### 1.1. GitHub Secrets

В репозитории: **Settings → Secrets and variables → Actions**. Добавьте (полный список и описание — см. [ENV.md](../ENV.md)):

| Секрет              | Значение                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `SSH_PRIVATE_KEY`   | Приватный SSH-ключ для доступа к серверу                                                                          |
| `DEPLOY_HOST`       | IP или домен сервера                                                                                              |
| `DEPLOY_USER`       | Пользователь SSH (например `deploy`, `ubuntu`)                                                                    |
| `JWT_SECRET_KEY`    | Не менее 32 символов                                                                                              |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL                                                                                                 |
| `PGADMIN_EMAIL`     | Email для входа в pgAdmin (например `admin@yourdomain.com`). В контейнере передаётся как `PGADMIN_DEFAULT_EMAIL`. |
| `PGADMIN_PASSWORD`  | Пароль для входа в pgAdmin. В контейнере передаётся как `PGADMIN_DEFAULT_PASSWORD`.                               |
| `GHCR_TOKEN`        | PAT с правом `read:packages` (для публичного репо можно не задавать)                                              |

Миграции БД применяются автоматически при старте контейнера `cherryplay-server` (в коде сервера вызывается `db.Database.Migrate()`). Отдельный секрет для строки подключения не нужен: сервер подключается к PostgreSQL по внутренней Docker-сети (`postgres:5432`).

Для HTTPS с первого дня добавьте:

| Секрет          | Значение (пример)            |
| --------------- | ---------------------------- |
| `CORS_ORIGIN_0` | `https://yourdomain.com`     |
| `CORS_ORIGIN_1` | `https://www.yourdomain.com` |

Для входа через VK добавьте:

| Секрет                   | Значение                                      |
| ------------------------ | --------------------------------------------- |
| `OAUTH_VK_CLIENT_ID`     | ID приложения VK (из настройки приложения VK) |
| `OAUTH_VK_CLIENT_SECRET` | Защищённый ключ приложения VK                 |

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

Примечание по безопасности: в `docker-compose.prod.yml` pgAdmin по умолчанию публикуется только на `127.0.0.1:5050` (наружу не открыт). Для доступа используйте SSH-туннель с вашего компьютера на сервер.

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

sudo certbot certonly --standalone -d cherrypashkaparty.ru -d www.cherrypashkaparty.ru --non-interactive --agree-tos -m samurai-94@mail.ru

docker compose -f docker-compose.prod.yml start web
```

### 4.3. Установка конфига Nginx

**Сначала обязательно выполните п. 4.2** (certbot) — nginx не запустится без существующих сертификатов по путям из конфига.

В `~/cherryplay-deploy/` после деплоя лежит `nginx-cherryplay-https.conf`. Если задан `CORS_ORIGIN_0`, домен в файле уже подставлен; иначе замените в нём `YOUR_DOMAIN` на свой домен (тот же, для которого получен сертификат в 4.2).

```bash
cd ~/cherryplay-deploy
sudo cp nginx-cherryplay-https.conf /etc/nginx/sites-available/cherryplay
sudo ln -sf /etc/nginx/sites-available/cherryplay /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

**Если nginx не стартует** (`Job for nginx.service failed`), посмотрите причину:

```bash
sudo journalctl -xeu nginx.service
```

Чаще всего:

- **Сертификаты не найдены** — пути в конфиге вида `/etc/letsencrypt/live/<домен>/...` должны существовать. Сначала выполните п. 4.2 (certbot), затем снова копируйте конфиг и перезапускайте nginx.
- **В конфиге остался YOUR_DOMAIN** — замените на свой домен:  
  `sudo sed -i 's/YOUR_DOMAIN/cherrypashkaparty.ru/g' /etc/nginx/sites-available/cherryplay`
- **Порт 80 занят** (`Address already in use`) — контейнер `cherryplay-web` слушает 80, nginx тоже нужен 80. В репозитории веб уже настроен на `127.0.0.1:8080`, nginx проксирует на 8080. На сервере: обновите `docker-compose.prod.yml` (порт веба `127.0.0.1:8080:80`) и конфиг nginx (`proxy_pass http://127.0.0.1:8080;`), затем:
  ```bash
  cd ~/cherryplay-deploy
  docker compose -f docker-compose.prod.yml up -d --force-recreate web
  sudo systemctl start nginx
  ```

### 4.4. Проверка HTTPS

Откройте `https://<ваш-домен>`. Убедитесь, что сайт открывается, нет ошибок CORS и авторизация работает.

### 4.5. После передеплоя — снова подставить конфиг Nginx

Передеплой обновляет файл только в `~/cherryplay-deploy/`. Чтобы nginx использовал актуальный конфиг (в т.ч. проксирование на порт 8080), скопируйте его в nginx и перезапустите:

```bash
cd ~/cherryplay-deploy
sudo cp nginx-cherryplay-https.conf /etc/nginx/sites-available/cherryplay
# если в файле остался YOUR_DOMAIN:
sudo sed -i 's/YOUR_DOMAIN/cherrypashkaparty.ru/g' /etc/nginx/sites-available/cherryplay
sudo nginx -t && sudo systemctl reload nginx
```

**Если по адресу ничего нет (ни HTTP, ни HTTPS):**

1. **Проверить контейнеры и порт 8080:**

   ```bash
   cd ~/cherryplay-deploy
   docker compose -f docker-compose.prod.yml ps
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/
   ```

   Должны быть в Up: `cherryplay-web`, `cherryplay-server`; curl должен вернуть 200.

2. **Проверить, что nginx проксирует на 8080:**

   ```bash
   grep proxy_pass /etc/nginx/sites-available/cherryplay
   ```

   Должно быть `proxy_pass http://127.0.0.1:8080;`. Если там `:80` — скопируйте конфиг заново из п. 4.5 выше.

3. **Убрать дефолтный сайт nginx** (если запросы забирает он):

   ```bash
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **Открывать по домену:** в браузере именно `https://cherrypashkaparty.ru`, а не по IP — в конфиге стоит `server_name cherrypashkaparty.ru`.

---

## 5. Дальше

- Следующие релизы: новый тег → новый Release → деплой выполнится автоматически.
- После повторных деплоев конфиг nginx обновляется **скриптом деплоя** автоматически. Если что-то пошло не так — скопируйте вручную по п. 4.5.
- Откат: [DEPLOYMENT.md — Откат на предыдущую версию](DEPLOYMENT.md#откат-на-предыдущую-версию).
