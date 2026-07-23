# Быстрый старт

## Запуск с Docker (рекомендуется)

Самый простой способ поднять сервер и веб-приложение:

```bash
docker-compose up -d
```

После запуска доступны:

- **Сервер (API):** http://localhost:5000
- **Веб-приложение:** http://localhost:3000
- **Swagger:** http://localhost:5000/swagger
- **pgAdmin:** http://localhost:5050 (при наличии в docker-compose)

Подробнее: [README.md](./README.md#docker).

## Ручной запуск (локальная разработка)

### 1. Запуск сервера (CherryPlayServer)

Из корня репозитория (опционально): `dotnet build CherryPlay.sln`. Затем:

```bash
cd CherryPlayServer
dotnet restore   # при необходимости
dotnet run
```

Сервер: http://localhost:5000

### 2. Запуск веб-приложения (CherryPlayWeb)

```bash
cd CherryPlayWeb
npm install
npm run dev
```

Веб-приложение: http://localhost:3000

### 3. Запуск десктопного приложения (CherryPlayList)

```bash
cd CherryPlayList
npm install
npm run electron:dev
```

Приложение организатора (Electron + Vite). URL сервера задаётся в настройках или в `serverConfig.development.json` / `serverConfig.production.json` (например, `http://localhost:5000`). Подробнее: [DEV_SETUP.md](./DEV_SETUP.md).

## Что делает приложение

- **Сервер** — REST API для плейлистов и вечеринок, SignalR Hub для трансляции состояния.
- **Веб-приложение** — просмотр плейлиста и состояния вечеринки (каталог и страница по shortCode).
- **CherryPlayList** — создание вечеринок, управление эфиром, трансляция состояния на сервер.

Полный список API и контрактов: [CONTRACTS.md](./CONTRACTS.md). Кратко по эндпоинтам: [CherryPlayServer/README.md](./CherryPlayServer/README.md). SignalR Hub: `{baseUrl}/partyHub`, методы и события — в [CONTRACTS.md](./CONTRACTS.md) §2–3.

## Сборка компонентов

Для сборки библиотеки CherryPlayComponents (нужна для CherryPlayList и CherryPlayWeb):

```bash
# PowerShell
.\build-components.ps1

# CMD
build-components.bat

# Или вручную
cd CherryPlayComponents
npm install
npm run build
```

Подробнее: [SCRIPTS.md](./SCRIPTS.md).
