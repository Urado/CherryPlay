# Веб-демо CherryPlayList

Режим **веб-демо** запускает тот же React-интерфейс CherryPlayList в браузере через Vite **без** Electron: нет `window.api`, нет доступа к локальной ФС и нативным диалогам. Данные обозревателя файлов и часть IPC заменены **in-memory фикстурами** (`WebDemoPlatform`).

Режим предназначен **только для разработки** (быстрая проверка UI, DnD, undo/redo, e2e против локального сервера). Production-сборки веб-демо нет.

Есть **два режима** (переключение только скриптом/env, без toggle в UI):

| Режим | Скрипт | Env | Сервер | Auth / Party | SignalR |
| ----- | ------ | --- | ------ | ------------ | ------- |
| **Fixtures** | `npm run dev:web` (+ `dev:web:project`) | `VITE_APP_MODE=demo`, без `VITE_DEMO_LIVE` | Не нужен | Фикстуры (`supportsRealAuth: false`) | Нет |
| **Live** | `npm run dev:web:live` | `VITE_APP_MODE=demo` + `VITE_DEMO_LIVE=1` | CherryPlayServer на `:5000` | Local email/password (`/auth/login`); party с сервера (`supportsRealAuth: true`) | Да, при **Онлайн** ON |

`AppMode` в обоих случаях остаётся `'demo'`; live — overlay-флаг (`isDemoLiveMode()` / `VITE_DEMO_LIVE`), не отдельный `AppMode`.

---

## Быстрый старт

Из каталога `CherryPlayList/` (после `npm install`):

| Команда                   | Назначение                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev:web`         | Fixtures: браузер, демо-платформа, **без** сервера и **без** автозагрузки проекта                   |
| `npm run dev:web:project` | Fixtures + автозагрузка `public/demo/sample.cherry` при старте                                      |
| `npm run dev:web:live`    | Live: тот же UI + REST/SignalR через Vite proxy; нужен CherryPlayServer на `:5000`                  |
| `npm run dev`             | **Electron** (Vite + preload + IPC) — поведение **не изменено** веб-демо                            |

После `dev:web` / `dev:web:project` / `dev:web:live` откройте URL dev-сервера (по умолчанию [http://localhost:5173](http://localhost:5173), порт в `vite.config.mjs`).

Баннер в шапке:

- Fixtures: _«Режим веб-демо — без Electron и без связи с сервером»_
- Live: _«Режим веб-демо (live) — без Electron, связь с сервером через Vite proxy»_

---

## Онлайн и сеть (по режиму)

Внутренний `networkEnabled` (`onlineNetworkPolicy`) **всегда** зеркалит настройку **«Онлайн»** (`enableStreaming`) — в т.ч. в fixtures. Отдельной настройки `networkEnabled` в UI нет.

| Режим | `networkEnabled` | Hub (SignalR) | UI при Online ON |
| ----- | ---------------- | ------------- | ---------------- |
| **Fixtures** | `=== enableStreaming` | **Не** стартует (`isStreamingHubAllowed` требует `supportsRealAuth`) | Нет противоречия «Онлайн включён» ↔ «онлайн-функции отключены» из-за hard-disable сети |
| **Live** | `=== enableStreaming` | Стартует при Online ON и доступном сервере (proxy → `:5000`) | Online OFF → hub неактивен; Online ON + сервер down → баннер недоступности сервера |

В **live** старт сессии («Начать проигрывание») использует **синтетическое** воспроизведение в `playerAudioStore` (трек, status, позиция по таймеру) без реального аудио — чтобы `CherryPlayPlayerBroadcastSource` / orchestrator публиковали состояние в SignalR. Превью в file-browser / demo-player по-прежнему показывает «Не доступно в демо».

Файл browser, симуляция экспорта, отсутствие реального local playback и сохранения проекта на диск — в **обоих** режимах (capabilities demo, кроме `supportsRealAuth` в live).

Подробнее: [Platform layer](./modules/platform/README.md), [Settings Store](./modules/stores/settings-store.md), [Streaming](./modules/systems/streaming.md).

---

## Vite dev proxy и CherryPlayServer

При разработке в браузере UI и API должны быть **same-origin**, иначе браузер блокирует cross-origin запросы (CORS), в том числе **SignalR negotiate** на `/partyHub`.

В `vite.config.mjs` настроен proxy Vite → `http://localhost:5000`:

| Путь на `:5173` | Назначение                             |
| --------------- | -------------------------------------- |
| `/api`          | REST API CherryPlayServer              |
| `/auth`         | Auth endpoints (в live — local login)  |
| `/partyHub`     | SignalR hub (`ws: true` для WebSocket) |

**По умолчанию** `demoConfig.ts` задаёт `demoServerUrl` как **пустую строку** — клиент строит относительные URL (`/api`, `/partyHub`). Запросы идут на origin Vite и проксируются на бэкенд; **отдельный CORS для `:5173` не нужен**.

Proxy полезен в **live**-режиме (`dev:web:live`). В **fixtures** (`dev:web`) сервер и SignalR **не требуются** и не используются для party/auth.

**Electron dev** (`npm run dev`) proxy не использует: renderer грузится с `:5173`, но IPC и `serverConfig` указывают на сервер напрямую; в dev у Electron `webSecurity: false`, поэтому CORS к `:5000` не мешает.

### Когда нужен CORS на бэкенде

Если задать **`VITE_API_URL=http://localhost:5000`**, клиент обращается к серверу **напрямую**, минуя proxy. Тогда CherryPlayServer должен разрешать origin `http://localhost:5173`:

- `CherryPlayServer/appsettings.Development.json` — `AllowedOrigins`
- `docker-compose.debug.yml` — `Cors__AllowedOrigins__2=http://localhost:5173`
- см. также [DEV_SETUP.md](../../DEV_SETUP.md), [ENV.md](../../ENV.md)

Явный URL удобен для отладки без Vite или при нестандартном порте бэкенда (типично для **live**).

---

## Платформа и capabilities

Веб-демо — это `AppMode: 'demo'` и `WebDemoPlatform`, не отдельная ветка проверок в UI. Ограничения задаёт **[capability-матрица](./modules/platform/README.md)** (`derivePlatformCapabilities('demo')`):

| Флаг                                                                                                                                      | Fixtures (`dev:web`) | Live (`dev:web:live`) |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------- |
| `usesFixtureFileBrowser`                                                                                                                  | ✓                    | ✓                     |
| `simulatesExport`                                                                                                                         | ✓                    | ✓                     |
| `supportsLocalFilePlayback`, `supportsNativeFileSystem`, `supportsProjectPersistence`, `supportsAudioDeviceSelection`                     | ✗                    | ✗                     |
| `supportsRealAuth`                                                                                                                        | ✗                    | ✓ (`VITE_DEMO_LIVE=1`) |
| `supportsAimpWorkspace`                                                                                                                   | ✓ (simulated)        | ✓ (simulated)          |
| `supportsLoudnessAnalysis`                                                                                                                | ✓ (simulated)        | ✓ (simulated)          |

Для gating в коде используйте `getPlatformCapabilities()`, `isDemoLiveMode()` / `isDemoFixturesMode()` или guards (`guardNativeFileOperation`, `guardPlaybackUnavailable`, `isDemoAuthMode`), **не** `getAppMode() === 'demo'` для feature gating. Косметика демо (баннер, title) может читать `getAppMode()` / live-флаг.

Сообщение при блокировке: **`Не доступно в демо`** (`getPlatformUnavailableMessage()` в mode `demo`). Electron: те же guards не срабатывают — полный набор capabilities.

---

## Переменные окружения

Скрипты задают флаги через `cross-env`; при ручном запуске Vite используйте те же имена.

| Переменная               | Значение в скриптах                         | Смысл                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_APP_MODE`          | `demo`                                      | Включает bootstrap с `WebDemoPlatform`                                                                                                                                                                              |
| `VITE_DEMO_LIVE`         | `1` только в `dev:web:live`                 | Live overlay: `supportsRealAuth`, real login/party, SignalR при Online ON. Без флага (или не `1`) — fixtures                                                                                                        |
| `VITE_LOAD_DEMO_PROJECT` | `1` только в `dev:web:project`              | После монтирования UI — загрузка как пункт меню **«Учебный демо-проект…»**                                                                                                                                             |
| `VITE_API_URL`           | опционально                                 | Базовый URL CherryPlayServer. По умолчанию **пусто** — same-origin через [Vite proxy](#vite-dev-proxy-и-cherryplayserver). При непустом значении proxy не используется, нужен CORS на бэкенде                     |

Fixtures (без сервера):

```bash
cross-env VITE_APP_MODE=demo npm run dev:web
```

Live (нужен CherryPlayServer на `:5000`):

```bash
cross-env VITE_APP_MODE=demo VITE_DEMO_LIVE=1 npm run dev:web:live
```

Явный URL сервера в live (без proxy, нужен CORS `http://localhost:5173` на бэкенде):

