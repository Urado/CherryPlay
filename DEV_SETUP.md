# Настройка окружения для разработки CherryPlay

Как поднять весь стек (сервер, веб-клиент, десктопное приложение) для локальной разработки.

## Требования

- **.NET 9.0 SDK** (или выше) — для CherryPlayServer
- **Node.js** (LTS) и **npm** — для CherryPlayWeb и CherryPlayList
- **Electron** собирается в рамках CherryPlayList (отдельная установка не нужна)

## Порядок запуска

1. **Сервер** — должен быть запущен первым, чтобы веб и приложение могли к нему подключаться.
2. **Веб-клиент** (опционально) — для проверки страницы зрителя.
3. **CherryPlayList** — приложение организатора (может работать с уже запущенным сервером).

## 1. CherryPlayServer

```bash
cd CherryPlayServer
dotnet run
```

- Сервер будет доступен по адресу **http://localhost:5000**
- Hub: **http://localhost:5000/partyHub**
- В режиме по умолчанию используется InMemory хранилище и тестовые данные (см. [CherryPlayServer/README.md](CherryPlayServer/README.md))
  > **Примечание:** Это временное состояние для разработки. По плану релиза v1 (Epic A) будет реализована персистентная БД PostgreSQL.

## 2. CherryPlayWeb

```bash
cd CherryPlayWeb
npm install
npm run dev
```

- Приложение будет доступно по адресу **http://localhost:3000**
- По умолчанию подключается к серверу на `http://localhost:5000` (см. раздел «Переменные окружения» ниже)

## 3. CherryPlayList (Electron)

```bash
cd CherryPlayList
npm install
npm run dev
```

- Запускается Vite (http://localhost:5173) и Electron
- URL сервера задаётся в настройках приложения или через `serverConfig.json` в корне проекта (ключ `serverUrl`), либо через переменную окружения `VITE_API_URL` при сборке

### Настройка URL сервера в CherryPlayList

- **Через приложение**: Настройки → указать адрес сервера (например, `http://localhost:5000`)
- **Через конфиг**: в корне CherryPlayList создать/изменить `serverConfig.json`: `{ "serverUrl": "http://localhost:5000" }`
- **Через переменную окружения**: при сборке/запуске задать `VITE_API_URL=http://localhost:5000`

## Переменные окружения (сводка)

| Переменная | Проект | Описание |
|------------|--------|----------|
| `VITE_API_URL` | CherryPlayWeb | Базовый URL API сервера (по умолчанию подставляется при сборке; для dev часто задаётся в `.env`). Пример: `http://localhost:5000` |
| `VITE_API_URL` | CherryPlayList | URL сервера (при сборке; иначе используется serverConfig.json или настройки в UI) |

## Проверка связки

1. Запустить **CherryPlayServer**.
2. Запустить **CherryPlayWeb**, открыть http://localhost:3000 — должна отображаться страница каталога или демо-плейлист (в зависимости от реализации).
3. Запустить **CherryPlayList**, создать вечеринку (Party workspace), получить shortCode/URL — открыть этот URL в браузере (через CherryPlayWeb с параметром `?party=<shortCode>` или будущий маршрут `party/<shortCode>`).

## Документация

- [RELEASE_PLAN.md](RELEASE_PLAN.md) — план релиза v1, границы и архитектура
- [CONTRACTS.md](CONTRACTS.md) — REST API и SignalR контракты
- [docs/integration/README.md](docs/integration/README.md) — подсистемы интеграции приложение–сервер–веб
