# Переменные окружения (CherryPlay)

Справочник по переменным окружения, используемым в репозитории CherryPlay. Скопируйте [.env.example](.env.example) в `.env` или `.env.development` / `.env.production` и заполните значения. **Никогда не коммитьте реальные секреты.**

---

## Список переменных


| Имя                                      | Назначение                                                       | Где используется                                                                          | Значение по умолчанию (dev)                         | Замечание для prod                              | Безопасность                       |
| ---------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- | ---------------------------------- |
| **VERSION**                              | Тег образа Docker (напр. `latest`, `1.0.0`)                      | deploy.sh, docker-compose.prod.yml                                                        | `latest`                                            | Задаётся из тега релиза в GitHub Actions        | Не секрет                          |
| **REGISTRY**                             | Хост реестра контейнеров                                         | deploy.sh, docker-compose.prod.yml                                                        | `ghcr.io`                                           | Обычно `ghcr.io`                                | Не секрет                          |
| **IMAGE_NAME_SERVER**                    | Имя образа сервера (напр. `owner/repo/server`)                   | deploy.sh, docker-compose.prod.yml                                                        | `owner/repo/server`                                 | Задаётся из репо в CI                           | Не секрет                          |
| **IMAGE_NAME_WEB**                       | Имя образа веб-приложения (напр. `owner/repo/web`)               | deploy.sh, docker-compose.prod.yml                                                        | `owner/repo/web`                                    | Задаётся из репо в CI                           | Не секрет                          |
| **GHCR_TOKEN**                           | Токен аутентификации GitHub Container Registry для `docker pull` | deploy.sh, GitHub Actions (release-and-deploy)                                            | —                                                   | Задаётся в GitHub Secrets; не в .env            | **Секрет** — никогда не коммитить  |
| **POSTGRES_DB**                          | Имя базы данных PostgreSQL                                       | docker-compose (сервис postgres)                                                          | `cherryplay`                                        | Часто `cherryplay`; можно переопределить        | Не секрет                          |
| **POSTGRES_USER**                        | Имя пользователя PostgreSQL                                      | docker-compose (сервис postgres)                                                          | `cherryplay`                                        | Задайте надёжного пользователя в prod           | Не секрет                          |
| **POSTGRES_PASSWORD**                    | Пароль PostgreSQL                                                | docker-compose, deploy.sh                                                                 | `cherryplay_password` / из .env.development.example | Задаётся в GitHub Secrets                       | **Секрет** — никогда не коммитить  |
| **PGADMIN_EMAIL**                        | Email для входа в pgAdmin                                        | docker-compose (pgadmin), deploy.sh                                                       | `admin@cherryplay.com`                              | Задаётся в GitHub Secrets                       | Секрет (логин)                     |
| **PGADMIN_PASSWORD**                     | Пароль входа в pgAdmin                                           | docker-compose (pgadmin), deploy.sh                                                       | `admin`                                             | Задаётся в GitHub Secrets                       | **Секрет** — никогда не коммитить  |
| **JWT_SECRET_KEY**                       | Секретный ключ для подписи JWT (мин. 32 символа)                 | Backend, docker-compose.prod.yml, deploy.sh, GitHub Actions                               | `dev-secret-key-...` (см. .env.development.example) | Задаётся в GitHub Secrets; должен быть надёжным | **Секрет** — никогда не коммитить  |
| **JWT_ISSUER**                           | Claim issuer для JWT                                             | Backend                                                                                   | `CherryPlayServer`                                  | То же или ваш issuer                            | Не секрет                          |
| **JWT_AUDIENCE**                         | Claim audience для JWT                                           | Backend                                                                                   | `CherryPlayClient`                                  | То же или ваша audience                         | Не секрет                          |
| **OAUTH_REDIRECT_BASE_URL**              | Базовый URL для OAuth callback                                   | Backend                                                                                   | `http://localhost:5000`                             | Напр. `https://yourdomain.com`                  | Не секрет                          |
| **OAUTH_VK_CLIENT_ID**                   | Client ID приложения VK OAuth                                    | Backend, deploy.sh, GitHub Actions                                                        | Пусто или заглушка                                  | Задаётся в GitHub Secrets                       | Секрет (учётные данные приложения) |
| **OAUTH_VK_CLIENT_SECRET**               | Client secret приложения VK OAuth                                | Backend, deploy.sh, GitHub Actions                                                        | Пусто или заглушка                                  | Задаётся в GitHub Secrets                       | **Секрет** — никогда не коммитить  |
| **OAUTH_MAILRU_CLIENT_ID**               | Client ID OAuth Mail.ru                                          | Backend                                                                                   | Пусто или заглушка                                  | Задаётся в GitHub Secrets / .env.production     | Секрет (учётные данные приложения) |
| **OAUTH_MAILRU_CLIENT_SECRET**           | Client secret OAuth Mail.ru                                      | Backend                                                                                   | Пусто или заглушка                                  | Задаётся в GitHub Secrets / .env.production     | **Секрет** — никогда не коммитить  |
| **OAUTH_TELEGRAM_BOT_TOKEN**             | Токен бота Telegram для входа                                    | Backend                                                                                   | Пусто или заглушка                                  | Задаётся в GitHub Secrets / .env.production     | **Секрет** — никогда не коммитить  |
| **ConnectionStrings__DefaultConnection** | Строка подключения EF Core к PostgreSQL                          | Backend (локальный запуск), docker-compose                                                | `Host=localhost;Port=5433;...` (см. .env.example)   | В Docker собирается из POSTGRES_*               | **Секрет**, если содержит пароль   |
| **CORS_ORIGIN_0**                        | Первый разрешённый CORS origin                                   | Backend (через Cors:AllowedOrigins:0), docker-compose.prod.yml, deploy.sh, GitHub Actions | `http://localhost:3000`                             | Напр. `https://yourdomain.com`                  | Не секрет                          |
| **CORS_ORIGIN_1**                        | Второй разрешённый CORS origin                                   | Backend (через Cors:AllowedOrigins:1), docker-compose.prod.yml, deploy.sh, GitHub Actions | `http://localhost:5173`                             | Напр. `https://www.yourdomain.com`              | Не секрет                          |
| **CORS_ORIGIN_2**                        | Третий разрешённый CORS origin                                   | Backend (через Cors:AllowedOrigins:2), docker-compose.prod.yml                            | `http://web:80`                                     | Часто `http://web:80` для nginx                 | Не секрет                          |
| **VITE_API_URL**                         | Базовый URL API бэкенда (подставляется при сборке)               | Frontend (Vite), Dockerfile CherryPlayWeb                                                 | `http://localhost:5000`                             | Пусто для относительных URL за nginx            | Не секрет                          |
| **VITE_SIGNALR_URL**                     | URL хаба SignalR (опционально; иначе VITE_API_URL + `/partyHub`) | Frontend (Vite), Dockerfile CherryPlayWeb                                                 | `http://localhost:5000/partyHub`                    | Опционально в prod                              | Не секрет                          |