```bash
cross-env VITE_APP_MODE=demo VITE_DEMO_LIVE=1 VITE_API_URL=http://localhost:5000 vite
```

Переключение fixtures ↔ live — **только** через скрипт/env; in-app toggle нет. OAuth (VK/Mail.ru) в live **не** требуется (local email/password).

---

## Что работает в демо

- **Обозреватель файлов** — фикстурное дерево (синтетические пути, без бинарников `.mp3` в репозитории); навигация, хлебные крошки, поиск по фикстурам.
- **Плейлист** — DnD из обозревателя, переупорядочивание, **undo/redo**.
- **Коллекции (Collection)** — список треков, DnD, группы, undo/redo (как плейлист); экспорт JSON и копирование треков в папку — **«Не доступно в демо»**.
- **Party (fixtures)** — старт **без** `linkedParty` (шапка **«Не создана»** / CTA **«Создать»**); фикстура `demoPartyFixture` (`DEMODK`) доступна через demo-сценарии (в т.ч. legacy **Черновик**); **Онлайн** по умолчанию (`enableStreaming: true`); без SignalR и без зависимости от `:5000`.
- **Party / auth (live)** — local login/register против сервера; данные вечеринок с API; SignalR при Online ON через proxy. Гостевой URL (`getPartyUrl`) при пустом `serverUrl` (Vite proxy / same-origin) — `http://localhost:3000/party/{shortCode}`; при непустом `VITE_API_URL` — эвристика host + `:5000`→`:3000` (как в Electron).
- **Загрузка демо-проекта** — меню **Файл** → **«Учебный демо-проект…»** (`title`: «Загружает учебный демо-проект, не настоящую вечеринку») или `npm run dev:web:project` (fixtures; live-флаг выключен). При `meta.isDirty` — confirm перед отбрасыванием изменений (см. [Save/Load](./modules/systems/save-load.md)).
- **Экспорт** — сценарий UI проходит; IPC возвращает успех без записи файлов на диск; **без** success-toast (модалка закрывается).
- **Нормализация громкости (simulated)** — `supportsLoudnessAnalysis: true`; Player gear (`TrackSettingsModal` isGlobal) / track controls доступны для UI-работы в `dev:web` / `dev:web:project`. IPC `audio:analyzeLoudness` / `audio:statAudioFile` обслуживает `WebDemoPlatform` через детерминированные профили (`demoLoudnessAnalyzer.ts`), **без** FFmpeg. `sample.cherry` seeded с `track.loudness`. Реальный local playback по-прежнему недоступен. См. [loudness](./modules/audio/loudness-normalization.md), [Platform](./modules/platform/README.md).
- **Сброс persist** при старте демо (AC12) — `bootstrap.ts` вызывает `resetDemoPersistStorage()` **до** загрузки сторов и удаляет ключи `cherryplaylist-settings`, `cherryplaylist-workspaces` (включая `builtinLayoutOverrides`), `cherryplaylist-layout` (legacy), `cherryplaylist-project` из IndexedDB. Ключ `cherryplaylist-auth`: в **fixtures** тоже очищается; в **live** (`VITE_DEMO_LIVE=1`) **сохраняется**, чтобы сессия переживала F5. Остальные ключи в live по-прежнему сбрасываются — workspace/layout/overrides после полной перезагрузки не восстанавливаются. Подробнее: [клиентское persist](./modules/systems/persisted-client-state.md), [режим редактирования layout](./layout-edit-mode.md).

---

## Ограничения и сообщение «Не доступно в демо»

Для заблокированных действий в UI и в ответах IPC используется **одна** строка:

**`Не доступно в демо`**

(константа `DEMO_UNAVAILABLE_MESSAGE` в `src/shared/platform/demoUnavailable.ts`). В toast это сообщение показывается как **`warning`** (`notifyDemoUnavailable` / `getPlatformUnavailableMessage`), не как `info`.

