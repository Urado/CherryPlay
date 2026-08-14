# Player

Workspace для автоматического последовательного воспроизведения плейлистов.

Целевая архитектура playback (слои, граница плейлиста, engine-инстанс main): [Playback Engine — слои](../audio/playback-layers.md).

## Описание

Модуль плеера работает в двух режимах: **подготовка** (редактирование) и **активная сессия** (автоматическое воспроизведение). Поддерживает группировку треков, настраиваемые паузы и управление состоянием проигрывания.

## Основные компоненты

- **PlayerView** (`src/workspaces/player/PlayerView.tsx`) — основной компонент
- **PlayerHeader** (`src/workspaces/player/components/PlayerHeader.tsx`) — шапка зоны (статистика, сессия, утилиты)
- **PlayerControls** (`src/workspaces/player/PlayerControls.tsx`) — панель управления в режиме `session`
- **TrackSettingsDropdown** (`src/workspaces/player/TrackSettingsDropdown.tsx`) — попап настроек трека (список, применение сразу)
- **TrackSettingsModal** (`src/workspaces/player/TrackSettingsModal.tsx`) — модалка настроек трека/группы/по умолчанию (Сохранить/Отмена); при `isGlobal` — также секция нормализации громкости
- **playerAudioStore** (`src/shared/stores/playerAudioStore.ts`) — store управления аудио
- **projectStore** (`src/shared/stores/projectStore.ts`) — главный store проекта (данные плейлиста, группы, настройки, состояние сессии)

## Шапка зоны

`PlayerHeader` — компактная шапка списка в зоне `player`:

- **Ряд 1** (`player-header-toolbar__lead`): статистика (число треков; суммарная длительность — иконка таймера + `hh:mm:ss` с tooltip; при наличии — «Окончание: …») → inline `PlaybackSourceSwitcher` → действия выделения.
- **Ряд 2** (`player-header-actions`): кнопка сессии с фиксированной шириной **~17em** (**«Начать проигрывание»** / **«Остановить проигрывание»**; у Stop — tooltip «Завершает сессию вечера, а не только ставит на паузу») + utilities (настройки, экспорт списка).
- При узком контейнере (`@container` **≤520px** в `player.css`): toolbar в колонку — ряд 1 сверху, ряд 2 снизу (кнопка сессии и utilities в одном горизонтальном ряду, без стека).
- Более плотный padding секции (`padding-block: var(--spacing-xs)`).

Стили: `src/styles/components/player.css` (`.player-header*`, `.player-session-button`).

## Панель управления

`PlayerControls` (класс `.player-controls`) показывается **только в режиме `session`** (`PlayerView`):

- **Ряд 1** (`player-controls__buttons`): transport (Play/Pause, **«Начать заново»**/Stop, Next) | имя трека | громкость — кнопки `size="sm"`.
- **Ряд 2** (`player-controls__timeline-row`): позиция · timeline · длительность трека.

В режиме **session** ползунок позиции **включён**, когда есть текущий трек (та же доступность, что у transport Play/Pause/Stop): seek идёт через `playerAudioStore.seek` → `playbackEngine.seek`. Позиция по-прежнему может синхронизироваться с эфиром для гостей при включённом онлайн. В **preparation** панель `PlayerControls` не показывается; предпрослушивание — через [Demo Player](../systems/demo-player.md).

Стили: `src/styles/components/player.css` (`.player-controls*`). Stop останавливает аудио текущего трека; сброс сессии — только кнопка **«Остановить проигрывание»** в `PlayerHeader` (см. [GLOSSARY](../../../../GLOSSARY.md)).

## Настройки треков и групп

- **Строка трека**: шестерёнка — `title` «Настройки тайминга трека»; **⋮** (`MoreVertIcon`) — `title` «Действия: перейти к треку, удалить и др.» (не путать с шестерёнкой). Mute/disable — «Пропустить трек на вечеринке (можно снова включить)» / «Снова включить трек в проигрывание». Настройки открывают выпадающий попап справа от кнопки. Список действий (по умолчанию, **пауза в конце трека**, без паузы / сплошное, интервал между треками); для «интервал» — поле секунд в той же строке. Выбор применяется сразу, попап закрывается по клику или Escape. Поле задержки: при фокусе значение по умолчанию очищается; стрелки ввода скрыты.
- **Строка группы / по умолчанию**: кнопка настроек в шапке плеера открывает модальное окно **«Настройки по умолчанию»**. Те же опции плюс плановое окончание. Сохранение по кнопке «Сохранить».

