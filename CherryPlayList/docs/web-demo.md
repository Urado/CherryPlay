# Веб-демо CherryPlayList

Режим **веб-демо** запускает тот же React-интерфейс CherryPlayList в браузере через Vite **без** Electron: нет `window.api`, нет доступа к локальной ФС и нативным диалогам. Данные обозревателя файлов и часть IPC заменены **in-memory фикстурами** (`WebDemoPlatform`).

Режим предназначен **только для разработки** (быстрая проверка UI, DnD, undo/redo). Production-сборки веб-демо нет.

---

## Быстрый старт

Из каталога `CherryPlayList/` (после `npm install`):

| Команда                   | Назначение                                                                   |
| ------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev:web`         | Браузер, демо-платформа, **без** автозагрузки проекта                        |
| `npm run dev:web:project` | То же + автозагрузка `public/demo/sample.cherry` при старте                  |
| `npm run dev`             | **Electron** (Vite + preload + IPC) — поведение **не изменено** этим режимом |

После `dev:web` / `dev:web:project` откройте в браузере URL dev-сервера (по умолчанию [http://localhost:5173](http://localhost:5173), порт задан в `vite.config.mjs`).

В шапке отображается баннер: _«Режим веб-демо — без Electron и без трансляции»_.

---

## Vite dev proxy и CherryPlayServer

При разработке в браузере UI и API должны быть **same-origin**, иначе браузер блокирует cross-origin запросы (CORS), в том числе **SignalR negotiate** на `/partyHub`.

В `vite.config.mjs` настроен proxy dev-сервера Vite → `http://localhost:5000`:

| Путь на `:5173` | Назначение                             |
| --------------- | -------------------------------------- |
| `/api`          | REST API CherryPlayServer              |
| `/auth`         | OAuth / auth endpoints                 |
| `/partyHub`     | SignalR hub (`ws: true` для WebSocket) |

**По умолчанию** `demoConfig.ts` задаёт `demoServerUrl` как **пустую строку** — клиент строит относительные URL (`/api`, `/partyHub`). Запросы идут на origin Vite и проксируются на бэкенд; **отдельный CORS для `:5173` не нужен**.

**Electron dev** (`npm run dev`) proxy не использует: renderer грузится с `:5173`, но IPC и `serverConfig` указывают на сервер напрямую; в dev у Electron `webSecurity: false`, поэтому CORS к `:5000` не мешает.

### Когда нужен CORS на бэкенде

Если задать **`VITE_API_URL=http://localhost:5000`**, клиент обращается к серверу **напрямую**, минуя proxy. Тогда CherryPlayServer должен разрешать origin `http://localhost:5173`:

- `CherryPlayServer/appsettings.Development.json` — `AllowedOrigins`
- `docker-compose.debug.yml` — `Cors__AllowedOrigins__2=http://localhost:5173`
- см. также [DEV_SETUP.md](../../DEV_SETUP.md), [ENV.md](../../ENV.md)

Явный URL удобен для отладки без Vite или при нестандартном порте бэкенда.

---

## Платформа и capabilities

Веб-демо — это `AppMode: 'demo'` и `WebDemoPlatform`, не отдельная ветка проверок в UI. Ограничения задаёт **[capability-матрица](./modules/platform/README.md)** (`derivePlatformCapabilities('demo')`):

| Флаг                                                                                                                                      | В demo                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `usesFixtureFileBrowser`                                                                                                                  | ✓ — фикстурное дерево вместо ФС                                         |
| `simulatesExport`                                                                                                                         | ✓ — экспорт без записи на диск                                          |
| `supportsLocalFilePlayback`, `supportsNativeFileSystem`, `supportsProjectPersistence`, `supportsAudioDeviceSelection`, `supportsRealAuth` | ✗                                                                       |
| `supportsAimpWorkspace`                                                                                                                   | ✓ — симулированный bridge (`WebDemoPlatform.aimp`, фикстурный плейлист) |

