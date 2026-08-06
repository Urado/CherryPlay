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

### Переменные окружения для локальной разработки

- Скопируйте корневой **.env.example** (или **.env.development.example**) в **.env.development** и заполните значения.
- Чтобы запустить сервер с этими переменными:
  - **Вариант 1:** подгрузите их перед запуском, например: `source .env.development` (Bash), затем `cd CherryPlayServer && dotnet run`.
  - **Вариант 2:** используйте скрипты-лаунчеры из корня репозитория: **`./run-dev.sh`** (Linux/Mac) или **`.\run-dev.ps1`** (Windows). Они подхватят `.env.development` или `.env`, если файл есть, и запустят сервер; если файла нет — используется только appsettings (без ошибки).
  - **Вариант 3 (Docker debug):** `docker compose -f docker-compose.debug.yml up --build` — сервис `server` подключает корневой **`.env.development`** через `env_file` (включая `RUSENDER_*` для проверки писем).
- Конфигурация сервера по-прежнему берётся из appsettings.json и appsettings.Development.json; переменные окружения их переопределяют. Для локального запуска без Docker при использовании PostgreSQL задайте в .env.development **ConnectionStrings\_\_DefaultConnection** (подробнее см. [ENV.md](ENV.md)).
- Hub: **http://localhost:5000/partyHub**
- По умолчанию (`UseInMemoryStorage=false` в appsettings) — **EF Core + PostgreSQL** (нужна БД: Docker `postgres` или локальный Postgres). Опционально `UseInMemoryStorage=true` — in-memory репозитории без Postgres (данные только в процессе). Dual storage intentional — см. [ARCHITECTURE.md](ARCHITECTURE.md), [CherryPlayServer/README.md](CherryPlayServer/README.md).

#### Forgot password (Dev)

Локальная проверка сброса пароля без RuSender:

1. Задайте в `.env.development` **`PUBLIC_WEB_BASE_URL`** (для Web обычно `http://localhost:3000`). В Development при пустом значении сервер подставляет `http://localhost:3000`.
2. RuSender в Dev **не обязателен**: при отсутствии конфига (или сбое отправки) полный reset URL пишется в **лог** сервера; клиенту — **200** + generic RU-сообщение.
3. Откройте URL из лога → `/reset-password?token=…` на Web → новый пароль → вход.
4. Переменные почты / Prod-политика: [ENV.md](ENV.md). Smoke и домен RuSender: [CherryPlayServer/OPS.md](CherryPlayServer/OPS.md). Контракт: [CONTRACTS.md](CONTRACTS.md) §3.2.0a.

## 2. CherryPlayWeb

```bash
cd CherryPlayWeb
npm install
npm run dev
```

- Приложение будет доступно по адресу **http://localhost:3000**
- По умолчанию подключается к серверу на `http://localhost:5000` (см. раздел «Переменные окружения» ниже)
- Переменные окружения (VITE\_\*) читаются из **корня репозитория** (файлы `.env`, `.env.development`, `.env.production`). Создайте в корне `.env.development` из `.env.example` при необходимости (см. [ENV.md](ENV.md)).

