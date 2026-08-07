# Нормализация громкости (loudness normalization v1)

Недеструктивная нормализация громкости в CherryPlayList: измерение LUFS (Electron — FFmpeg; web demo — детерминированные фикстуры), сохранение метаданных в `.cherry`, применение gain и опциональной **адаптивной компрессии** при playback в renderer.

**Capability gate:** `supportsLoudnessAnalysis` — Electron (реальный FFmpeg) и web demo (детерминированные фикстуры без FFmpeg). Capacitor stub: `false`, UI скана disabled/скрыт. Playback-математика (gain, compression strength) **общая** для всех платформ.

См. также: [Playback Engine — слои](./playback-layers.md), [Project Service — track.loudness](../services/project-service.md), [IPC `audio:analyzeLoudness`](../services/ipc-service.md), [Settings Store](../stores/settings-store.md), [Player workspace](../workspaces/player.md), [Platform layer](../platform/README.md), [Android Capacitor brief](../../android-capacitor-brief.md).

---

## 1. Обзор

| Этап         | Что происходит                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Scan**     | Electron: FFmpeg `ebur128` в main → LUFS / peak / LRA / `trackGainDb`. Web demo: тот же IPC-контракт через `demoLoudnessAnalyzer` (без FFmpeg) |
| **Persist**  | `track.loudness` в `.cherry` (JSON), без изменения исходных аудиофайлов                                   |
| **Playback** | `resolveLinearGain` → `setTrackGain`; опционально `resolveCompressionStrength` → `setCompressionStrength` |

Версия алгоритма: **`LOUDNESS_ALGORITHM_VERSION = 1`**. Bump версии в контрактах ⇒ повторный скан при `needsScan`.

Целевая громкость по умолчанию: **`DEFAULT_LOUDNESS_TARGET_LUFS = -18`** (ReplayGain 2.0 reference). Headroom true peak: **`HEADROOM_DB_TP = -1`** dBTP.

---

## 2. Архитектура и границы модулей

После рефактора ответственности разделены по слоям (DRY/SOLID): контракты и математика — в shared-модулях; scanner — только main; orchestration — в service; engine — только linear gain и compressor params.

| Слой                 | Путь                                                  | Ответственность                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contracts**        | `src/shared/contracts/loudness.ts`                    | **Single source of truth**: `LOUDNESS_ALGORITHM_VERSION`, defaults (`DEFAULT_LOUDNESS_TARGET_LUFS`, `HEADROOM_DB_TP`), `LoudnessSettings`, IPC result types (`LoudnessAnalyzeOk`/`Result`, scanner aliases `LoudnessScan*`) |
| **Core types**       | `src/core/types/track.ts`                             | `TrackLoudness` — persisted shape; re-export `LOUDNESS_ALGORITHM_VERSION` из contracts                                                                                                                                      |
| **Scanner (main)**   | `electron/audio/loudnessScanner.ts`                   | FFmpeg ebur128, parse integrated/true peak/LRA low/LRA, `computeTrackGainDb`, serial queue; импорт constants/types из contracts                                                                                             |
| **Scanner (demo)**   | `src/shared/platform/fixtures/demoLoudnessAnalyzer.ts` | Детерминированные профили по demo-путям; `handleDemoAnalyzeLoudness` / `handleDemoStatAudioFile` через `WebDemoPlatform.invoke`                                                                                              |
| **IPC**              | `electron/ipc/audio.ts` (+ demo handlers)             | `audio:analyzeLoudness`, `audio:statAudioFile` — один контракт; Electron → FFmpeg, web demo → fixtures                                                                                                                      |
| **Service**          | `src/shared/services/loudnessService.ts`              | Scan orchestration: `needsScan`, `scanTrack`/`scanTracks`, `normalizeLoadedLoudness`, `createLoudnessService` — **не** gain math                                                                                            |
| **Gain math**        | `src/shared/audio/loudnessGain.ts`                    | `getEffectiveGainDb`, `resolveLinearGain` (manual override, clamp)                                                                                                                                                          |
| **Compression math** | `src/shared/audio/playback/compressionStrength.ts`    | `resolveCompressionStrength`, `resolveQuietPassageLufs`, constants                                                                                                                                                          |
| **Playback apply**   | `src/shared/audio/playback/applyPlaybackEffects.ts`   | `applyLoudnessPlaybackEffects` (gain+compression only) vs `applyPlaybackEffects` (loudness + default EQ preset on load)                                                                                                     |
| **Playback sync**    | `src/shared/audio/playback/loudnessPlaybackSync.ts`   | Subscriptions; loudness-only helper — смена settings не сбрасывает EQ                                                                                                                                                       |
| **Web Audio**        | `src/shared/audio/playback/WebAudioPlaybackEngine.ts` | `setCompressionStrength(0…1)` → `DynamicsCompressorNode`; bypass при 0                                                                                                                                                      |
| **Settings**         | `src/shared/stores/settingsStore.ts`                  | Persists toggles; тип из contracts                                                                                                                                                                                          |
| **Persistence**      | `src/shared/services/projectService.ts`               | `track.loudness` в `.cherry`; см. [Project Service](../services/project-service.md)                                                                                                                                         |

