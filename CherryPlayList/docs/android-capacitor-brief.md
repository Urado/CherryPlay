# Бриф: CherryPlayList на Android (Capacitor)

Краткий план реализации. Сроки не указаны — только этапы и задачи.

## Зафиксированные решения

- **Платформа:** Android-планшет, оболочка Capacitor, UI — общий Vite-бандл CherryPlayList.
- **Сценарий:** подготовка кусков и папок на ПК, доработка плейлиста на планшете в процессе сета.
- **Офлайн-first:** воспроизведение всегда из локального хранилища; Party/стриминг — только показ «что играет» на сайте, слабо связан с playback.
- **Scope v1:** все workspace **кроме AIMP** (AIMP — только desktop).
- **Аудио:** `PlaybackEngine` на Web Audio, загрузка по URL/stream; default output; per-track loudness gain и compression уже в renderer/effects; **scanner** (`analyzeLoudness`) — Electron (FFmpeg) и web demo (simulated fixtures); Capacitor stub пока без скана.
- **Библиотека:** ~500 треков; remap путей проекта с ПК на планшет.
- **Доставка:** рабочий APK (sideload).

---

## Этап 0 — Каркас

Подготовка platform-refactor уже сделана: тип `AppMode: 'capacitor'`, ветка bootstrap, класс `CapacitorPlatform` (stub без `@capacitor/*`), `npm run dev:capacitor`, capability-матрица со всеми флагами `false` до плагинов. Детали слоёв и API: **[Platform layer](./modules/platform/README.md)**.

Остаётся на Etap 0:

- Добавить Capacitor-проект к CherryPlayList.
- Сборка `dist/` → загрузка в WebView (offline).
- Инжект bridge `window.api` (контракт как у preload) — тогда stub начнёт делегировать IPC; capabilities включаются по этапам 1–5.

## Этап 1 — Аудио

Архитектура слоёв и границы store/engine: [Playback Engine — слои](./modules/audio/playback-layers.md).

- `PlaybackEngine` на Web Audio (`MediaElementSource` → gain → destination).
- Загрузка трека по URL (`audio:getFileUrl`); в Electron base64/Blob-путь уже убран (`cherryplay-audio://`, см. [Загрузка файлов](./modules/audio/playback-layers.md#загрузка-файлов-electron)); на Capacitor — native URI/stream через тот же контракт.
- Capacitor-плагин: `audio:getFileUrl`, `audio:getDuration` (stream/URI).
- Свести `playerAudioStore` и `demoPlayerStore` на **два независимых** engine-инстанса (`main` + `demo`): один вызов `createPlaybackEnginePair()` в `playbackEngines.ts`, shared-экспорты `mainPlaybackEngine` / `demoPlaybackEngine`; stores импортируют их, а не создают engine сами (см. [два инстанса](./modules/audio/playback-layers.md#два-независимых-экземпляра)).

**Loudness normalization (Android follow-up):** renderer store, `loudnessService`, `track.loudness` в `.cherry` и `applyPlaybackEffects` — **общие** с desktop. На Android меняется только platform adapter для `audio:analyzeLoudness` (например `ffmpeg-kit` через Capacitor plugin); capability `supportsLoudnessAnalysis` включается по мере готовности плагина. Метаданные из проекта, собранного на ПК, переносятся в `.cherry` без пересчёта, пока `fileMtime` совпадает. См. [Нормализация громкости (loudness v1)](./modules/audio/loudness-normalization.md), [android_port_todo.md](../../android_port_todo.md).

## Этап 2 — Файлы и папки

- SAF: выбор корневой папки с музыкой, persist доступа.
- Плагин: `fileBrowser:listDirectory`, `statFile`, `findAudioFilesRecursive`.
- Виртуальные `path` (стабильный ID ↔ content URI).
- Remap путей: проект с ПК → локальные пути планшета.

## Этап 3 — Проект

- `project:load` / `project:save` через app storage + SAF.
- Импорт `.cherry` с ПК (файл / папка).
- Проверка: ~500 треков, навигация FileBrowser, добавление в плейлист.

## Этап 4 — Workspace (без AIMP)

- Player: сессия, next track, группы, паузы.
- Playlist, Collection — редактирование, DnD (fallback: tap/add).
- Party: редактор, lifecycle, publish.
- Party Display: превью на планшете.
- Feature gating: AIMP workspace скрыт.

## Этап 5 — Party / онлайн

- Auth, config, `auth:registerCallback` (deep link).
- SignalR — стриминг состояния «что играет».
- Офлайн-first: сет без сети; party — best effort при наличии интернета.

## Этап 6 — Полировка

- Тест на целевом планшете: полный сет, BT/default output.
- Loudness scan adapter (`ffmpeg-kit` или аналог) + включение `supportsLoudnessAnalysis`.
- CI: артефакт `dist` + сборка APK.