| Область                    | Fixtures (`dev:web`)                                                                                                                                 | Live (`dev:web:live`)                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Electron / preload**     | Нет `window.api`; IPC через `WebDemoPlatform`                                                                                                        | То же                                                                                                          |
| **Сохранение проекта**     | **«Не доступно в демо»**                                                                                                                             | То же                                                                                                          |
| **Реальное аудио**         | Превью/демо-плеер — **«Не доступно в демо»**                                                                                                         | То же                                                                                                          |
| **Коллекции (Collection)** | Экспорт JSON / копирование / импорт — **«Не доступно в демо»**                                                                                       | То же                                                                                                          |
| **AIMP**                   | ✓ симулированный bridge (`WebDemoPlatform.aimp`, фикстурный плейлист); desktop без изменений                                                         | То же                                                                                                          |
| **Loudness**               | ✓ UI + simulated scan (фикстуры); без FFmpeg; без реального local playback                                                                           | То же                                                                                                          |
| **Party**                  | Старт без link (**Не создана**); фикстура `DEMODK` через demo-сценарии; без live REST/SignalR                      | REST/SignalR к серверу при Online ON                                                                           |
| **Аккаунт**                | Фейковый «Demo Organizer»; login/OAuth без API                                                                                                       | Local email/password (`/auth/login`); OAuth вне scope                                                          |
| **Трансляция / Онлайн**    | `enableStreaming` ↔ `networkEnabled`; hub **не** стартует                                                                                            | `enableStreaming` ↔ `networkEnabled`; hub при Online ON + `supportsRealAuth`                                   |
| **Production web build**   | Нет `build:web-demo`                                                                                                                                 | Нет                                                                                                            |

Вне scope: File System Access API, Android WebView, production web build, CherryPlayWeb как продукт, OAuth в браузерном демо, переименование `electronStorage`, mp3 в репозитории.

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

### Fixtures

1. `cd CherryPlayList && npm run dev:web` — без CherryPlayServer; нет красных ошибок при обходе file browser → плейлист → reorder → undo/redo.
2. Online ON в Settings — UI **не** утверждает, что сеть принудительно отключена; SignalR **не** поднимается.
3. DnD / Save / Play-preview — toast **`warning`** **«Не доступно в демо»** где capability блокирует.
4. `npm run dev:web:project` или меню **Файл** → **«Учебный демо-проект…»** — `sample.cherry` (треки с seeded `track.loudness`).
5. Player gear / track popover — loudness toggles и scan UI доступны; rescan/session gate возвращают детерминированные профили (без FFmpeg). Local playback по-прежнему **«Не доступно в демо»**.
6. Экспорт — модалка закрывается без success-toast; файлы на диск не пишутся.
7. [Режим редактирования layout](./layout-edit-mode.md) — после F5 workspace / overrides **не** сохраняются (сброс AC12).

### Live

8. Поднять CherryPlayServer на `:5000`, затем `npm run dev:web:live`.
9. Online ON — SignalR negotiate/connect через proxy (`/partyHub`); local login работает.
10. Online OFF — hub неактивен; баннеры согласованы с настройкой.
11. Полная перезагрузка страницы — auth в live сохраняется (AC12 не чистит `cherryplaylist-auth`); workspace/layout/overrides сбрасываются.

### Electron

12. `npm run dev` — Electron как до введения веб-демо (preload/IPC без изменений от web-demo).

---

## Для контрибьюторов

- Платформа и capabilities: [Platform layer](./modules/platform/README.md); `isDemoLiveMode` / `isDemoFixturesMode` — `src/shared/platform/demoLiveMode.ts`.
- Loudness (simulated): [loudness-normalization.md](./modules/audio/loudness-normalization.md); фикстуры — `src/shared/platform/fixtures/demoLoudnessAnalyzer.ts`.
- Онлайн / `networkEnabled`: [Settings Store](./modules/stores/settings-store.md), [Streaming](./modules/systems/streaming.md), [`onlineNetworkPolicy.ts`](../src/shared/streaming/onlineNetworkPolicy.ts).
- Vite proxy: `vite.config.mjs` (`server.proxy`); URL сервера в демо: `src/shared/platform/fixtures/demoConfig.ts`.
- Режим редактирования layout: [layout-edit-mode.md](./layout-edit-mode.md).
- Bootstrap: `src/bootstrap.ts`, подключение в `src/entry.tsx`.
- Список IPC-каналов: `electron/preload.ts` (`VALID_INVOKE_CHANNELS`).