### Диаграмма потоков

```mermaid
flowchart TB
  subgraph scan [Scan pipeline — Electron or web demo]
    UI[UI / projectStore] --> LS[loudnessService.scanTrack(s)]
    LS --> IPC[IPC audio:analyzeLoudness]
    IPC --> SC[loudnessScanner / demoLoudnessAnalyzer]
    SC --> FF[FFmpeg ebur128 or fixtures]
    FF --> SC
    SC --> IPC
    IPC --> LS
    LS --> PS[projectStore.updateTrackLoudness]
    PS --> CH[.cherry track.loudness]
  end

  subgraph playback [Playback pipeline — renderer]
    LT[loadTrack] --> APE[applyPlaybackEffects]
    APE --> ALPE[applyLoudnessPlaybackEffects]
    ALPE --> LG[loudnessGain.resolveLinearGain]
    ALPE --> CS[compressionStrength.resolveCompressionStrength]
    LG --> ENG[WebAudioPlaybackEngine.setTrackGain]
    CS --> ENG2[WebAudioPlaybackEngine.setCompressionStrength]
    APE --> EQ[setEqualizerBands DEFAULT]
    SET[settings / manual gain change] --> SYNC[wireLoudnessPlaybackSync]
    SYNC --> ALPE
  end

  CH --> LG
  CH --> CS
```

### ASCII (упрощённо)

```
  [Electron main | WebDemoPlatform]     [Renderer]
  loudnessScanner / demoLoudnessAnalyzer
       ──IPC──► loudnessService ──► projectStore ──► .cherry
       ▲                              │
       │                              ▼
  ffmpeg ebur128 | fixtures   loadTrack / settings change
                                     │
                                     ▼
                         applyLoudnessPlaybackEffects
                           ├─ loudnessGain (linear)
                           └─ compressionStrength (0…1)
                                     │
                                     ▼
                         WebAudioPlaybackEngine graph
```

В **web demo** реальный local playback недоступен (`supportsLocalFilePlayback: false`); scan/UI и seeded metadata в `sample.cherry` нужны для дизайна Settings/Player.

---

## 3. Scan pipeline

### Когда запускается скан

| Триггер                         | Где                                             | Условие                                                      |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Добавление трека                | `projectStore` → `enqueueLoudnessScanForTracks` | `loudnessNormalizationEnabled` && `supportsLoudnessAnalysis` |
| Session gate                    | `usePlayerSession` + `useLoudnessScanFlow`      | Первые 3 active трека перед стартом сессии                   |
| Per-track rescan                | `TrackLoudnessRowControls`                      | Кнопка «Сканировать» в popover                               |
| Stale metadata                  | `needsScan` с `currentMtimeMs`                  | `fileMtime !== mtime` на диске                               |
| Algorithm bump                  | `needsScan`                                     | `algorithmVersion !== LOUDNESS_ALGORITHM_VERSION`            |

