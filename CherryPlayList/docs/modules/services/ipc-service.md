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
- **Audio**: `audio:getDuration`, `audio:getFileSource`
- **Export**: `export:execute`, `export:aimp`, `export:copyTracksToFolder`
- **Project**: `project:save`, `project:load`
- **Dialog**: `dialog:showOpenDialog`, `dialog:showSaveDialog`, `dialog:showOpenFileDialog`
- **System**: `system:getPath`

## Обработка ошибок

Все ошибки автоматически логируются и показываются пользователю через уведомления (если `showNotification: true`).

