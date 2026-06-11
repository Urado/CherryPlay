# Playback Engine — слои и границы

Целевая архитектура воспроизведения в CherryPlayList: единый backend `WebAudioPlaybackEngine` (Capacitor/native adapter позже) без переписывания session/store-логики.

**Текущий статус:** stores мигрированы на `WebAudioPlaybackEngine` (main + demo). Transport (`load`/`play`/events) — в `MediaElementTransport`; Web Audio graph и effects — в engine. Загрузка в Electron: `audio:getFileUrl` → `cherryplay-audio://` (стриминг, без base64/Blob в renderer). Effects: track gain, 3-band EQ, placeholder autogain — defaults применяются на каждый успешный `loadTrack`.

См. также: [Demo Player](../systems/demo-player.md), [Player workspace](../workspaces/player.md), [Android Capacitor brief](../../android-capacitor-brief.md).

---

## Стек слоёв

```
┌─────────────────────────────────────────────────────────┐
│  UI (DemoPlayer, PlayerView, usePlaybackPreview, …)     │
└───────────────────────────┬─────────────────────────────┘
                            │  actions / selectors
┌───────────────────────────▼─────────────────────────────┐
│  Store / Session (playerAudioStore, demoPlayerStore)    │
│  • Track metadata, queue, next/prev, shuffle/repeat     │
│  • Demo disable policy, pause timers, onTrackEnded      │
│  • Subscribes to engine → reflects UI state             │
│  • Shared core: playbackStoreCore.ts                    │
└───────────────────────────┬─────────────────────────────┘
                            │  load / play / pause / seek …
┌───────────────────────────▼─────────────────────────────┐
│  PlaybackEngine (interface) — main / demo instances     │
│  • load / play / pause / stop / seek / volume / device  │
│  • Snapshot + events = playback truth                   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Effects (WebAudioPlaybackEngine): gain, EQ, autogain   │
│  • Capacitor/native effects chain — позже               │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  PlatformAudioAdapter (Electron IPC / Capacitor / Web)  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Runtime (HTMLAudioElement, Web Audio API, native)      │
└─────────────────────────────────────────────────────────┘
```

---

## Два независимых экземпляра

Main player и demo preview — **разные** engine-инстансы (`id: 'main'` и `'demo'`). Оба создаются один раз в модуле `playbackEngines.ts` через `createPlaybackEnginePair()` и импортируются stores — не отдельный `createPlaybackEngine()` в каждом store:

```
     playbackEngines.ts
     createPlaybackEnginePair({ … })
              │
              ├──────────────────────┬──────────────────────┐
              ▼                      ▼                      │
     mainPlaybackEngine      demoPlaybackEngine            │
              │                      │                      │
              ▼                      ▼                      │
     playerAudioStore.ts      demoPlayerStore.ts            │
     import { main… }         import { demo… }              │
              │                      │                      │
              ▼                      ▼                      │
     PlaybackEngine #1       PlaybackEngine #2             │
     (WebAudioPlaybackEngine) (WebAudioPlaybackEngine)      │
              │                      │                      │
              ▼                      ▼                      │
     outputDeviceId: A        outputDeviceId: B             │
     (например BT-динамик)    (например встроенный)         │

     Могут играть одновременно на разных устройствах.
     Конфликт «demo disabled» — политика sync-модуля, не engine.
```

Константы: `MAIN_PLAYBACK_ENGINE_ID` (`'main'`), `DEMO_PLAYBACK_ENGINE_ID` (`'demo'`). Фабрика `createPlaybackEngine()` — каждый вызов создаёт **новый** объект; `dispose()` одного не затрагивает другой. `createPlaybackEnginePair()` — удобная обёртка для пары main+demo; **stores импортируют готовые экспорты** `mainPlaybackEngine` / `demoPlaybackEngine` из `playbackEngines.ts`.

---

## Поток команд и событий