### `needsScan` (правила)

Функция `needsScan(track, settings, options?, context?)` в `loudnessService.ts`:

1. `!loudnessNormalizationEnabled` → **false**
2. Нет `track.loudness` → **true**
3. `status === 'pending'` → **false**, если трек уже в `context.inFlightTrackIds` (скан идёт)
4. `status !== 'ok'` → **true**
5. `algorithmVersion !== 1` → **true**
6. Если передан `options.currentMtimeMs`: нет `fileMtime` или `fileMtime !== currentMtimeMs` → **true**
7. Иначе → **false**

### FFmpeg и парсинг

**Аргументы** (`runFfmpegEbur128`):

```
ffmpeg -hide_banner -nostats -i <file> -af ebur128=peak=true -f null -
```

**Парсинг stderr** (`parseEbur128Summary`, секция `Summary:`):

| Поле             | Источник в выводе FFmpeg                                             |
| ---------------- | -------------------------------------------------------------------- |
| `integratedLufs` | `I: … LUFS`                                                          |
| `truePeakDb`     | `Peak: … dBTP` (предпочтительно) или dBFS / `TPK:`                   |
| `lraLu`          | `LRA: … LU` в блоке Loudness range                                   |
| `lraLowLufs`     | `LRA low: … LUFS` (10-й перцентиль громкости — proxy тихих участков) |

Timeout FFmpeg масштабируется по размеру файла (2–10 мин). Скан **serial** через внутреннюю очередь (`enqueueScan`) — один FFmpeg за раз в main и один orchestration chain в renderer.

### `computeTrackGainDb`

```text
lufsGainDb     = targetLufs - integratedLufs
headroomCapDb  = headroomDbTp - truePeakDb   // default headroomDbTp = -1
trackGainDb    = min(lufsGainDb, headroomCapDb)
```

Gain ограничивается headroom −1 dBTP, чтобы после усиления не клиповать по true peak.

### Pending normalization on load

`normalizeLoadedLoudness` (`loudnessService.ts`): при загрузке проекта `status: 'pending'` **сбрасывается** (`undefined`) — прерванный скан не блокирует проект и вызовет rescan через `needsScan`.

Вызывается из `projectService.ts` при десериализации треков.

### Cancel / restore

`createLoudnessService` хранит `pendingPreviousLoudness` перед установкой `pending`:

- **Отмена во время `scanTrack`:** восстанавливается предыдущий `loudness` или `{ status: 'error', errorMessage: 'Scan cancelled' }`
- **Отмена batch (`scanTracks`):** `restoreCancelledPending` для всех треков, оставшихся в pending map

`LoudnessCancelToken.cancelled` используется в `useLoudnessScanFlow` и session gate.

---

## 4. Playback pipeline

### Загрузка трека

```
loadTrack (playbackStoreCore / playerAudioStore)
    │
    ▼
applyPlaybackEffects(engine, track, settings)
    ├─ applyLoudnessPlaybackEffects  → gain + compression
    └─ setEqualizerBands(DEFAULT_EQUALIZER_BANDS)
```

`applyDefaultPlaybackEffects` — legacy-обёртка с выключенной нормализацией (unity gain + default EQ).

### Live sync (без сброса EQ)

`wireLoudnessPlaybackSync()` (вызывается из `playerAudioStore.ts` при init):

| Событие                                                                                             | Действие                                                                                     |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `projectStore`: изменился `loudness` текущего main/demo трека (в т.ч. `manualGainDb`)               | `applyLoudnessPlaybackEffects` на соответствующем engine                                     |
| Ручной gain в popover                                                                               | `TrackLoudnessRowControls` → `updateTrackManualGain` + `applyLoudnessChangeToActivePlayback` | Немедленное применение к playback (дублирует sync для надёжности) |
| `settingsStore`: `loudnessNormalizationEnabled`, `loudnessTargetLufs`, `loudnessCompressionEnabled` | Re-apply loudness для текущих main/demo треков                                               |

