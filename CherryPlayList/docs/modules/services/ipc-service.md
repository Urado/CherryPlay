# IPC Service

Сервис для безопасной коммуникации между renderer и main процессами Electron.

## Описание

Обёртка над Electron IPC API с автоматической обработкой ошибок и показом уведомлений. Все каналы должны быть whitelisted в `electron/preload.ts`.

## Основные компоненты

- **ipcService** (`src/shared/services/ipcService.ts`) - Класс сервиса IPC

## Основной метод

`invoke<T>(channel: string, payload?: any, showNotification?: boolean): Promise<T>` — универсальный метод для вызова IPC каналов с автоматической обработкой ошибок.

## Категории каналов

- **File Browser**: `fileBrowser:listDirectory`, `fileBrowser:statFile`, `fileBrowser:findAudioFilesRecursive`
- **Audio**: `audio:getDuration`, `audio:getFileUrl` — см. [Загрузка файлов (Electron)](../audio/playback-layers.md#загрузка-файлов-electron)

### Audio: `audio:getFileUrl`

Возвращает playable URL для локального файла. **Содержимое файла по IPC не передаётся** — только закодированный путь.

| Поле ответа | Значение |
| ----------- | -------- |
| `url` | `cherryplay-audio:///<base64url(utf8-absolute-path)>` |

Main process:

1. `audio:getFileUrl` (`electron/ipc/audio.ts`): `validatePath`, `path.resolve`, `isAudioFile()` (проверка расширения), `stat` — path должен быть файлом.
2. При запросе URL renderer обращается к custom protocol `cherryplay-audio` (`electron/protocol/cherryplayAudio.ts`).
3. Handler декодирует путь, снова `validatePath` (внутри — `path.resolve`), `isAudioFile()`, `stat`; отдаёт поток через `net.fetch(file://…)` — без полной копии файла в renderer.

Оба шага (IPC и protocol handler) отклоняют пути с неподдерживаемым расширением и неаудио-файлы; `path.resolve` нормализует путь до абсолютного (в URL кодируется уже resolved path).

Renderer: `ipcService.getAudioFileUrl()` → `createDefaultPlatformAudioAdapter`. Канал `audio:getFileSource` **удалён**.

CSP в `electron/main.ts` разрешает `cherryplay-audio:` в `default-src` и `media-src`.
- **Export**: `export:execute`, `export:aimp`, `export:copyTracksToFolder`
- **Project**: `project:save`, `project:load`
- **Dialog**: `dialog:showOpenDialog`, `dialog:showSaveDialog`, `dialog:showOpenFileDialog`
- **System**: `system:getPath`

## Обработка ошибок

Все ошибки автоматически логируются и показываются пользователю через уведомления (если `showNotification: true`).