```
  UI ──► store.playTrack() / store.pause()
              │
              ▼
         engine.load(source)
         engine.play()
              │
              ▼
         adapter.resolveSource(source) ──► runtime
              │
              ▼
         engine emits events
              │
    ┌─────────┼─────────┬──────────────┐
    ▼         ▼         ▼              ▼
 status   position   duration      ended / error
    │         │         │              │
    └─────────┴─────────┴──────────────┘
              │
              ▼
    bindPlaybackEngineToStore → store state → UI

  На `ended`: store решает — next(), пауза по таймеру, stop session.
  На `error`: engine — единственный источник playback-ошибок; store
  handleError вызывается через binding, не дублируется в play()/load catch.
  Engine не вызывает next() и не знает об очереди.
```

### Статус `error`

| Шаг | Где                                  | Что происходит                                                                   |
| --- | ------------------------------------ | -------------------------------------------------------------------------------- |
| 1   | `MediaElementTransport`              | `load()` / `play()` / media `error` → `handlePlaybackError(message)`             |
| 2   | Transport                            | `setStatus('error')`, `emit('error', message)`                                   |
| 3   | `bindPlaybackEngineToStore`          | `mapEngineStatusToStoreStatus('error')` → `'error'`                              |
| 4   | Store `handleError`                  | `status: 'error'`, `error: message`, затем `engine.stop()` (без сброса в `idle`) |
| 5   | Store `play()` / `loadTrack()` catch | Только rethrow; **без** повторного `handleError`                                 |

Store-специфичная domain-логика при file-not-found (mark missing, notification) остаётся в `loadTrack` catch, но `handleError` для engine-emitted ошибок не дублируется. Исключение: сбои **precheck** (`statFile`) и другие ошибки **до** `engine.load()` вызывают store `handleError` напрямую — engine ещё не в состоянии `error`.

### Статус `buffering`

`MediaElementTransport` слушает события `<audio>`:

| Событие                                | Переход статуса                                             |
| -------------------------------------- | ----------------------------------------------------------- |
| `waiting`, `stalled`                   | `playing` → `buffering`                                     |
| `playing`, `canplay`, `canplaythrough` | `buffering` → `playing` (или `paused`, если element paused) |

`mapEngineStatusToStoreStatus` пробрасывает `buffering` 1:1 в store status.

---

## Политика конфликта устройств (preparation vs session)

Реализовано в `playbackDeviceConflictSync.ts`:

| Режим сессии    | Устройства совпадают | Поведение                                                                                     |
| --------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| **preparation** | да                   | Demo **не** блокируется — main и demo могут играть одновременно на одном устройстве (DJ prep) |
| **session**     | да                   | Demo `isDisabled = true`; при воспроизведении main — demo pause                               |
| любой           | нет                  | Demo enabled, независимое воспроизведение                                                     |

`null` device id трактуется как «устройство по умолчанию» и считается совпадением.

В веб-демо (`getAppMode() === 'demo'`) селекты аудиоустройств в `SettingsModal` отключены с текстом `DEMO_UNAVAILABLE_MESSAGE`.

---

## Граница плейлиста

| В store / session                                   | В PlaybackEngine                            |
| --------------------------------------------------- | ------------------------------------------- |
| Очередь, `next()` / `previous()`                    | `load(source)` одного трека                 |
| Shuffle, repeat, autoplay-on-ended                  | `play`, `pause`, `stop`, `seek`             |
| `Track` metadata, `currentTrackId`                  | `PlaybackSnapshot` (status, position, …)    |
| Паузы между треками (таймеры)                       | Событие `ended` → store реагирует           |
| Demo disable (`devicesMatch && mode === 'session'`) | `setOutputDevice(deviceId)`                 |
| EQ preset selection (UI)                            | `PlaybackEffects`: track gain, EQ, autogain |

**Правило:** методов `next()`, `previous()`, `setQueue()` на `PlaybackEngine` **нет** и не будет.

---

## Гибридная модель состояния