Используется **`applyLoudnessPlaybackEffects`**, не полный `applyPlaybackEffects` — EQ bands не сбрасываются при смене настроек.

### `resolveLinearGain` (fail-open)

| Условие                                                 | Linear gain                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `!loudnessNormalizationEnabled`                         | `1`                                                              |
| Нет effective gain (`getEffectiveGainDb` → `undefined`) | `1`                                                              |
| Иначе                                                   | `10^(gainDb/20)` clamped `TRACK_GAIN_LINEAR_MIN`…`MAX` (0…~31.6) |

**Effective gain:** `manualGainDb` если задан, иначе `trackGainDb` при `status === 'ok'`.

Ошибки скана (`status: 'error'`) и unscanned треки **не блокируют** playback — unity gain.

### Порядок Web Audio graph (EBU)

```
MediaElementSource
      │
      ▼
EQ (low → mid → high)  ← setEqualizerBands
      │
      ▼
DynamicsCompressor     ← setCompressionStrength; bypass при strength = 0 (LRA block)
      │
      ▼
trackGainNode          ← setTrackGain (R128 linear normalize)
      │
      ▼
masterGainNode → destination
```

При `compressionStrength > 0` routing: `eqHigh → compressor → trackGain → masterGain`. При `0`: `eqHigh → trackGain → masterGain`.

Placeholder autogain (`setAutoGainEnabled`) **не** применяется при включённой нормализации (`applyLoudnessPlaybackEffects` всегда `setAutoGainEnabled(false)`).

---

## 5. Адаптивная компрессия

### Глобальный toggle

`loudnessCompressionEnabled` в `settingsStore` — активен **только** при `loudnessNormalizationEnabled`. UI: «Адаптивная компрессия» в глобальном `TrackSettingsModal` (шестерёнка плеера).

### Per-track strength (0…1)

Константы в `compressionStrength.ts`:

| Константа                                     | Значение | Смысл                                              |
| --------------------------------------------- | -------- | -------------------------------------------------- |
| `COMPRESSION_QUIET_GAP_RANGE_LU`              | 15       | Default полной силы по тихим участкам (алиас `DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU`); runtime: `loudnessQuietGapRangeLu` |
| `COMPRESSION_LRA_MIN_LU`                      | 8        | Ниже — считаем уже сжатым (поп)                    |
| `COMPRESSION_LRA_RANGE_LU`                    | 10       | Полный `dynamicNeed` при LRA ≥ MIN + 10            |
| `COMPRESSION_BOOST_GATE_DB`                   | 3        | Доп. усиление strength только при gain выше порога |
| `COMPRESSION_BOOST_RANGE_DB`                  | 12       | Полный boost-множитель над gate                    |
| `COMPRESSION_LRA_QUIET_ESTIMATE_FACTOR`       | 0.55     | Fallback: integrated − 0.55×LRA                    |
| `COMPRESSION_INTEGRATED_ONLY_QUIET_OFFSET_LU` | 6        | Fallback без LRA: integrated − 6                   |

**Формула:**

```text
quietGapLu   = targetLufs - quietPassageLufs
quietNeed    = clamp(quietGapLu / loudnessQuietGapRangeLu, 0, 1)  // default range 15 LU
dynamicNeed  = clamp((lraLu - 8) / 10, 0, 1)    // resolveDynamicNeed
strength     = quietNeed × dynamicNeed
if gainDb > 3:
  strength   = min(1, strength × (1 + clamp((gainDb - 3) / 12)))
```

