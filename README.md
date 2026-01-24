# CherryPlay

Монорепозиторий для проекта CherryPlay - системы управления плейлистами и синхронизации воспроизведения.

## Проекты

- **CherryPlayList** - Desktop приложение на Electron для создания и управления плейлистами
- **CherryPlayComponents** - React компоненты и темы для отображения плейлистов
- **CherryPlayServer** - Backend сервер на .NET для синхронизации воспроизведения
- **CherryPlayWeb** - Web приложение для просмотра плейлистов

## Быстрый старт

### Запуск всех сервисов

```bash
# PowerShell
.\start-all.ps1

# CMD
start-all.bat
```

Скрипт автоматически запустит:
- CherryPlayServer (http://localhost:5000)
- CherryPlayWeb (http://localhost:3000)

### Сборка всех проектов

```bash
# PowerShell
.\build-all.ps1

# CMD
build-all.bat
```

Подробнее см. `QUICK_START.md` и `SCRIPTS.md`

## Структура

```
CherryPlay/
├── CherryPlayList/        # Desktop приложение (Electron + React)
├── CherryPlayComponents/  # React компоненты библиотека
├── CherryPlayServer/     # Backend сервер (.NET)
├── CherryPlayWeb/        # Web приложение (React)
├── build-all.ps1         # Скрипты сборки
├── start-all.ps1         # Скрипты запуска
└── README.md             # Этот файл
```

## Требования

- **Node.js** - для сборки и запуска веб-приложений и компонентов
- **.NET 9.0 SDK** - для сборки и запуска сервера

## Docker

### Быстрый запуск с Docker Compose

Для запуска всего стека (сервер, фронтенд, PostgreSQL и pgAdmin) используйте Docker Compose:

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка всех сервисов
docker-compose down

# Остановка с удалением volumes (удалит данные БД)
docker-compose down -v
```

После запуска будут доступны:
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

```bash
# Сборка всех образов
docker-compose build

# Сборка конкретного сервиса
docker-compose build server
docker-compose build web
```

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