| Поле                               | Источник правды | Примечание                                   |
| ---------------------------------- | --------------- | -------------------------------------------- |
| `status`, `position`, `duration`   | **Engine**      | `getSnapshot()` + события                    |
| `volume`, `outputDeviceId`         | **Engine**      | store дублирует для UI                       |
| `error` (load/play)                | **Engine**      | строка ошибки backend; store `status: error` |
| `currentTrack`, queue index        | **Store**       | engine не пишет                              |
| `sourceWorkspaceId`, session flags | **Store**       |                                              |
| `isDisabled` (demo)                | **Store**       | политика конфликта устройств                 |
| Shuffle/repeat, pause timers       | **Store**       |                                              |

Stores подписываются на `engine.subscribe()` через `bindPlaybackEngineToStore` и зеркалят engine-поля; HTMLAudio event wiring в store удалён.

---

## Матрица ответственности по слоям

| Слой                     | Ответственность                              | Не делает                                       |
| ------------------------ | -------------------------------------------- | ----------------------------------------------- |
| **UI**                   | Кнопки, таймлайн, выбор устройства           | Прямой доступ к `HTMLAudioElement`              |
| **Store / Session**      | Плейлист, сессия, demo policy, таймеры       | Разрешение file path → URL (делегирует adapter) |
| **PlaybackEngine**       | Transport, snapshot, события одного потока   | Очередь, metadata трека                         |
| **Effects**              | EQ, track gain, autogain (Web Audio chain)   | Session logic; Capacitor/native — позже         |
| **PlatformAudioAdapter** | `resolveSource`, `getDuration?`, `setSinkId` | UI state                                        |
| **Runtime**              | Фактическое воспроизведение                  | Бизнес-правила сессии                           |

---

## Модуль `src/shared/audio/playback/`

Публичный API (`index.ts`):

| Артефакт                                                                        | Назначение                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------- |
| `PlaybackEngine`                                                                | Интерфейс backend                            |
| `PlatformAudioAdapter`, `ResolvedPlaybackUrl`                                   | Порт платформы                               |
| `PlaybackSource`, `PlaybackSnapshot`, `PlaybackEngineStatus`                    | Типы                                         |
| `PlaybackEngineEventMap`, `PlaybackEngineEventName`, …                          | События                                      |
| `PlaybackEngineOptions`, `PlaybackEnginePair`                                   | Фабрика                                      |
| `createPlaybackEngine`, `createPlaybackEnginePair`                              | Создание инстансов                           |
| `createDefaultPlatformAudioAdapter`                                             | Дефолтный adapter (IPC + `setAudioSinkId`)   |
| `WebAudioPlaybackEngine`, `MediaElementTransport`                               | Единственный backend + shared transport      |
| `applyDefaultPlaybackEffects`                                                   | Defaults после load (gain, EQ, autogain off) |
| `bindPlaybackEngineToStore`, `mapEngineStatusToStoreStatus`                     | Store ↔ engine wiring                        |
| `DEFAULT_PLAYBACK_VOLUME`, `MAIN_PLAYBACK_ENGINE_ID`, `DEMO_PLAYBACK_ENGINE_ID` | Константы                                    |

### `PlaybackEngine` — методы

| Метод                               | Описание                                  |
| ----------------------------------- | ----------------------------------------- |
| `id`                                | Метаданные инстанса (`'main'` / `'demo'`) |
| `load(source)`                      | Загрузка одного источника                 |
| `play()`                            | Старт / resume                            |
| `pause()`                           | Пауза с сохранением position              |
| `stop()`                            | Остановка, position → 0                   |
| `seek(seconds)`                     | Перемотка                                 |
| `setVolume(0–1)`                    | Громкость                                 |
| `setOutputDevice(deviceId \| null)` | Выходное устройство                       |
| `getSnapshot()`                     | Снимок playback truth                     |
| `subscribe(event, listener)`        | Подписка на события                       |
| `dispose()`                         | Освобождение ресурсов и listeners         |

**Явно исключено:** `next`, `previous`, queue, shuffle, repeat, autoplay policy, `Track` metadata.