## Функциональность

- Добавление треков перетаскиванием из FileBrowser и с диска (Проводник и др.) — та же схема, что у плейлиста/коллекции: внутренний JSON vs нативные `files`, см. [Drag and Drop](../systems/drag-and-drop.md)
- Два режима: подготовка и активная сессия
- Автоматическое последовательное воспроизведение треков
- Группировка треков с настройками на уровне группы
- Настраиваемые паузы между треками (по умолчанию, на уровне группы/трека)
- Управление: Play/Pause, **«Начать заново»** (Stop), Next (только в session), перемотка по таймлайну в session **доступна** при загруженном треке (см. [Панель управления](#панель-управления)); **Space** (`player.togglePlay`) — play/pause основного плеера в session (вне session — no-op; demo не управляется), в том числе при фокусе на строке списка (`ListRow` / `data-list-row`; активация строки — **Enter**) — см. [Keyboard Shortcuts](../hooks-utils/keyboard-shortcuts.md)
- Выбор аудиоустройства для вывода звука
- Отслеживание проигранных треков в режиме сессии
- Отсечки по времени (интервал из настроек) и отдельные линии конца очереди / плана
- Плановое время окончания плейлиста
- Сохранение/загрузка проекта: плейлист плеера и `sessionState` в `.cherry` через меню **Файл** (⋮) в шапке — [Save/Load](../systems/save-load.md)

## Особенности

- `sessionState` входит в `.cherry` вместе с остальным проектом; отдельного `.player.json` в потоке сохранения нет. Формат файла и переносимый режим — там же в [Save/Load](../systems/save-load.md); клиентский persist `projectStore` — [клиентское persist](../systems/persisted-client-state.md)
- Автоматическая синхронизация с demo player при конфликте устройств
- Периодическая проверка доступности треков (каждые 30 секунд)

## Сессии и интеграция

> **Термины в UI и в коде:** в интерфейсе — **«Начать проигрывание»** / **«Остановить проигрывание»** (шапка зоны **Проигрывание** / `PlayerHeader`); в controls сессии Stop — **«Начать заново»**; в коде и persist — `session` / `sessionState.mode`. **Next** виден только в режиме `session`. В **AppHeader** при session + CherryPlay — [`HeaderPlaybackPill`](../../../src/app/components/HeaderPlaybackPill.tsx) (трек/transport; **не** старт сессии). Синхронизация состояния с сервером для гостей — настройка **«Онлайн»** (`enableStreaming`). См. [GLOSSARY](../../../../GLOSSARY.md) (термин **session**, таблица UI), [party.md — Шапка](./party.md#шапка-appheader-статус-и-пульт).

**Session** — воспроизведение плейлиста в зоне **Проигрывание**. Запускается кнопкой **«Начать проигрывание»** и **не зависит от авторизации или наличия вечеринки**. При включённом **Онлайн** и подключённой вечеринке состояние session может синхронизироваться с сервером (только состояние — трек, позиция, плейлист; **звук локально** у организатора). Session работает и без вечеринки.

Плеер работает в двух режимах:

- **Режим подготовки (preparation)**:
  - редактирование плейлиста и групп;
  - настройка пауз и поведения переходов;
  - предпрослушивание треков через [Demo Player](../systems/demo-player.md) без запуска сессии.

- **Режим активной сессии (session)**:
  - автоматическое воспроизведение треков по очереди;
  - учёт истории проигрывания и защита уже сыгранных треков;
  - транспорт основного плеера через `playerAudioStore`;
  - кнопка предпрослушивания у трека **остаётся видимой**; при блокировке звука demo UI всё равно открывается с сообщением «Воспроизведение невозможно» — см. [Demo Player — предпрослушивание в сессии](../systems/demo-player.md#предпрослушивание-в-режиме-сессии).

### Действие после трека

| Значение (`ActionAfterTrack`) | Подпись в UI | Поведение при окончании трека |
| ----------------------------- | ------------ | ----------------------------- |
| `next` | Без паузы | Сразу следующий трек |
| `pauseAndNext` | Интервал между треками | Пауза N с, затем автопереход и play |
| `pause` | **Пауза в конце трека** | **Без** автоперехода: остаёмся на текущем закончившемся треке; дальше — вручную **«Следующий»** (Next) |

Код действия `pause` в типах прежний; продуктовая семантика и подписи — «пауза в конце трека» (не «пауза после трека» / не автопереход на следующий с паузой).

За переключение режимов и старт/сброс сессии отвечает хук  
`usePlayerSession` (`src/workspaces/player/hooks/usePlayerSession.ts`):

- `handleStartSession`:
  - проверяет наличие активных треков (авторизация не требуется — сессия запускается без входа в сервис);
  - при включённой нормализации громкости (`loudnessNormalizationEnabled` + `supportsLoudnessAnalysis`) — **session gate**: ожидает скан первых **3** active треков (или всех, если active < 3) с `loudness.status === 'ok'`; показывает `LoudnessScanProgressModal`; отмена прерывает старт сессии;
  - переводит `sessionState.mode` в `session`;
  - при совпадении аудиоустройств выставляет demo `isDisabled` (звук demo блокируется; кнопка предпрослушивания остаётся — см. выше);
  - запускает воспроизведение первого активного трека;
  - при наличии колбэка `onSessionStart` может запустить трансляцию (Streaming System).
- `handleResetSession`:
  - сбрасывает состояние сессии в `projectStore`;
  - останавливает плеер и очищает таймеры пауз.

### Интеграция с Demo Player

- В режиме подготовки Player использует Demo Player (через `usePlayerMode` / `usePlaybackPreview`), чтобы:
  - прослушивать треки без изменения состояния сессии;
  - не блокировать основной плеер.
- В режиме сессии очередь и transport — у `playerAudioStore`; предпрослушивание через Demo Player **доступно** (кнопка не скрывается). При совпадении устройств demo может быть `isDisabled`: UI открывается, звук не идёт, показывается «Воспроизведение невозможно» — подробнее [Demo Player](../systems/demo-player.md#предпрослушивание-в-режиме-сессии).

Подробнее о системе предпрослушивания см. модуль [Demo Player](../systems/demo-player.md).

### Нормализация громкости (loudness)

Недеструктивная нормализация: измерение LUFS (Electron — FFmpeg; web demo — фикстуры), метаданные в `.cherry`, gain и адаптивная компрессия при playback. Подробности — [Нормализация громкости (loudness v1)](../audio/loudness-normalization.md). В web demo UI скана доступен (`supportsLoudnessAnalysis`); реальный local playback — нет.

| UI / поведение                  | Где                                                | Описание                                                                                                         |
| ------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Иконка на строке трека          | `TrackLoudnessButton` / `TrackLoudnessRowControls` | Состояния ok / pending / unscanned / error; popover: слайдер gain (live), аккордеон «Технические данные», rescan |
| Session gate                    | `usePlayerSession` + `loudnessSessionGate`         | Старт сессии блокируется, пока не готовы первые 3 active трека                                                   |
| Настройки                       | `TrackSettingsModal` (`isGlobal`, шестерёнка)      | Вкл/выкл нормализацию, target LUFS, compression, quiet-gap                                                       |
| Auto-scan при добавлении        | `projectStore.enqueueLoudnessScanForTracks`        | Когда нормализация включена и есть `supportsLoudnessAnalysis`                                                    |

При выключенной фиче или на платформе без `supportsLoudnessAnalysis` иконки скрыты / controls disabled; playback на unity gain.

### Восстановление сессии после перезапуска

При перезапуске приложения Player автоматически восстанавливает состояние последней сессии:

- Если `sessionState.mode === 'session'` и `currentTrackId` установлен, хук `useSessionRecovery` (`src/workspaces/player/hooks/useSessionRecovery.ts`) при монтировании `PlayerViewContainer` загружает текущий трек в `playerAudioStore` в состоянии **paused** (позиция 0).
- Восстановление происходит однократно: `useRef`-флаг предотвращает повторную загрузку при перемонтировании компонента (например, при смене layout) или двойном срабатывании эффекта в React Strict Mode.
- Диалог не отображается; автовоспроизведение не запускается — пользователь нажимает Play вручную.
- Если аудиофайл недоступен, `playerAudioStore.error` устанавливается автоматически, кнопка Play отображает красную иконку ошибки (`ErrorOutlineIcon`); кнопка Next остаётся функциональной.
- Если вечеринка привязана и Site Streamer подключён, full-state publish идёт через `streamingOrchestrator` (существующее поведение после восстановления сессии).

### Отсечки таймлайна в списке треков

**Один ряд — одна отсечка.** После строки трека (`HourDividerAfterTrackRow`, общий для плеера и плейлиста) приоритет фиксирован: **плановое окончание** → **конец очереди** → **интервальный маркер** (`getPriorityHourDividerKind` в `@shared/utils/dividerUtils`). Если на одной строке совпали несколько смыслов, рисуется только линия с наивысшим приоритетом.

- **План** (`playlist-hour-divider--planned-end`) — только в **сессии**, при заданном `plannedEndTime`. Красная линия; подпись **«План»** + время (`timelineCopy.ts` + `formatTimeFromTimestamp` — локальные часы `hh:mm:ss`). Если план приходится на начало списка относительно разметки, линия может выводиться **над** активной строкой трека (до `ProjectItemRow`), а не под предыдущей.
- **Конец очереди** (`playlist-hour-divider--queue-end`) — при `showHourDividers` и положительном интервале: фактический конец текущей раскладки/очереди (в подготовке — сумма длительностей с паузами по неотключённым трекам; в сессии — wall‑clock к концу оставшейся очереди). Подпись **«Конец»** + `hh:mm:ss` (в подготовке — накопленная длительность, в сессии — время суток).
- **Интервал** (`playlist-hour-divider--interval`) — сетка по `hourDividerInterval`; подпись `hh:mm:ss` (подготовка: накопленная длительность с паузами, без проигранных/отключённых по тем же правилам, что и расчёт; сессия: время суток по маркеру). Метка строится через `formatDividerLabel` в `src/workspaces/player/dividerUtils.ts` (делегирование в `dividerPreparationUtils` / `dividerSessionUtils`).

**Внизу списка** (`HourDividerListBottom`, `src/shared/components/PlaylistHourDividerRows.tsx`): план под списком — при сессии и `plannedEndTime`, если `plannedEndDividerPosition === null` (`showPlannedEndDividerAtListBottom`). Конец очереди внизу — при `showQueueEndDividerAtListBottom`. **В отличие от строки после трека**, здесь нет единого приоритета: если оба условия выполняются, под списком рендерятся **две** отсечки подряд — сначала план, затем конец очереди (см. комментарий в компоненте).

**Плейлист и плеер:** `PlaylistView` использует тот же хук **`usePlayerDividers`**, что и плеер (контекст: `flattenItemsForDisplay` / порядок треков, демо‑текущий трек в подготовке, `playerAudioStore` в сессии). Упрощённые `calculateSimpleDividerMarkers` / `formatSimpleDividerLabel` в shared остаются вспомогательными; разметка списка опирается на полный расчёт, согласованный с сессией.

**Формат времени в UI:** единый шаблон **`hh:mm:ss`** с ведущими нулями (`formatTimeFromDuration`, `formatTimeFromTimestamp` в `dividerUtils.ts`, реэкспорт `@shared/utils`). В **PlayerHeader** суммарная длительность — **иконка `TimerIcon` + значение** `formatTimeFromDuration(totalDuration)` (видимой подписи «Длительность» нет; смысл — в `title`/tooltip); `totalDuration` в `PlayerViewContainer` — сумма длительностей **включённых** (не отключённых) треков и пауз между соседними треками при эффективном `pauseAndNext` (`pauseBetweenTracks`), а не «сырая» длина списка файлов. «Окончание» — wall-clock по `projectedEndTime` из `usePlayerDividers` (тот же расчёт, что у таймлайна); в шапке **`formatTimeFromTimestamp(projectedEndTime)`** в `PlayerHeader`.

### Переход к треку (Jump to Track)

В режиме активной сессии каждая строка трека (кроме текущего активного) содержит кнопку-меню (⋮) с действиями над треком. Сейчас доступно одно действие: «Перейти к этому треку».

Хук `useJumpToTrack` (`src/workspaces/player/hooks/useJumpToTrack.ts`) реализует следующую логику при вызове `jumpToTrack(targetTrackId)`:

1. Все треки, стоящие перед целевым (по порядку `getAllTracksInOrder()`), помечаются как проигранные.
2. Если целевой трек или его родительская группа отключены — они включаются.
3. `currentTrackId` в `sessionState` обновляется на целевой трек.
4. Трек загружается в `playerAudioStore` в состоянии paused (позиция 0).

Кнопка не отображается в режиме подготовки (`preparation`), для групп и для текущего активного трека.

### Меню действий трека (`TrackActionsDropdown`)

Компонент `TrackActionsDropdown` (`src/workspaces/player/TrackActionsDropdown.tsx`) — портальный выпадающий список действий над конкретным треком. Открывается по нажатию кнопки ⋮ (`MoreVertIcon`) в строке трека.

**Props:**

| Prop            | Тип                                             | Описание                                   |
| --------------- | ----------------------------------------------- | ------------------------------------------ |
| `trackId`       | `string`                                        | ID трека, над которым выполняется действие |
| `anchorRect`    | `DOMRect`                                       | Позиция кнопки-якоря для позиционирования  |
| `onClose`       | `() => void`                                    | Закрыть дропдаун                           |
| `onJumpToTrack` | `(trackId: string) => Promise<void>` (optional) | Колбэк перехода к треку                    |

Дропдаун закрывается по клику вне него или по нажатию `Escape`. Позиционируется слева от кнопки (или справа, если не хватает места).

**Как добавить новое действие:**

1. Добавить новый опциональный prop в `TrackActionsDropdownProps` (например, `onMarkAsPlayed?: (trackId: string) => void`).
2. Добавить новый `<li>` в список внутри компонента, условно рендеря его только при наличии prop.
3. Передать новый prop из `PlayerTracksList` в `<TrackActionsDropdown>`.

### Prop `onTrackActions` в `ProjectItemRow`

`ProjectItemRow` принимает опциональный prop:

```ts
onTrackActions?: (itemId: string, anchorRect: DOMRect) => void;
```

Когда prop передан, в строке трека (не группы) появляется кнопка ⋮. При клике вызывается `onTrackActions(itemId, buttonRect)`, где `buttonRect` — координаты кнопки для позиционирования дропдауна.

Это **точка расширения** для будущих действий над треком: чтобы добавить новое действие, достаточно расширить `TrackActionsDropdown` новым prop и передать его через `PlayerTracksList`, не меняя `ProjectItemRow`.

### Интеграция со Streaming System

Player может опционально транслировать состояние сессии зрителям вечеринки через  
[Streaming System](../systems/streaming.md) (Site Streamer):

- при `enableStreaming`, привязанной вечеринке (`meta.linkedParty`) и `streamingSource === 'cherryPlayPlayer'`:
  - SignalR lifecycle — **`CherryPlayStreamingController`** + **`useStreamingOrchestrator`**; UI связи в шапке — **`HeaderPlaybackPill`** (только session mode) / **`StreamingConnectionIndicator`** через **`useCherryPlayStreamingConnection`**; сводка lifecycle вечеринки — **`HeaderPartyStatus`** при **Онлайн** (см. [party.md — Шапка](./party.md#шапка-appheader-статус-и-пульт));
  - connect, `StartSession`/`EndSession`, position ticks и full-state publish — **`streamingOrchestrator`** + **`CherryPlayPlayerBroadcastSource`**;
  - live sync плейлиста на сервер — **`partyPlaylistSync`** (REST PUT), не effects в Player UI.
- `PlayerViewContainer` **не** вызывает `signalRService.connect` / `joinPartyAsOrganizer` напрямую и **не** рендерит индикатор соединения.

Локальная сессия Player (`playerAudioStore`, `usePlayerSession`) — источник правды для broadcast source; сессия работает автономно без сервера.

## См. также

- [Режим редактирования layout](../../layout-edit-mode.md) — зона `player` (singleton в picker; legacy `aimp` → `player`)
- [Layout System — минимальные размеры зон](../systems/layout-system.md#минимальные-размеры-зон) — `player`: **360×120** px (`src/workspaces/player/index.ts`)
