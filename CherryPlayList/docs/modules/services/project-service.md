# Project Service

Сервис для работы с файлами проектов (.cherry формат).

## Описание

Сервис для сохранения и загрузки проектов с валидацией данных и обработкой ошибок.

## Основные компоненты

- **projectService** (`src/shared/services/projectService.ts`) - Класс сервиса проектов

## Функциональность

- **Сохранение проекта**: Сериализация данных проекта в .cherry формат; при `portableMode: true` — копирование треков в `tracks/` и запись относительных путей
- **Загрузка проекта**: Десериализация с валидацией; разрешение относительных путей в абсолютные; обнаружение недоступных треков (`isMissing: true`)
- **Валидация**: Проверка версии формата, структуры данных, ссылочной целостности
- **Обработка ошибок**: Graceful degradation при несовместимых версиях или повреждённых данных

## Портативный режим

`loadProject(filePath)` теперь возвращает `ProjectStateData` напрямую (не `ProjectFile`). После десериализации:

1. Относительные пути треков (`./tracks/...`) разрешаются в абсолютные относительно папки `.cherry` файла.
2. Каждый трек проверяется на доступность через `ipcService.statFile`; недоступные получают `isMissing: true`.

`saveProject(path, projectFile, options?)` принимает опциональный параметр `options.portableMode`. При `true` — IPC-вызов передаёт флаг в main process для выполнения копирования.

Подробнее: [systems/save-load.md](../systems/save-load.md)

## Формат файла

Проект сохраняется в формате `.cherry` (JSON) с версионированием для будущих миграций.

### Поле `track.loudness` (опционально)

На каждом сохранённом треке (`SavedProjectTrack`) может присутствовать блок метаданных громкости (Electron: FFmpeg ebur128; web demo: seeded / simulated scan). Поле **опционально** — старые проекты загружаются без изменений; отсутствие трактуется как «не сканирован».

| Поле               | Тип                            | Когда присутствует           | Описание                                             |
| ------------------ | ------------------------------ | ---------------------------- | ---------------------------------------------------- |
| `status`           | `'ok' \| 'pending' \| 'error'` | всегда                       | Состояние измерения                                  |
| `integratedLufs`   | `number`                       | `status === 'ok'`            | Integrated loudness (LUFS)                           |
| `lraLowLufs`       | `number`                       | `status === 'ok'` (optional) | EBU R128 LRA low (~10th percentile; тихие участки)   |
| `lraLu`            | `number`                       | `status === 'ok'` (optional) | Loudness range (LU)                                  |
| `truePeakDb`       | `number`                       | `status === 'ok'`            | True peak (dBTP / dBFS fallback)                     |
| `trackGainDb`      | `number`                       | `status === 'ok'`            | Предвычисленный gain с headroom −1 dBTP              |
| `manualGainDb`     | `number`                       | optional                     | Ручной override; заменяет `trackGainDb` для playback |
| `fileMtime`        | `number`                       | обычно                       | `mtimeMs` файла на момент скана (staleness)          |
| `algorithmVersion` | `1`                            | `status === 'ok'`            | Версия формулы; bump → повторный скан                |
| `errorMessage`     | `string`                       | `status === 'error'`         | Текст ошибки для UI                                  |

Устаревшее поле `scannedAt` в старых проектах игнорируется; новые сканы его не пишут.

**Staleness:** при загрузке и перед сканом `loudnessService.needsScan` сравнивает `fileMtime` с актуальным `mtime` на диске (`audio:statAudioFile`). Несовпадение, `status !== 'ok'`, отсутствие блока или устаревший `algorithmVersion` ⇒ нужен повторный скан.

**Load normalization:** `status: 'pending'` при загрузке сбрасывается (`normalizeLoadedLoudness`) — прерванный скан не блокирует проект.

**Portable mode:** `loudness` сериализуется вместе с треком; при копировании файлов в `tracks/` относительные пути и `fileMtime` остаются согласованными с скопированными файлами.

См. также: [Нормализация громкости (loudness v1)](../audio/loudness-normalization.md), [IPC `audio:analyzeLoudness`](./ipc-service.md#audio-analyzeloudness).

## Валидация

- Проверка версии формата
- Проверка структуры данных (required fields)
- Проверка ссылочной целостности (все ID существуют)
- Предупреждения о несовместимых версиях