---

## Маппинг для бэкенда (ASP.NET Core)

Бэкенд читает конфигурацию из переменных окружения (и appsettings). Двойное подчёркивание `__` в переменной окружения соответствует `:` в IConfiguration.


| Переменная окружения                                       | Ключ IConfiguration / использование                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **JWT_SECRET_KEY**                                         | `Configuration["JWT_SECRET_KEY"]`                                                                                              |
| **JWT_ISSUER**                                             | `Configuration["JWT_ISSUER"]`                                                                                                  |
| **JWT_AUDIENCE**                                           | `Configuration["JWT_AUDIENCE"]`                                                                                                |
| **CORS_ORIGIN_0**, **CORS_ORIGIN_1**, **CORS_ORIGIN_2**    | `Cors:AllowedOrigins:0`, `:1`, `:2` — в docker-compose.prod.yml задаётся как `Cors__AllowedOrigins__0=${CORS_ORIGIN_0}` и т.д. |
| **ConnectionStrings__DefaultConnection**                   | `ConnectionStrings:DefaultConnection` (EF Core)                                                                                |
| **OAUTH_REDIRECT_BASE_URL**                                | `Configuration["OAUTH_REDIRECT_BASE_URL"]`                                                                                     |
| **OAUTH_VK_CLIENT_ID**, **OAUTH_VK_CLIENT_SECRET**         | `Configuration["OAUTH_VK_CLIENT_ID"]`, `Configuration["OAUTH_VK_CLIENT_SECRET"]`                                               |
| **OAUTH_MAILRU_CLIENT_ID**, **OAUTH_MAILRU_CLIENT_SECRET** | `Configuration["OAUTH_MAILRU_CLIENT_ID"]`, `Configuration["OAUTH_MAILRU_CLIENT_SECRET"]`                                       |
| **OAUTH_TELEGRAM_BOT_TOKEN**                               | `Configuration["OAUTH_TELEGRAM_BOT_TOKEN"]`                                                                                    |


---

## Разработка и продакшен

### Разработка

- Используйте `**.env.development`** в корне репозитория (или `.env`). Скопируйте из [.env.example](.env.example) или [.env.development.example](.env.development.example).
- **Бэкенд:** опциональные скрипты [run-dev.sh](run-dev.sh) / [run-dev.ps1](run-dev.ps1) подгружают переменные окружения и запускают сервер.
- **Фронтенд:** Vite читает переменные из **корня репозитория** через `envDir` в [CherryPlayWeb/vite.config.ts](CherryPlayWeb/vite.config.ts); используйте `VITE_API_URL` и при необходимости `VITE_SIGNALR_URL`.
- Никогда не коммитьте реальные секреты; храните dev JWT и пароли БД локально.

### Продакшен

- Используйте `**.env.production`** на целевом сервере или передавайте значения через **GitHub Secrets** (рекомендуется для deploy.sh).
- **deploy.sh** собирает `.env` из `VERSION`, `REGISTRY`, `IMAGE_`*, затем дополняет из `.env.production`, если файл есть, затем переопределяет секретами из CI (JWT_SECRET_KEY, POSTGRES_PASSWORD, CORS_ORIGIN_* и т.д.). См. [scripts/deploy.sh](scripts/deploy.sh).
- **GitHub Actions** ([release-and-deploy.yml](.github/workflows/release-and-deploy.yml)) передают секреты в шаг деплоя; **GHCR_TOKEN** задаётся в GitHub Secrets (или используется `github.token`) для загрузки образов.
- **Никогда не коммитьте** реальный `.env.production` с секретами; используйте Secrets и при необходимости несекретный `.env.production` для значений по умолчанию.