`loudnessQuietGapRangeLu` — настройка (`LoudnessSettings`, default `DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU = 15`); `resolveQuietGapRangeLu` подставляет её вместо hard-coded `/15`. Константа `COMPRESSION_QUIET_GAP_RANGE_LU` (= 15) — тот же default, не единственный делитель в рантайме. `gainDb` — effective gain (`getEffectiveGainDb`); **не** входит в произведение как `|gainDb|`. При выключенной compression, `status !== 'ok'`, `quietGap ≤ 0` или неразрешимом `quietPassageLufs` → **0**.

### `resolveQuietPassageLufs` (приоритет fallback)

1. `lraLowLufs` из ebur128 (предпочтительно)
2. `integratedLufs - 0.55 × lraLu`
3. `integratedLufs - 6`
4. `undefined` → strength = 0

### Mapping в `DynamicsCompressorNode` (EBU Tech 3343 gentle)

Fixed: `attack = 0.015`, `release = 1.0`.

При `strength > 0`:

| strength | threshold (dB) | ratio | knee (dB) |
| -------- | -------------- | ----- | --------- |
| **0**    | — (bypass)     | —     | —         |
| **0.5**  | −40            | 1.6:1 | 22.5      |
| **1.0**  | −35            | 2:1   | 15        |

Интерполяция линейная: `threshold = -45 + strength×10`, `ratio = 1.2 + strength×0.8`, `knee = 30 - strength×15`.

### Зачем compression до gain

По EBU R128 / Tech 3343: LRA building block (мягкая компрессия) **до** финального линейного gain. Сужает внутритрековую динамику на исходном материале; затем `trackGain` выравнивает integrated к цели. Работает и при отрицательном gain (громкий трек с широким LRA): тихие участки ниже цели → `quietNeed > 0`, узкий LRA (поп) → `dynamicNeed ≈ 0`.

---

## 6. Settings и UI

### TrackSettingsModal — глобальные настройки (`isGlobal`)

Глобальные loudness-настройки живут в шестерёнке плеера (`onOpenGlobalSettings` → `TrackSettingsModal` с `isGlobal: true`, заголовок «Настройки по умолчанию»). Save/Cancel как у остальных полей модалки; persist через `settingsStore`.

| Поле                           | Store key                      | Default | Примечание                                   |
| ------------------------------ | ------------------------------ | ------- | -------------------------------------------- |
| Включить нормализацию          | `loudnessNormalizationEnabled` | `true`  | disabled при `!supportsLoudnessAnalysis`     |
| Целевая громкость (LUFS)       | `loudnessTargetLufs`           | `-18`   | number input; disabled если нормализация off |
| Адаптивная компрессия          | `loudnessCompressionEnabled`   | `false` | disabled если нормализация off               |
| Терпимость к провалам громкости | `loudnessQuietGapRangeLu`     | preset  | slider + presets; только при compression on  |

Секция **«Нормализация громкости»** в app `SettingsModal` **удалена** (не дублируется). Экспорт/импорт настроек по-прежнему включает loudness-поля через `settingsExportService`.

Подробнее: [Settings Store](../stores/settings-store.md), [Player](../workspaces/player.md).

### `TrackLoudnessPopover` (UX)

Компоновка popover (основной экран без лишней технической простыни):

1. **Усиление** — range slider −30…+30 dB, строка «Авто (target LUFS): … dB», кнопка «Сбросить к авто» при `manualGainDb`. Подсказка у заголовка — иконка ⓘ (как в `SaveProjectAsModal` / `SettingsModal`, native tooltip).
2. **Технические данные** — свёрнутый по умолчанию аккордеон (`ExpandMore` / `ExpandLess`): integrated LUFS, true peak, LRA, тихие участки, расчётное усиление, % компрессии (если включена и strength > 0). У каждой строки — ⓘ с пояснением метрики.
3. **Footer** — «Сканировать» / «Закрыть» (если доступен scan).

Стили: `src/styles/components/player.css` (классы `track-loudness-popover__*`).

### Player UI (прочее)