Для gating в коде используйте `getPlatformCapabilities()` или guards (`guardNativeFileOperation`, `guardPlaybackUnavailable`, `isDemoAuthMode`), **не** `getAppMode() === 'demo'`. Косметика демо (баннер, title) может читать `getAppMode()`.

Сообщение при блокировке: **`Не доступно в демо`** (`getPlatformUnavailableMessage()` в mode `demo`). Electron: те же guards не срабатывают — полный набор capabilities.

---

## Переменные окружения

Скрипты задают флаги через `cross-env`; при ручном запуске Vite используйте те же имена.

| Переменная               | Значение в скриптах            | Смысл                                                                                                                                                                                                               |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_APP_MODE`          | `demo`                         | Единственный переключатель демо-режима; включает bootstrap с `WebDemoPlatform`                                                                                                                                      |
| `VITE_LOAD_DEMO_PROJECT` | `1` только в `dev:web:project` | После монтирования UI вызывается та же загрузка, что и пункт меню «Загрузить демо-проект»                                                                                                                           |
| `VITE_API_URL`           | опционально                    | Базовый URL CherryPlayServer. По умолчанию **пусто** — same-origin через [Vite proxy](#vite-dev-proxy-и-cherryplayserver) (`/api`, `/partyHub`). При непустом значении proxy не используется, нужен CORS на бэкенде |

Запуск по умолчанию (через Vite proxy, CORS не нужен):

```bash
cross-env VITE_APP_MODE=demo npm run dev:web
```

Явный URL сервера (без proxy, нужен CORS `http://localhost:5173` на бэкенде):

```bash
cross-env VITE_APP_MODE=demo VITE_API_URL=http://localhost:5000 npm run dev:web
```

Дополнительные флаги режима не используются — только `VITE_APP_MODE=demo`.

---

## Что работает в демо

- **Обозреватель файлов** — фикстурное дерево (синтетические пути, без бинарников `.mp3` в репозитории); навигация, хлебные крошки, поиск по фикстурам.
- **Плейлист** — DnD из обозревателя, переупорядочивание, **undo/redo**.
- **Коллекции (Collection)** — список треков, DnD, группы, undo/redo (как плейлист); экспорт JSON и копирование треков в папку — **«Не доступно в демо»**.
- **Party** — workspace Party с фейковой привязанной вечеринкой `DEMODK`; стриминг включён по умолчанию (`enableStreaming: true`).
- **Загрузка демо-проекта** — меню «Загрузить демо-проект» (`fetch` → `/demo/sample.cherry`) или `npm run dev:web:project`.
- **Экспорт** — сценарий UI проходит; IPC возвращает успех, уведомление _«Экспорт симулирован (демо)»_ (файлы на диск не пишутся).
- **Сброс persist** при старте демо (AC12) — `bootstrap.ts` вызывает `resetDemoPersistStorage()` **до** загрузки сторов и удаляет ключи `cherryplaylist-auth`, `cherryplaylist-settings`, `cherryplaylist-workspaces`, `cherryplaylist-layout` (legacy), `cherryplaylist-project` из IndexedDB. Внутри одной загрузки страницы workspace/layout пишется в persist; **полная перезагрузка** (`dev:web`) снова очищает `cherryplaylist-workspaces`. Подробнее: [клиентское persist](./modules/systems/persisted-client-state.md), [режим редактирования layout](./layout-edit-mode.md).

---

## Ограничения и сообщение «Не доступно в демо»

Для заблокированных действий в UI и в ответах IPC используется **одна** строка:

**`Не доступно в демо`**

(константа `DEMO_UNAVAILABLE_MESSAGE` в `src/shared/platform/demoUnavailable.ts`).