### Типы

**`PlaybackEngineStatus`:** `idle` | `loading` | `playing` | `paused` | `buffering` | `ended` | `error`

Store status (`PlayerAudioStatus`, `PlayerStatus`, `StorePlaybackStatus`) включает те же значения, включая `error`.

**`PlaybackSource` (discriminated union):**

- `{ kind: 'filePath', path: string }`
- `{ kind: 'url', url: string }`
- `{ kind: 'blobUrl', blobUrl: string }`

**`PlaybackSnapshot`:** `status`, `position`, `duration`, `volume`, `outputDeviceId`, `error`

**`PlaybackEngineEventMap`:**

| Событие               | Payload                |
| --------------------- | ---------------------- |
| `statusChanged`       | `PlaybackEngineStatus` |
| `positionChanged`     | `number` (секунды)     |
| `durationChanged`     | `number`               |
| `ended`               | `void`                 |
| `error`               | `string`               |
| `outputDeviceChanged` | `string \| null`       |

### `PlatformAudioAdapter`

Тонкий порт под engine:

| Метод                         | Назначение                                         |
| ----------------------------- | -------------------------------------------------- |
| `resolveSource(source)`       | Path/URI → playable URL + optional `revoke()`      |
| `getDuration?(filePath)`      | Длительность через IPC / native (опционально)      |
| `setSinkId(target, deviceId)` | `HTMLAudioElement` или `AudioContext` → устройство |

Для `filePath` дефолтный adapter **не** создаёт `Blob` и **не** вызывает `revoke()` — playable URL приходит готовым.

### Загрузка файлов (Electron)

```
  engine.load({ kind: 'filePath', path })
              │
              ▼
  createDefaultPlatformAudioAdapter.resolveSource()
              │
              ▼
  ipcService.getAudioFileUrl(path)  ──►  IPC audio:getFileUrl
              │                              validatePath, path.resolve,
              │                              isAudioFile(), stat
              ▼
  cherryplay-audio://local/<base64url(utf8-absolute-path)>
              │         ↑ фиксированный host `local`; payload в pathname (регистрозависимый base64url)
              ▼
  renderer: <audio> / fetch / Web Audio читает URL
              │  Нельзя `cherryplay-audio:///<payload>` — Chromium переносит payload в hostname
              │  и lowercases его → base64url ломается → 403
              │
              ▼
  protocol.handle('cherryplay-audio')  (main process)
              │  decode path → validatePath (+ path.resolve),
              │  isAudioFile(), fs.stat
              ▼
  fs.createReadStream(path, { start, end })  — потоковая отдача; Range → 206 для перемотки
```

**Канал `audio:getFileSource` удалён.** Единственный IPC-путь загрузки — `audio:getFileUrl` (см. [IPC Service](../services/ipc-service.md)).

| Шаг | Где                                           | Что происходит                                                                                                                                                                    |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Renderer / adapter                            | `getAudioFileUrl` → IPC `audio:getFileUrl`                                                                                                                                        |
| 2   | Main (`electron/ipc/audio.ts`)                | `validatePath`, `path.resolve`, `isAudioFile()` (расширение `.mp3`/`.wav`/`.flac`/`.m4a`/`.ogg`), `stat` — файл; ответ `{ url: 'cherryplay-audio://local/…' }` с абсолютным путём |
| 3   | Main (`electron/protocol/cherryplayAudio.ts`) | Декодирует base64url-путь, `validatePath`, `isAudioFile()`, `stat`; `createReadStream` + `Range` → `206 Partial Content`                                                          |
| 4   | Renderer                                      | Media element / Web Audio читает поток; полный файл в память renderer не копируется                                                                                               |

**Почему не `file://` напрямую:** renderer загружается с `http://localhost` (dev) или под CSP без `file:` (prod) — прямой `file://` блокируется.

**CSP** (`electron/main.ts`): схема `cherryplay-audio:` разрешена в `default-src` и `media-src`.

