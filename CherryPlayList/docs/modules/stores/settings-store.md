# Settings Store

Store для хранения настроек приложения.

## Описание

Централизованное хранилище всех пользовательских настроек приложения. Данные сохраняются между сессиями через localforage.

## Основные компоненты

- **settingsStore** (`src/shared/stores/settingsStore.ts`) - Store настроек

## Настройки

- **Экспорт**: Путь для экспорта, стратегия экспорта (copyWithNumberPrefix, aimpPlaylist)
- **UI**: Размеры строк треков (small, medium, large), отсечки по времени (интервал, показывать/скрыть)
- **Аудио**: Выбор устройств для player и demo player
- **Нормализация громкости** (`loudnessNormalizationEnabled`, `loudnessTargetLufs`, `loudnessCompressionEnabled`) — см. [Нормализация громкости (loudness v1)](../audio/loudness-normalization.md). Toggles в `SettingsModal`; `loudnessCompressionEnabled` включает **адаптивную** компрессию (strength 0…1 per track). При `!supportsLoudnessAnalysis` (web demo, Capacitor stub) элементы disabled. По умолчанию: нормализация включена, target −18 LUFS, compression выключен.
- **Проекты**: Путь последнего открытого плейлиста
- **Файловый браузер**: Текущая папка (fileBrowserPath) — одна на всё приложение, сохраняется при переключении воркспейсов и между сессиями
- **Стриминг**: Включение/выключение модуля стриминга (enableStreaming)

> **Важно:** Настройки уровня проекта (например, `portableMode`) хранятся в `ProjectSettings` внутри `.cherry` файла и управляются через `projectStore.setPortableMode`. Они **не** являются частью `settingsStore`.

## Размеры строк треков

- `small`: padding 8px, margin 2px
- `medium`: padding 12px, margin 4px (по умолчанию)
- `large`: padding 16px, margin 6px

## Отсечки по времени

Настраиваемый интервал (в секундах): 900 (15 мин), 1800 (30 мин), 3600 (1 час), 7200 (2 часа), 10800 (3 часа).