| Компонент      | Путь                                       | Назначение                                                                                                                                                                                                          |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global settings | `TrackSettingsModal` (`isGlobal`)         | Toggle нормализации, target LUFS, compression, quiet-gap                                                                                                                                                            |
| Progress modal | `LoudnessScanProgressModal`                | Прогресс session gate / scan                                                                                                                                                                                        |
| Row button     | `TrackLoudnessButton`                      | Иконка ok / pending / error / effective gain dB                                                                                                                                                                     |
| Popover        | `TrackLoudnessPopover`                     | Слайдер усиления (−30…+30 dB, live apply); аккордеон «Технические данные» (LUFS, peak, LRA, тихие участки, расчётное усиление, % компрессии); подсказки — иконка ⓘ (`InfoOutlined`, native `title` tooltip); rescan |
| Row wiring     | `TrackLoudnessRowControls`                 | Popover + `updateTrackManualGain` + `applyLoudnessChangeToActivePlayback`; подписка на `projectStore` для актуального `track.loudness`                                                                              |
| Session gate   | `usePlayerSession` + `useLoudnessScanFlow` | Первые **3** active трека (`SESSION_GATE_ACTIVE_TRACK_COUNT`)                                                                                                                                                       |
| Scan hook      | `useLoudnessScanFlow`                      | Cancel token, gate polling, error messages                                                                                                                                                                          |

Session gate utilities: `src/shared/utils/loudnessSessionGate.ts` — `getSessionGateTracks`, `areGateTracksReady`.

Подробнее: [Player workspace](../workspaces/player.md).

---

## 7. Persistence schema (`track.loudness`)

Persisted в `.cherry` на каждом `SavedProjectTrack`. Валидация: `src/shared/utils/projectValidation.ts`.

| Поле               | Тип                            | Когда           | Описание                                           |
| ------------------ | ------------------------------ | --------------- | -------------------------------------------------- |
| `status`           | `'ok' \| 'pending' \| 'error'` | всегда          | Состояние измерения                                |
| `integratedLufs`   | `number`                       | `ok`            | Integrated loudness (LUFS)                         |
| `lraLowLufs`       | `number`                       | `ok` (optional) | EBU R128 LRA low (~10th percentile)                |
| `lraLu`            | `number`                       | `ok` (optional) | Loudness range (LU)                                |
| `truePeakDb`       | `number`                       | `ok`            | True peak (dBTP / dBFS fallback)                   |
| `trackGainDb`      | `number`                       | `ok`            | Предвычисленный gain с headroom −1 dBTP            |
| `manualGainDb`     | `number`                       | optional        | User override; заменяет `trackGainDb` для playback |
| `fileMtime`        | `number`                       | обычно          | `mtimeMs` на момент скана                          |
| `algorithmVersion` | `1`                            | `ok`            | Версия формулы                                     |
| `errorMessage`     | `string`                       | `error`         | Текст для UI                                       |

Поле **`scannedAt` удалено** — не записывается и не валидируется. В старых `.cherry` может остаться в JSON; при следующем скане блок перезаписывается без него.

**Staleness:** `audio:statAudioFile` + сравнение `fileMtime`. **Portable mode:** блок сериализуется вместе с треком при копировании в `tracks/`.

---

## 8. Platform notes

| Платформа          | Scanner          | Playback gain/compression           | UI scan         |
| ------------------ | ---------------- | ----------------------------------- | --------------- |
| **Electron**       | ✓ FFmpeg ebur128              | ✓                                   | ✓               |
| **Web demo**       | ✓ simulated (fixture IPC)     | ✓ (фикстуры + metadata в `.cherry`) | ✓               |
| **Capacitor stub** | ✗                             | ✓                                   | hidden/disabled |

`getPlatformCapabilities().supportsLoudnessAnalysis` — см. [Platform layer](../platform/README.md). Веб-демо: [web-demo.md](../../web-demo.md).