Длительность: `audio:getDuration` через `getDuration?`. Выход: `setSinkId` → `audioDevices.ts` / `AudioContext.setSinkId`.

Capacitor Stage 1: тот же контракт `audio:getFileUrl` через native plugin (URI/stream). Web demo: `audio:getFileUrl` и `audio:getDuration` — stub «Не доступно в демо» (см. [Веб-демо](../../web-demo.md)).

### Реализация backend

**`WebAudioPlaybackEngine`** — единственный backend. Делегирует transport lifecycle в **`MediaElementTransport`** (snapshot, `HTMLAudioElement`, events, load/play/seek). Поверх transport — Web Audio graph + `PlaybackEffects` (track gain, EQ, autogain placeholder). Фабрика `createPlaybackEngine()` / `createPlaybackEnginePair()` всегда создаёт `WebAudioPlaybackEngine` и подставляет `createDefaultPlatformAudioAdapter()` (если adapter не передан).

Legacy `HtmlAudioElementEngine` и селектор `implementation: 'html-audio' | 'web-audio'` **удалены** — дублирование transport устранено выносом в `MediaElementTransport`.

---

## Effects

Слой внутри `WebAudioPlaybackEngine` между transport и destination: `PlaybackEffects` (`effects.ts`) — track gain, 3-band EQ, placeholder autogain. Контракт store ↔ engine не меняется; stores не импортируют effects напрямую.

```
  WebAudioPlaybackEngine ──► [ track gain / EQ / autogain ] ──► destination
```

После каждого успешного `loadTrack` shared helper `applyDefaultPlaybackEffects(engine)` устанавливает:

- `DEFAULT_TRACK_GAIN` (1.0)
- `DEFAULT_EQUALIZER_BANDS` (0 dB на всех полосах)
- `setAutoGainEnabled(false)`

Capacitor/native backends могут получить аналогичную effects-цепочку позже поверх того же `MediaElementTransport`.

---

## Жизненный цикл инстанса

```
  playbackEngines.ts: createPlaybackEnginePair()  (once per app session)
              │
              ▼
  mainPlaybackEngine / demoPlaybackEngine  (process-lifetime shared refs)
              │
              ▼
         load → play ⇄ pause
              │      seek, setVolume, setOutputDevice
              ▼
         ended / error / buffering / stop

  dispose() — не вызывается в нормальном desktop lifetime.
  Используйте при замене engine в тестах или short-lived consumers.
```

Фабрика `createPlaybackEngine()` создаёт **новый** объект на каждый вызов. Desktop app импортирует shared-инстансы из `playbackEngines.ts`; main и demo — **разные** объекты одной пары, живущие до закрытия приложения.

---

## Capacitor и Этап 1 (Android)

[Android Capacitor brief](../../android-capacitor-brief.md) — Этап 1:

- `PlaybackEngine` на Web Audio (track gain → EQ → master gain → destination)
- Native plugin: `audio:getFileUrl` (URI/stream), `audio:getDuration` — тот же контракт, что в Electron
- Electron: `cherryplay-audio://` streaming protocol (см. [Загрузка файлов](#загрузка-файлов-electron)); base64/Blob-путь убран
- Main/demo на engine-инстансах через `PlatformAudioAdapter`

Новый backend регистрируется за тем же интерфейсом `PlaybackEngine`; session/queue остаётся в stores. Adapter для Capacitor реализует `resolveSource` / `getDuration` поверх плагина; `setSinkId` — для `AudioContext` или fallback default output.

---

## Дорожная карта миграции (F1–F5)

| ID     | Задача                                               | Статус                                                                                                                        |
| ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **F1** | Миграция `playerAudioStore` на свой `PlaybackEngine` | **Done** — `WebAudioPlaybackEngine`, id `main`                                                                                |
| **F2** | Миграция `demoPlayerStore` на отдельный engine       | **Done** — id `demo`, независимый инстанс                                                                                     |
| **F3** | Web Audio engine + loading path (Capacitor Stage 1)  | **Done** — `WebAudioPlaybackEngine` + `MediaElementTransport`; Electron: `audio:getFileUrl` → `cherryplay-audio://` streaming |
| **F4** | Убрать base64/Blob из цепочки загрузки               | **Done** — stores не вызывают IPC; adapter: `getAudioFileUrl`, без base64/Blob/revoke для `filePath`                          |
| **F5** | Effects layer (EQ / autogain)                        | **Done (v1)** — `PlaybackEffects` + `applyDefaultPlaybackEffects` on load                                                     |

### Следующие шаги (post-F5)

- UI для EQ / per-track gain в настройках трека
- Реальный loudness analysis вместо placeholder autogain
- Capacitor-native adapter (`content://` URI) поверх того же `PlatformAudioAdapter`

---

## Связанные файлы

| Путь                                                             | Роль                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/shared/audio/playback/`                                     | Интерфейс, типы, фабрика                                                      |
| `src/shared/audio/playback/mediaElementTransport.ts`             | Shared HTMLAudioElement transport + buffering/error events                    |
| `src/shared/audio/playback/WebAudioPlaybackEngine.ts`            | Web Audio graph + effects (единственный backend)                              |
| `src/shared/audio/playback/effects.ts`                           | `PlaybackEffects`, EQ, autogain placeholder                                   |
| `src/shared/audio/playback/applyDefaultPlaybackEffects.ts`       | Defaults после load                                                           |
| `src/shared/audio/playback/bindPlaybackEngineToStore.ts`         | Store ↔ engine event wiring + status mapping                                  |
| `src/shared/audio/playback/createDefaultPlatformAudioAdapter.ts` | IPC adapter: `audio:getFileUrl` → `cherryplay-audio://`                       |
| `src/shared/stores/playbackStoreCore.ts`                         | Shared load/play/error/device logic для stores                                |
| `electron/ipc/audio.ts`                                          | `audio:getFileUrl`, `audio:getDuration`                                       |
| `electron/protocol/cherryplayAudio.ts`                           | Схема `cherryplay-audio`, encode/decode path, `protocol.handle` + `net.fetch` |
| `electron/main.ts`                                               | Регистрация scheme/handler, CSP (`cherryplay-audio:`)                         |
| `src/shared/audio/playback/createPlaybackEngine.ts`              | Фабрика инстансов                                                             |
| `src/shared/audio/playback/playbackEngines.ts`                   | Shared `mainPlaybackEngine` / `demoPlaybackEngine`                            |
| `src/shared/stores/playbackDeviceConflictSync.ts`                | Политика demo disable (session + same device only)                            |
| `src/shared/stores/playerAudioStore.ts`                          | Main session — использует `mainPlaybackEngine`                                |
| `src/shared/stores/demoPlayerStore.ts`                           | Demo preview — использует `demoPlaybackEngine`                                |
| `src/shared/utils/audioDevices.ts`                               | `setAudioSinkId`, default device                                              |
| `src/shared/utils/fileErrors.ts`                                 | `isFileNotFoundError` (ENOENT, RU/EN messages)                                |
| `src/shared/services/ipcService.ts`                              | IPC audio                                                                     |
| `src/app/components/SettingsModal.tsx`                           | Audio device selects (disabled in web demo)                                   |
| `src/workspaces/player/hooks/usePlayerPlayback.ts`               | Player session consumer                                                       |
| `src/shared/hooks/usePlaybackPreview.ts`                         | Demo preview entry                                                            |

---

## Как проверить

1. `npm run dev` — main player и demo preview без регрессий.
2. Два устройства: main на A, demo на B — одновременное воспроизведение.
3. **Preparation** + совпадающие устройства — demo **не** blocked; оба могут играть.
4. **Session** + совпадающие устройства — demo blocked (`playbackDeviceConflictSync`).
5. Ошибка play/load — store `status: 'error'`, одно срабатывание `handleError` (через engine event).
6. `createPlaybackEnginePair()` → `dispose()` одного инстанса не ломает второй.