| Область                    | Поведение в веб-демо                                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Electron / preload**     | Нет `window.api`; весь IPC идёт через `WebDemoPlatform`                                                                                                                                                                                                              |
| **Сохранение проекта**     | `project:save`, `project:savePortableAs` и пункты Save в меню — **«Не доступно в демо»** (нет записи проекта в localStorage и нет обхода через скачивание)                                                                                                           |
| **Реальное аудио**         | `audio:getDuration`, `audio:getFileSource`; превью/демо-плеер — **«Не доступно в демо»**, без воспроизведения файлов с диска                                                                                                                                         |
| **Коллекции (Collection)** | UI коллекции работает; **экспорт в JSON**, **копирование треков в папку**, **импорт JSON** — **«Не доступно в демо»** (`collectionPersistenceService`)                                                                                                               |
| **AIMP**                   | Workspace AIMP — заглушка; `AimpIntegrationController` не монтируется; пресет layout с AIMP скрыт                                                                                                                                                                    |
| **Party**                  | UI на фикстурах `demoPartyFixture` (вечеринка `DEMODK`); **реальный auth в демо отключён** (`supportsRealAuth`). При запущенном CherryPlayServer и пустом `VITE_API_URL` HTTP/SignalR к `:5000` доступны **через Vite proxy** (стриминг при `enableStreaming: true`) |
| **Аккаунт**                | Фейковый организатор «Demo Organizer»; login/OAuth без запросов к API (даже если proxy к серверу поднят)                                                                                                                                                             |
| **Трансляция**             | `enableStreaming: true` по умолчанию в демо (можно выключить в настройках)                                                                                                                                                                                           |
| **Production web build**   | Нет скрипта `build:web-demo`; только `dev:web` / `dev:web:project`                                                                                                                                                                                                   |

Вне scope (не обещаются в этом режиме): File System Access API, Android WebView, production web build, CherryPlayWeb как отдельный продукт, переименование `electronStorage`, mp3 в репозитории.

Полноценный CherryPlayServer/SignalR в браузере **поддерживается в dev** при proxy или CORS; без запущенного сервера на `:5000` сетевые вызовы завершатся ошибкой (ожидаемо).

---

## Electron без изменений

Полноценная разработка десктопа — как раньше:

```bash
npm run dev
```

Скрипт по-прежнему поднимает Vite и Electron с реальным preload (`electron/preload.ts` — канонический список IPC). Веб-демо **не** подменяет и **не** меняет `dev`, `build`, `dist`.

Если в браузере открыть сборку без `VITE_APP_MODE=demo` и без preload, bootstrap завершится ошибкой с подсказкой использовать `npm run dev` или `npm run dev:web`.

---

## Как проверить

1. `cd CherryPlayList && npm run dev:web` — нет красных ошибок в консоли при обходе file browser → плейлист → reorder → undo/redo.
2. DnD из обозревателя в плейлист, сохранение — toast **«Не доступно в демо»**.
3. Play/preview — **«Не доступно в демо»**, без падения UI.
4. Меню «Загрузить демо-проект» или `npm run dev:web:project` — проект из `sample.cherry`.
5. Экспорт — успех с текстом про симуляцию.
6. `npm run dev` — Electron как до введения веб-демо.
7. (Опционально) CherryPlayServer на `:5000` + `npm run dev:web` без `VITE_API_URL` — в Network нет CORS-ошибок на `/partyHub/negotiate`; WebSocket `/partyHub` уходит через proxy.
8. [Режим редактирования layout](./layout-edit-mode.md) — **✎**, pill (переключение **Мои** / **Встроенные**, inline-имя), auto-save; после F5 workspace **не** сохраняется (сброс AC12).

---

## Для контрибьюторов

- Платформа и capabilities: [Platform layer](./modules/platform/README.md); исходники `src/shared/platform/`.
- Vite proxy: `vite.config.mjs` (`server.proxy`); URL сервера в демо: `src/shared/platform/fixtures/demoConfig.ts`.
- Режим редактирования layout: [layout-edit-mode.md](./layout-edit-mode.md).
- Bootstrap: `src/bootstrap.ts`, подключение в `src/entry.tsx`.
- Список IPC-каналов: `electron/preload.ts` (`VALID_INVOKE_CHANNELS`).
- Детальный план реализации (временный): `.cursor/schedulerPlans/web-demo-01-technical-spec.md`.