**Web demo details:** профили в `DEMO_LOUDNESS_PROFILES` покрывают пути `DEMO_AUDIO_FILES`; `public/demo/sample.cherry` seeded с `track.loudness`, согласованным с `analyzeDemoLoudness`. Rescan/session gate вызывают тот же `loudnessService` → IPC, что и Electron.

Renderer-логика (`loudnessService`, `loudnessGain`, `compressionStrength`, `applyPlaybackEffects`) **общая**. На Android/Capacitor меняется только adapter для `analyzeLoudness` (план: `ffmpeg-kit`); метаданные из desktop `.cherry` переносятся без пересчёта, пока `fileMtime` совпадает. См. [Android Capacitor brief](../../android-capacitor-brief.md).

---

## 9. Индекс ключевых файлов

| Путь                                                  | Роль                                               |
| ----------------------------------------------------- | -------------------------------------------------- |
| `src/shared/contracts/loudness.ts`                    | Константы, типы, IPC result shapes                 |
| `src/core/types/track.ts`                             | `TrackLoudness`, `Track`                           |
| `electron/audio/loudnessScanner.ts`                   | FFmpeg scan, parse, `computeTrackGainDb`, queue    |
| `electron/ipc/audio.ts`                               | IPC handlers                                       |
| `src/shared/services/loudnessService.ts`              | Scan orchestration, `needsScan`, cancel/restore    |
| `src/shared/audio/loudnessGain.ts`                    | Effective gain, linear conversion                  |
| `src/shared/audio/playback/compressionStrength.ts`    | Adaptive compression strength                      |
| `src/shared/audio/playback/applyPlaybackEffects.ts`   | Apply on load vs loudness-only                     |
| `src/shared/audio/playback/loudnessPlaybackSync.ts`   | Live re-apply subscriptions                        |
| `src/shared/audio/playback/WebAudioPlaybackEngine.ts` | Web Audio graph, compressor mapping                |
| `src/shared/audio/playback/effects.ts`                | `PlaybackEffects` interface, gain limits           |
| `src/shared/stores/settingsStore.ts`                  | User toggles                                       |
| `src/shared/stores/projectStore.ts`                   | Persist, auto-scan on add, `updateTrackManualGain` |
| `src/shared/services/projectService.ts`               | Load/save `.cherry`, `normalizeLoadedLoudness`     |
| `src/shared/utils/loudnessSessionGate.ts`             | Session gate track selection                       |
| `src/workspaces/player/hooks/useLoudnessScanFlow.ts`  | Gate scan UX                                       |
| `src/shared/components/loudness/*`                    | Track loudness UI                                  |
| `src/workspaces/player/TrackSettingsModal.tsx`        | Global loudness settings (`isGlobal`)              |
| `src/shared/platform/fixtures/demoLoudnessAnalyzer.ts` | Demo simulated analyze/stat IPC |
| `tests/electron/loudnessScanner.test.ts`              | Scanner unit tests                                 |
| `tests/shared/services/loudnessService.test.ts`       | Service/orchestration tests                        |
| `tests/shared/services/compressionStrength.test.ts`   | Compression formula tests                          |

---

## Как проверить

1. Electron: `npm run dev` — добавить трек → auto-scan (иконка pending → ok с gain dB).
2. Player → шестерёнка («Настройки проигрывания») → включить адаптивную компрессию → воспроизвести тихий трек с большим gain — слышимое сглаживание динамики (strength > 0).
3. Старт сессии с включённой нормализацией — `LoudnessScanProgressModal` для первых 3 active треков.
4. Сохранить `.cherry`, перезагрузить — `track.loudness` сохранён; изменить файл на диске → `needsScan` true.
5. Popover → покрутить слайдер усиления во время playback — gain меняется сразу; «Технические данные» раскрываются по аккордеону.
6. Web demo (`npm run dev:web` / `dev:web:project`) — Player gear loudness UI доступны; scan возвращает фикстурные профили; `sample.cherry` уже с metadata. Local playback по-прежнему недоступен.