**CSS примитивов:** в `src/main.tsx` импортируется `@cherryplay/components/styles/primitives.css` (палитра shell + стили `Button`/`Disclosure`/`Icon`). Без этого импорта shared UI в кабинете и на party-страницах не стилизуется. Подробнее — [CherryPlayComponents/README.md](CherryPlayComponents/README.md#подключение-css).

**Быстрая проверка / troubleshooting (`cp-button` выглядит "без стилей"):**

1. Убедитесь, что в `CherryPlayWeb/src/main.tsx` есть импорт `@cherryplay/components/styles/primitives.css` (до `./index.css`).
2. Перезапустите `npm run dev` в `CherryPlayWeb` после изменения импортов.
3. Если проблема осталась: откройте любой элемент с классом `cp-button` в DevTools и проверьте наличие CSS-переменных палитры (`--cp-*` / shell tokens) в computed styles.

## 3. CherryPlayList (Electron)

```bash
cd CherryPlayList
npm install
npm run dev
```

- Запускается Vite (http://localhost:5173) и Electron
- URL сервера задаётся в настройках приложения или через `serverConfig.development.json` / `serverConfig.production.json` (ключ `serverUrl`), либо через переменную окружения `VITE_API_URL` при сборке

**CSS примитивов:** в `src/styles/index.css` импортируется `@cherryplay/components/styles/primitives.css` (до локальных стилей). Этот файл уже включает shell palette tokens и стили `Button`/`Disclosure`/`Icon`. Без него модалки, заголовок и party editor не получат shared-токены и классы `cp-button` / `cp-disclosure`. Подробнее — [CherryPlayComponents/README.md](CherryPlayComponents/README.md#подключение-css).

**Быстрая проверка / troubleshooting (`cp-button` выглядит "без стилей"):**

1. Убедитесь, что в `CherryPlayList/src/styles/index.css` есть импорт `@cherryplay/components/styles/primitives.css`.
2. Проверьте, что этот импорт идёт до локальных файлов со стилями CherryPlayList.
3. Перезапустите `npm run dev` в `CherryPlayList` после изменения импортов.
4. Если проблема осталась: откройте любой элемент с классом `cp-button` в DevTools и проверьте наличие CSS-переменных палитры (`--cp-*` / shell tokens) в computed styles.

### Настройка URL сервера в CherryPlayList

- **Через приложение**: Настройки → указать адрес сервера (например, `http://localhost:5000`)
- **Через конфиг**: в корне CherryPlayList править `serverConfig.development.json` (dev) или `serverConfig.production.json` (релиз), например: `{ "serverUrl": "http://localhost:5000" }`
- **Через переменную окружения**: при сборке/запуске задать `VITE_API_URL=http://localhost:5000`

### Веб-демо в браузере

Два режима (подробности: [CherryPlayList/docs/web-demo.md](CherryPlayList/docs/web-demo.md)):

| Команда                | Режим                                                     | Сервер                      |
| ---------------------- | --------------------------------------------------------- | --------------------------- |
| `npm run dev:web`      | Fixtures — UI без Electron, party/auth на фикстурах       | Не нужен                    |
| `npm run dev:web:live` | Live — REST/SignalR через Vite proxy (`VITE_DEMO_LIVE=1`) | CherryPlayServer на `:5000` |

```bash
cd CherryPlayList
npm run dev:web
# или
npm run dev:web:live
```

Откройте http://localhost:5173. В **live** REST и SignalR идут same-origin через **Vite proxy** на `http://localhost:5000` (CORS не нужен). При прямом `VITE_API_URL` бэкенд должен разрешать origin `:5173` (см. `appsettings.Development.json`, `docker-compose.debug.yml`). Electron: `npm run dev` — без изменений.

## Переменные окружения (сводка)

| Переменная               | Проект         | Описание                                                                                                                                   |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_API_URL`           | CherryPlayWeb  | Базовый URL API сервера (по умолчанию подставляется при сборке; для dev часто задаётся в `.env`). Пример: `http://localhost:5000`          |
| `VITE_API_URL`           | CherryPlayList | URL сервера (при сборке; иначе `serverConfig.*.json` или настройки в UI); в web demo — опциональный прямой base (без proxy)                |
| `VITE_APP_MODE`          | CherryPlayList | `demo` для веб-демо (`dev:web` / `dev:web:project` / `dev:web:live`); см. [ENV.md](ENV.md), [web-demo.md](CherryPlayList/docs/web-demo.md) |
| `VITE_DEMO_LIVE`         | CherryPlayList | `1` в `dev:web:live` — live REST/SignalR + local login; без флага — fixtures                                                               |
| `VITE_LOAD_DEMO_PROJECT` | CherryPlayList | `1` в `dev:web:project` — автозагрузка `sample.cherry`                                                                                     |

## Проверка связки

1. Запустить **CherryPlayServer**.
2. Запустить **CherryPlayWeb**, открыть http://localhost:3000 — должна отображаться страница каталога или демо-плейлист (в зависимости от реализации).
3. Запустить **CherryPlayList**, создать вечеринку (Party workspace), получить shortCode/URL — открыть этот URL в браузере (через CherryPlayWeb с параметром `?party=<shortCode>` или будущий маршрут `party/<shortCode>`).

## Документация

- [ENV.md](ENV.md) — справочник переменных окружения (корневой .env.example, dev/prod, маппинг бэкенда)
- [CherryPlayComponents/README.md](CherryPlayComponents/README.md) — PartyDisplay, PartyTheme, UI-примитивы и CSS import contract
- [RELEASE_PLAN.md](RELEASE_PLAN.md) — план релиза v1, границы и архитектура
- [CONTRACTS.md](CONTRACTS.md) — REST API и SignalR контракты
- [docs/integration/README.md](docs/integration/README.md) — подсистемы интеграции приложение–сервер–веб
