# CherryPlay

Монорепозиторий для проекта CherryPlay - системы управления плейлистами и синхронизации воспроизведения.

## Проекты

- **CherryPlayList** - Desktop приложение на Electron для создания и управления плейлистами
- **CherryPlayComponents** - React компоненты и темы для отображения плейлистов
- **CherryPlayServer** - Backend сервер на .NET для синхронизации воспроизведения
- **CherryPlayWeb** - Web приложение для просмотра плейлистов

## Быстрый старт

### 🐳 Запуск с Docker (рекомендуется)

Docker Compose автоматически соберёт образы и запустит все сервисы:

```bash
# Запуск всех сервисов (автоматически соберет образы при первом запуске)
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка всех сервисов
docker-compose down
```

После запуска будут доступны:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Swagger UI**: http://localhost:5000/swagger
- **pgAdmin**: http://localhost:5050
- **PostgreSQL**: localhost:5433

Подробнее см. раздел [Docker](#docker) ниже.

### 💻 Локальная разработка (без Docker)

Если вы хотите запускать проекты локально без Docker:

**Сервер (.NET):**
```bash
cd CherryPlayServer
dotnet run
```

**Веб-приложение (React):**
```bash
cd CherryPlayWeb
npm install
npm run dev
```

**Десктопное приложение (CherryPlayList):**
```bash
cd CherryPlayList
npm install
npm run electron:dev
```

**Компоненты (для разработки):**
```bash
cd CherryPlayComponents
npm install
npm run build
```

**Требования для локального запуска:**
- Node.js установлен
- .NET 9.0 SDK установлен
- PostgreSQL установлен и запущен (или используйте Docker только для БД)

Подробнее см. `QUICK_START.md`

## Документация

- [DEV_SETUP.md](DEV_SETUP.md) — настройка окружения для разработки (порядок запуска, переменные)
- [RELEASE_PLAN.md](RELEASE_PLAN.md) — план релиза v1, границы MVP, архитектура
- [CONTRACTS.md](CONTRACTS.md) — REST API, SignalR Hub, DTO (Public и Organizer)
- [GLOSSARY.md](GLOSSARY.md) — глоссарий терминов (shortCode, partyId, organizer, viewer и др.)
- [QUICK_START.md](QUICK_START.md) — быстрый старт (локальная разработка)
- [SCRIPTS.md](SCRIPTS.md) — скрипты для сборки компонентов
- [THEMES.md](THEMES.md) — документация по темам оформления
- [ADDING_THEME.md](ADDING_THEME.md) — инструкция по добавлению новой темы
- [`.github/DEPLOYMENT.md`](.github/DEPLOYMENT.md) — документация по деплою (GitHub Secrets, автоматический деплой, ручной деплой, откат)
- **CherryPlayList:** [docs/README.md](CherryPlayList/docs/README.md) — оглавление документации приложения
  - [QUICK_START_BUILD.md](CherryPlayList/QUICK_START_BUILD.md) — быстрый старт сборки релиза
- **Интеграция (общая):** [docs/integration/](docs/integration/) — подсистемы приложение–сервер–веб (Accounts & Auth, Party Management, Streaming, Data and Contracts)
- **CherryPlayServer:** [API.md](CherryPlayServer/API.md) (указатель на CONTRACTS), [OPS.md](CherryPlayServer/OPS.md), [DATABASE.md](CherryPlayServer/DATABASE.md)
- **CherryPlayWeb:** [README.md](CherryPlayWeb/README.md), [ENV.md](CherryPlayWeb/ENV.md), [docs/pages.md](CherryPlayWeb/docs/pages.md)
- **CherryPlayComponents:** [README.md](CherryPlayComponents/README.md)

## Структура

```
CherryPlay/
├── CherryPlayList/        # Desktop приложение (Electron + React)
├── CherryPlayComponents/  # React компоненты библиотека
├── CherryPlayServer/     # Backend сервер (.NET)
├── CherryPlayWeb/        # Web приложение (React)
├── docs/                  # Документация по интеграции
│   └── integration/       # Подсистемы интеграции (Accounts & Auth, Party Management, Streaming)
├── CONTRACTS.md          # Контракты API, SignalR и DTO для всех частей
├── RELEASE_PLAN.md       # План релиза v1
├── GLOSSARY.md           # Глоссарий терминов
├── THEMES.md             # Документация по темам
├── ADDING_THEME.md       # Инструкция по добавлению новой темы
├── QUICK_START.md        # Быстрый старт (локальная разработка)
├── DEV_SETUP.md          # Настройка окружения для разработки
├── SCRIPTS.md            # Скрипты для сборки компонентов
├── docker-compose.yml    # Docker Compose для production
├── docker-compose.debug.yml  # Docker Compose для отладки
└── README.md             # Этот файл
```

## Требования

- **Node.js** - для сборки и запуска веб-приложений и компонентов
- **.NET 9.0 SDK** - для сборки и запуска сервера

## Docker

### Основные команды

```bash
# Запуск всех сервисов (автоматически соберет образы при первом запуске)
docker-compose up -d

# Принудительная пересборка образов
docker-compose build
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f server
docker-compose logs -f web

# Остановка всех сервисов
docker-compose down

# Остановка с удалением volumes (удалит данные БД)
docker-compose down -v
```

### Доступ к сервисам

После запуска `docker-compose up -d` будут доступны:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Swagger UI**: http://localhost:5000/swagger
- **pgAdmin**: http://localhost:5050
  - Email: `admin@cherryplay.com`
  - Password: `admin`
- **PostgreSQL**: localhost:5433 (внешний порт, внутри контейнера 5432)

### Подключение к PostgreSQL через pgAdmin

1. Откройте http://localhost:5050
2. Войдите с учетными данными выше
3. Добавьте новый сервер:
   - **Name**: CherryPlay DB
   - **Host**: `postgres`
   - **Port**: `5432`
   - **Database**: `cherryplay`
   - **Username**: `cherryplay`
   - **Password**: `cherryplay_password`

### Переменные окружения

Для изменения настроек создайте файл `.env` в корне проекта:

```env
# PostgreSQL
POSTGRES_DB=cherryplay
POSTGRES_USER=cherryplay
POSTGRES_PASSWORD=your_secure_password

# pgAdmin
PGADMIN_EMAIL=admin@cherryplay.com
PGADMIN_PASSWORD=your_admin_password

# Backend
ASPNETCORE_ENVIRONMENT=Production
```

### Сборка образов

**Примечание:** `docker-compose up` автоматически соберет образы при первом запуске. Ручная сборка нужна только при изменении Dockerfile или для принудительной пересборки:

```bash
# Сборка всех образов
docker-compose build

# Сборка конкретного сервиса
docker-compose build server
docker-compose build web

# Сборка без кэша (для полной пересборки)
docker-compose build --no-cache
```

### Отладка сервера в Docker

**Важно:** Для полноценной отладки с точками останова рекомендуется запускать сервер локально через `dotnet run` (см. [QUICK_START.md](QUICK_START.md) или [DEV_SETUP.md](DEV_SETUP.md)). Docker debug режим подходит для тестирования в контейнере и hot reload.

Для отладки .NET сервера в контейнере используйте специальную конфигурацию:

```bash
# Запуск в режиме отладки (с hot reload)
docker-compose -f docker-compose.debug.yml up

# Или в фоновом режиме
docker-compose -f docker-compose.debug.yml up -d

# Просмотр логов
docker-compose -f docker-compose.debug.yml logs -f server

# Остановка debug контейнеров
docker-compose -f docker-compose.debug.yml down
```

**Особенности debug режима:**
- Используется `Development` окружение вместо `Production`
- Исходники монтируются через volume для hot reload (изменения кода применяются автоматически)
- Открыт порт `5678` для подключения отладчика (VS Code)
- Используется `dotnet watch` для автоматической пересборки при изменениях
- Веб-приложение также доступно (http://localhost:3000)

**Подключение отладчика VS Code:**

1. Установите расширение "C# Dev Kit" или "C# for Visual Studio Code"
2. Конфигурация уже добавлена в `.vscode/launch.json` (`.NET Core Attach (Docker)`)
3. Запустите контейнер: `docker-compose -f docker-compose.debug.yml up`
4. В VS Code:
   - Нажмите F5 или откройте панель Debug
   - Выберите конфигурацию ".NET Core Attach (Docker)"
   - При запросе выберите процесс `dotnet` в контейнере
   - Установите точки останова в коде

**Альтернатива:** Для простой отладки без attach можно использовать логи и точки останова через `Console.WriteLine` или логирование.

### Отдельные Dockerfile

Каждый сервис имеет свой Dockerfile:
- `CherryPlayServer/Dockerfile` - .NET 9.0 приложение
- `CherryPlayWeb/Dockerfile` - React приложение с Nginx

## Разработка

Каждый проект имеет свой собственный `package.json` и может быть запущен независимо. Для разработки в монорепозитории используйте локальные пути и TypeScript path mapping.

Подробная документация по каждому проекту находится в соответствующих папках:
- `CherryPlayList/README.md` - документация Desktop приложения
- `CherryPlayComponents/README.md` - документация компонентов
- `CherryPlayServer/README.md` - документация сервера
- `CherryPlayWeb/README.md` - документация веб-приложения

**Контракты** (REST API, SignalR Hub, DTO) между всеми частями проекта описаны в [`CONTRACTS.md`](CONTRACTS.md).

## CI/CD и Деплой

Проект настроен для автоматической сборки Docker образов и деплоя через GitHub Actions.

**Основные возможности:**
- 🔄 Автоматическая сборка образов при изменениях в коде
- 🏷️ Версионирование образов через GitHub Releases
- 🚀 Автоматический деплой на сервер при создании релиза
- 🔙 Возможность отката на предыдущую версию

**Быстрый старт:**
1. Настройте GitHub Secrets (см. `.github/DEPLOYMENT.md`)
2. Создайте тег: `git tag v1.0.0 && git push origin v1.0.0`
3. Создайте Release в GitHub - деплой запустится автоматически

Подробная документация: `.github/DEPLOYMENT.md`

