# Глоссарий CherryPlay

Общие термины и идентификаторы в проектах CherryPlay (CherryPlayList, CherryPlayServer, CherryPlayWeb). Используйте их единообразно в коде и документации.

---

## Роли и участники

| Термин        | Описание                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **organizer** | Организатор вечеринки. Владелец данных; может создавать/редактировать вечеринки, публиковать плейлист, управлять сессией. Входит через JWT (email+пароль или OAuth: VK, Mail.ru в v1; OAuth2 для Telegram отложен). |
| **viewer**    | Зритель. Анонимный пользователь, который смотрит страницу вечеринки в CherryPlayWeb. Только чтение: публичные API и приём событий SignalR.                                                                          |
| **admin**     | Роль организатора с расширенными правами на `/api/admin/*` (поиск организаторов, выдача/отзыв пакетов тем). Проверяется по роли в БД.                                                                               |

---

## Идентификаторы вечеринки

| Термин        | Описание                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **partyId**   | GUID вечеринки на сервере. Используется в API и SignalR **организатора** (REST по partyId, JoinPartyAsOrganizer(partyId), StartSession(partyId) и т.д.). Не показывается зрителю в URL.     |
| **shortCode** | Короткий уникальный код вечеринки для публичных ссылок. Устойчив к похожим символам (0/O, 1/l), **неизменяемый** после создания. Используется в URL для зрителей, в каталоге и при шаринге. |

---

## Режимы и состояние

| Термин                   | Описание                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **session** (сессия)     | **Код:** `sessionState.mode === 'session'` в зоне Проигрывание. **UI:** **«Начать проигрывание»** / **«Остановить проигрывание»**; в шапке **`HeaderPlaybackPill`** — имя трека и управление (только при источнике CherryPlay). При **Онлайн** и `linkedParty` на сайт уходит **состояние**, не звук. **Не путать** с lifecycle-меткой **«Идёт»** (`ready` + session) и с индикатором SignalR **«Онлайн»**. |
| **preparation**          | **Код:** `sessionState.mode === 'preparation'`. Режим подготовки: редактирование плейлиста без локального проигрывания. В шапке **нет** playback pill. Переход к раскладке вечеринки — **Рабочие окна** (preset **«Играть для гостей»**) / guide **«Перейти»** с пульта, либо зоны Party в layout. Пульт (`HeaderPartyStatus`) при **Онлайн** — статус + CTA, без отдельной кнопки раскладки.                                                                                                              |
| **Publish**              | **Код/API:** PUT плейлиста и метаданных (`updatePartyPlaylist`, `updateParty`) через `publishPartyToSite`. **UI (List):** иконка **«Обновить на сайте»** на пульте шапки (только при `linkedParty`; при **Не создана** скрыта) — **не** в модале настроек / Editor toolbar. Альтернативная формулировка **«Обновить для гостей»** может встречаться в copy. **Не путать** с lifecycle **«Сделать доступной»** (`draft` → `ready`, только legacy) и с **Обновить** в модале настроек (метаданные без плейлиста). Новая вечеринка после **Создать** сразу в `ready` (**Ждёт начала**). |
| **freeze**               | Поведение UI зрителя при потере связи: блок «сейчас играет» скрывается; плейлист и пометки проигранных остаются видимыми. Также при завершении сессии организатором состояние на сервере сохраняется (IsActive=false); зрители видят тот же эффект — плейлист и пометки без блока «сейчас играет».                                                                                                          |
| **unlisted**             | Вечеринка не в общем каталоге. **UI:** **«По ссылке»** (`isListedInCatalog=false`). **Отдельно** от lifecycle: вечеринка может быть **«Ждёт начала»** / **«Идёт»**, но оставаться **«По ссылке»**.                                                                                                                                                                                                            |
| **catalog** (в каталоге) | Вечеринка в общем каталоге для зрителей. **UI:** **«В каталоге»** (`isListedInCatalog=true`). Управление флагом в **модале настроек** (секция **«О вечеринке»**, `layout="default"`) / кабинете / **Мои вечеринки** — при lifecycle `ready` и `completed` (чтобы архивная вечеринка не зависала listed без UI). Публичный каталог может включать `completed`, если listed. `draft` в публичный каталог не входит. (`layout="header"`: компактная кнопка без текстовой подсказки секции). |

### CherryPlayList: UI vs код (2026-07)

| В коде / persist                                   | В интерфейсе                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enableStreaming`                                  | **Онлайн** / **Работа без сети** (toggle в настройках; ON — «Связь с сервером и страницей для гостей», OFF — «Работа без сети — запросы к серверу не выполняются»)                                                                                |
| `networkEnabled`                                   | _(внутренний флаг; отдельной метки в UI нет)_                                                                                                                                                                                                     |
| `partyDiscoverabilityEnabled`                      | _(внутренний; preset `party` и зоны Party **всегда** discoverable в меню **Рабочие окна** / picker)_                                                                                                                                             |
| `isListedInCatalog`                                | **В каталоге** / **По ссылке** — флаг ортогонален lifecycle; UI-управление при `ready` и `completed` (Editor, **Мои вечеринки**, кабинет)                                                                                                                                                   |
| `streamingSource`                                  | **Источник проигрывания** (CherryPlay / AIMP; среди playback-related в Settings — первым)                                                                                                                                                          |
| `fileBrowser` (workspace type id)                  | **Файлы** (панель в layout / picker; id остаётся `fileBrowser`)                                                                                                                                                                                      |
| `collection` (workspace type id)                   | **Подборка** (id остаётся `collection`)                                                                                                                                                                                                            |
| `demo-player` (workspace type id)                  | **Предпросмотр (только у вас)** (зона и floating shell; id `demo-player`)                                                                                                                                                                          |
| `linkedParty`                                      | Привязка проекта к серверной вечеринке (`{ id, shortCode }`); баннера «Подключено…» в Editor **нет**                                                                                                                                              |
| `partyLifecycleState` draft/ready/completed        | Единые UI-метки List **и** Web-кабинета (**Не создана** / **Черновик** / **Ждёт начала** / **Идёт** / **В архиве**) — см. [lifecycle UI labels](#cherryplaylist-lifecycle-ui-labels) и [header party-status](#cherryplaylist-header-party-status). Create → `ready` (**Ждёт начала**); `draft` — legacy, не часть нормального create-pipeline. Серверный enum без изменений. |
| `sessionState.mode` preparation/session            | Prep: pill **скрыт**. Session + `cherryPlayPlayer`: pill — трек + play-pause (не зависит от **Онлайн**)                                                                                                                                           |
| SignalR connected (`StreamingConnectionIndicator`) | **Онлайн** _(состояние связи в session pill; не toggle Settings)_                                                                                                                                                                                 |
| Stop (player controls)                             | **Начать заново** — остановка аудио текущего трека (`playerAudioStore.stop`); **не** сброс сессии                                                                                                                                                 |
| Session reset (`PlayerHeader`)                     | **Остановить проигрывание** — `handleResetSession` (режим → `preparation`)                                                                                                                                                                        |

См. [online-mode-ux-synthesis.md](CherryPlayList/docs/online-mode-ux-synthesis.md).

### CherryPlayList: привязка проекта к вечеринке

Одно действие в коде — `setLinkedParty` / `ProjectMeta.linkedParty`. В UI разные глаголы по контексту:

| Контекст                                | Русский UI                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Party Editor, новая запись на сервере   | **Создать** / **Новая вечеринка на сервере**                                         |
| Party Editor, к существующей на сервере | **Привязать** в модале настроек (`title`: привязка существующей вечеринки на сервере к проекту); модалка **«Привязать существующую вечеринку»** |
| **Мои вечеринки**                       | **Привязать** / badge **«Привязана»**                                                |

Баннера **«Подключено к вечеринке»** в Party Editor нет — статус даёт lifecycle-метка / шапка.

### CherryPlayList: lifecycle UI labels

Единые продуктовые метки (`resolvePartyLifecycleDisplayLabel` / `partyLifecycleLabels.ts`). Серверный `PartyLifecycleState` по-прежнему `draft` \| `ready` \| `completed` — **без** новых enum-значений. Кабинет организатора в **CherryPlayWeb** использует те же Sonya-friendly метки и действия (**Ждёт начала**, **В архив**, **Вернуть из архива**, **Сделать доступной** только для legacy `draft`); `draft` не входит в обычный create-pipeline (create → `ready`), но снова виден в списках организатора.

| Условие                             | UI-метка         |
| ----------------------------------- | ---------------- |
| нет `meta.linkedParty`              | **Не создана**   |
| `linkedParty` + `draft`             | **Черновик**     |
| `linkedParty` + `ready`, не session | **Ждёт начала**  |
| `linkedParty` + `ready`, session    | **Идёт**         |
| `linkedParty` + `completed`         | **В архиве**     |

**Черновик ≠ каталог:** метка **«Черновик»** — lifecycle на сервере (ещё готовится), **не** «скрыта из каталога». Видимость в каталоге — отдельно: **«По ссылке»** / **«В каталоге»** (управление при `ready` и `completed`). Tooltip в шапке это явно поясняет (`headerPartyStatusVisuals`).

**Где видны:**

| Поверхность                                         | Метки                                                                                                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AppHeader** (`HeaderPartyStatus`, при **Онлайн**) | Полная лестница, включая **Не создана** и **Идёт** — **основной** статус для организатора                                                                                                                     |
| Party Editor shell phase badge                      | В shipped Editor **всегда скрыт** (`hidePhaseBadge`). Заголовки shell по фазе остаются (**Создание…** / **Настройки…** / **Вечеринка в архиве**) |
| **Мои вечеринки**                                   | Lifecycle badge (`resolvePartyLifecycleServerBadgeLabel`): **Черновик** / **Ждёт начала** / **В архиве** (список `GET /api/parties` снова включает `draft`); для строки, совпадающей с `linkedParty` проекта, при `sessionState.mode === 'session'` и lifecycle `ready` — **Идёт** (session-overlay, как в Editor/шапке) |
| **Кабинет Web** (организатор)                       | Те же статус-метки (**Черновик** / **Ждёт начала** / **В архиве**); actions **Сделать доступной** / **В архив** / **Вернуть из архива**; без return-to-draft (`ready` → `draft`). Session-overlay **Идёт** в кабинете нет                     |
| Preview scenario presets                            | Только server states: **Черновик** / **Ждёт начала** / **В архиве** (без **Не создана** / **Идёт**)                                                                                                                |

### CherryPlayList: lifecycle и действия Party Editor

После **Создать** (`POST /api/parties`) вечеринка сразу в lifecycle `ready` (**Ждёт начала**). Каталог (**По ссылке** / **В каталоге**) — отдельно от lifecycle и от Publish (**Обновить на сайте**): Publish ≠ каталог. Возврата `ready` → `draft` нет (API → **409** `invalid_lifecycle_transition`). Архив (`completed`) **не** терминальный: можно вернуть в `ready`.

Поверхности действий (desktop List, as-built вариант B + пульт):

| Код / действие                       | Русский UI / где                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transitionPartyLifecycle` → `ready` | из `draft`: **Сделать доступной** (секция **«О вечеринке»** в модале настроек, legacy `draft-linked`); из `completed`: **Вернуть из архива** — **только пульт** (не Editor, не **Мои вечеринки**) |
| → `completed`                        | **В архив** — конец ряда действий модала настроек; также **Мои вечеринки** (с confirm; для linked — archive availability)                                                                          |
| `ready` → `draft`                    | В UI **нет**; сервер **запрещает** (**409** `invalid_lifecycle_transition`)                                                                                                                        |
| Publish (плейлист + метаданные)      | **Обновить на сайте** (иконка ↑ на пульте) → `publishPartyToSite`; **не** в модале настроек / Editor toolbar; ≠ **Сделать доступной** и ≠ каталог                                                   |
| **Обновить** (модал настроек)        | секция **«О вечеринке»**: метаданные без плейлиста (`handleSaveMetadata`); Publish (**«Обновить на сайте»**) ≠ эта кнопка                                                                          |
| **Скопировать URL**                  | секция **«О вечеринке»** при `draft-linked`, `ready` и `completed` (есть `linkedParty.url`)                                                                                                        |
| Успех lifecycle                      | Клиент **может** показать toast; **CherryPlayList** success-toast для lifecycle **не** показывает — обновляются badge/кнопки; Web при ошибке — сообщение, success-toast не обязателен |

### CherryPlayList: фазы редактора (`partyEditorPhase`)

Заголовок shell в Party Editor:

| Код              | Заголовок UI                 | Shell phase badge                                                                                    |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `draft-unlinked` | **Создание вечеринки**       | скрыт (`hidePhaseBadge`)                                                                             |
| `draft-linked`   | **Редактирование вечеринки** | скрыт                                                                                                |
| `ready`          | **Настройки вечеринки**      | скрыт                                                                                                |
| `completed`      | **Вечеринка в архиве**       | скрыт                                                                                                |

Настройки вечеринки — центральный модал (`PartySettingsModal` / `openPartySettingsModal`): метаданные, дизайн, track display, опасная зона (**В архив** только `ready`). Первичный статус организатора при **Онлайн** — [AppHeader](#cherryplaylist-header-party-status), не shell badge. Нумерованной ready-phase подсказки **нет**. Контроль каталога — в модале при `ready` и `completed`.

### CherryPlayList: header party-status

Сводка lifecycle и CTA в [`HeaderPartyStatus`](CherryPlayList/src/app/components/HeaderPartyStatus.tsx) (**пульт вечеринки** / `header-party-control`). Каталог и SignalR-«лампа готовности» в шапке **не** показываются.

**Видимость:** только при **Онлайн** (`enableStreaming === true`). При выключенном онлайне блок не рендерится. UX: [party-header-control-ux.md](CherryPlayList/docs/party-header-control-ux.md) (§4 as-built).

| Условие                             | Primary          | Secondary |
| ----------------------------------- | ---------------- | --------- |
| нет `meta.linkedParty`              | **Не создана**   | —         |
| `linkedParty` + `draft`             | **Черновик**     | —         |
| `linkedParty` + `ready`, не session | **Ждёт начала**  | —         |
| `linkedParty` + `ready`, session    | **Идёт**         | —         |
| `linkedParty` + `completed`         | **В архиве**     | —         |

**Overlays поверх «Идёт»** (крупный статус пульта; точка полоски остаётся **Идёт** / этап 3):

| Условие (при базовом **Идёт**) | Primary   | Источник |
| ------------------------------ | --------- | -------- |
| ephemeral `programEnded`       | **Конец** | CherryPlay и AIMP (`partyProgramEndedStore`) |
| иначе `playbackStatus === 'paused'` | **Пауза** | **только** CherryPlay `playerAudioStore.status` (`HeaderPartyStatus` **не** читает AIMP pause) |

**Конец** побеждает **Пауза**. Для **AIMP** live-сессии крупный статус остаётся **«Идёт»**, пока live (пауза AIMP **не** даёт overlay **Пауза** на пульте). Архив в модале при AIMP `paused` → mode `quiet` — **отдельное** поведение (`resolvePartyArchiveAvailability`), не путать с overlay шапки. Состояние `programEnded` + напоминание-таймер — [§7.6](CherryPlayList/docs/party-header-control-ux.md#76-конец-программы--доиграл-последний-трек) (`partyProgramEndedStore`, reminder на пульте; таймер **не** архивирует).

- При `serverUnreachable` primary без изменений; secondary = **нет связи**.
- CTA / Publish ↑ / ⚙ — см. [party-header-control-ux §4](CherryPlayList/docs/party-header-control-ux.md#4-пульт-в-шапке-форма); ↑ и ⚙ **скрыты** при **Не создана** (нет `linkedParty`); отдельной кнопки **«Играть для гостей»** на пульте нет.
- Unarchive привязанного проекта — только CTA пульта (с confirm).

Подробнее: [party.md — Шапка](CherryPlayList/docs/modules/workspaces/party.md#шапка-appheader-статус-и-пульт).

### CherryPlayList: playback pill

| Термин            | Код                              | Русский UI / правило                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **playback pill** | `HeaderPlaybackPill`             | Группа **«Вечеринка и проигрывание»**: трек, transport, громкость, `StreamingConnectionIndicator`.                                                                                                                                                               |
| **видимость**     | `session` + `cherryPlayPlayer`   | Показывается **только** в режиме сессии и источнике CherryPlay. **Не** зависит от `enableStreaming`. В prep — **полностью скрыт** (нет prep-label, readiness lamp, пустого слота). Путь readiness / `getPlaybackPillReadinessHints` в шапке **не** используется. |
| **Мои вечеринки** | `MyPartiesList` в `AccountModal` | Список вечеринок на сервере; каталог; привязка к проекту                                                                                                                                                                                                         |

**Сосуществование с party-status:**

|                                  | Онлайн on                                          | Онлайн off                             |
| -------------------------------- | -------------------------------------------------- | -------------------------------------- |
| **prep**                         | party-status; pill скрыт                           | ни party-status, ни pill               |
| **session** (`cherryPlayPlayer`) | party-status (**Идёт** / **Пауза** / **Конец** при `ready`) + session pill | party-status скрыт; session pill виден |

### CherryPlayList: баннер связи в зоне Party

| Состояние         | Компонент                                  | Русский UI                                                      |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Offline           | `PartyConnectivityBanner` `kind="offline"` | **«Онлайн-функции отключены»**                                  |
| Сервер недоступен | `kind="unreachable"`                       | **«Не удалось подключиться к серверу»**; **«Проверить сейчас»** |

### CherryPlayList: рабочие окна и зоны

Меню встроенных пресетов / framing в шапке — **«Рабочие окна»** (`WorkspaceMenu`; не продуктовый термин «Layout»). Сохранённый пользовательский снимок layout (user / scratch) по-прежнему может называться **рабочим пространством** во внутренних/persist-контекстах.

| Термин / id                         | Код                                              | Русский UI (shipped)                                                                                          |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **меню пресетов**                   | `WorkspaceMenu`                                  | **Рабочие окна** (trigger / aria / секция встроенных)                                                         |
| **layout preset `simple`**          | `LAYOUT_PRESET_DISPLAY_NAMES_RU` / `LAYOUT_PRESET_DESCRIPTIONS_RU` | **Простая сборка** — «Плейлист и панель файлов — минимум панелей» |
| **`collections` / `collections-vertical`** | то же                                      | **Сборка плейлиста** (оба id; у `collections-vertical` — secondary «Вертикальная раскладка: подборки (буфер) и источники»; `DEFAULT_BUILTIN_PRESET` / first-run / fallback — `collections-vertical`; legacy `collections` мигрирует на `collections-vertical`, в меню встроенных не отдельным пунктом) |
| **`player`** (preset)               | то же                                            | **Играть и править** — «Играть локально и править список / файлы в одной раскладке» |
| **`party`** (preset)                | то же                                            | **Играть для гостей** — «Вечеринка для гостей: настройка и превью страницы»; тот же label, что у кнопки шапки |
| **`complex`**                       | factory / id сохранены                           | **не** в меню встроенных (ни prod, ни DEV)                                                                    |
| **`aimp-party`**                    | legacy                                           | **AIMP + Party** — copy/clarity **отложено**; в меню не показывается                                          |
| **zone `fileBrowser`**              | `workspaceDisplayNames`                          | **Файлы**                                                                                                     |
| **zone `collection`**               | то же                                            | **Подборка**                                                                                                  |
| **zone `demo-player`**              | то же (+ floating `DemoPlayerShell`)             | **Предпросмотр (только у вас)**                                                                               |
| **zone `player`**                   | то же                                            | **Проигрывание**                                                                                              |
| **zone `party-editor`**             | то же                                            | **Настройка вечеринки**                                                                                       |
| **zone `party-preview`**            | то же                                            | **Как видят гости**                                                                                           |
| **`test1`…`test8`**                 | зарегистрированы; picker фильтрует               | Не в «добавить зону»; уже открытые зоны продолжают рендериться                                                |

**Не путать:** preset / кнопка **«Играть для гостей»** (раскладка окон для вечеринки) и toggle **«Онлайн»** в настройках (сеть и API); preset **«Играть и править»** (локальное проигрывание) ≠ party-layout.

---

## Оформление

| Термин           | Описание                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PartyTheme**   | Визуальный стиль контента вечеринки: плейлист, текущий трек, страница информации о вечеринке. Значения: cyberpunk, sakura, art-deco, basic (и другие, добавляемые в CherryPlayComponents). **Не путать с темой оболочки** (shell/UI theme) — тёмная/светлая палитра самого приложения (кабинет, список, логин и т.д.), которая будет введена при рефакторинге палитры. |
| **partyThemeId** | Идентификатор PartyTheme (в API и БД поле называется `partyThemeId`).                                                                                                                                                                                                                                                                                                  |

## Монетизация и доступ к темам

| Термин                   | Описание                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **ThemePackage**         | Пакет тем (таблица `theme_packages`) — единица выдачи доступа организатору.                                      |
| **Entitlement**          | Выданное право на пакет (`organizer_entitlements`): может быть активным, истёкшим или отозванным.                |
| **private theme**        | Тема с `visibility=private`; без доступа не показывается в UI и не попадает в `visibleLockedThemes`.             |
| **auto-granted package** | Пакет с `isAutoGranted=true`; темы из него доступны всем организаторам без записей entitlement (пример: `free`). |
| **theme access summary** | Ответ `GET /api/organizer/me/theme-access`: `grantedThemeIds`, `visibleLockedThemes`, `contactUrl`.              |

---

## Данные и контракты

| Термин                                      | Описание                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PlaybackStateDto**                        | DTO состояния воспроизведения: текущий трек, статус (idle/playing/paused/ended), позиция, длительность, volume, mode, playedTrackIds, disabledTrackIds, disabledGroupIds, lastUpdatedAt.                                                                                                                                                                                                       |
| **PartyPlaylistDto**                        | DTO плейлиста вечеринки: items (треки и группы), totalDuration, totalTracks. Без абсолютных путей к файлам.                                                                                                                                                                                                                                                                                    |
| **PartyStateDto**                           | Полное состояние вечеринки для зрителя: partyId, isSessionActive, playbackState?, playlist.                                                                                                                                                                                                                                                                                                    |
| **PublicPartyDto**                          | Публичные метаданные вечеринки по shortCode (название, PartyTheme — поле partyThemeId, флаг «в каталоге», описание/место/дата для страницы info и т.д.).                                                                                                                                                                                                                                       |
| **PublicPartyListItemDto**                  | Элемент списка каталога (GET `/api/parties/public/list`): id, name, shortDescription, city, eventDateTime, timeZone, danceTags, externalLinkUrl, externalLinkText и др. В карточке каталога отображаются только: название, краткое описание, город, дата/время, теги танцев, внешняя ссылка.                                                                                                   |
| **CreatePartyDto**                          | Тело запроса создания вечеринки (name, partyThemeId, customizationSettings, playlistData?, eventDateTime?, shortDescription?, externalLinkUrl?, externalLinkText?, danceTags?, `isListedInCatalog`? и т.д.). Create всегда даёт lifecycle `ready`. `isListedInCatalog` — опция «создать в каталоге» (default `false`). `customizationSettings` — generic JSON. Для `basic` канонический формат: `{ paletteId, customPalette }`, где `customPalette` содержит 5 цветов; legacy-flat `custom*` поддерживается для совместимости. |
| **UpdatePartyDto**                          | Тело запроса обновления метаданных вечеринки (PUT `/api/parties/{partyId}`); все поля опциональны, в т.ч. shortDescription, externalLinkUrl, externalLinkText, danceTags.                                                                                                                                                                                                                      |
| **customizationSettings**                   | JSON-настройки темы в Party API. На сервере принимаются как generic JSON без строгой per-theme валидации схемы; для `basic` рекомендуется каноническая форма `{ paletteId, customPalette }` (5 цветов).                                                                                                                                                                                        |
| **short description** (карточка)            | Краткое описание вечеринки для карточки в каталоге; макс. 200 символов. Редактируется в PartyEditor (CherryPlayList), хранится в Party.ShortDescription.                                                                                                                                                                                                                                       |
| **external link** (вечеринка)               | Внешняя ссылка вечеринки: URL (externalLinkUrl) и опциональный текст (externalLinkText). Отображается на карточке в каталоге.                                                                                                                                                                                                                                                                  |
| **dance tags**                              | Теги танцев вечеринки (до 20: предопределённый набор + свои). Отображаются на карточке в каталоге. Редактируются в PartyEditor, хранятся в Party (DanceTagsJson).                                                                                                                                                                                                                              |
| **partyTrackDisplay** (Party track display) | Настройки CherryPlayList для отображения имён треков на веб‑превью вечеринки и в плейлисте, отправляемом на сервер: опционально скрыть префикс имени — режим **`count`** (N ведущих Unicode code points) или **`untilDelimiter`** (всё до первого символа-разделителя, по умолчанию пробел). Поля: `stripLeadingCharsEnabled`, `stripLeadingCharsMode`, `stripLeadingCharsCount`, `stripLeadingCharsDelimiter`. Хранятся в `ProjectMeta.partyTrackDisplay`, в `.cherry` и persist store; **не** часть `customizationSettings` Party API. Исходные имена треков в проекте не меняются. См. [party.md — track display](CherryPlayList/docs/modules/workspaces/party.md#отображение-имён-треков-party-track-display). |
| **isListedInCatalog**                       | Флаг каталога (ортогонален lifecycle); desktop/Web toggle **«В каталоге»** / **«По ссылке»**. UI-управление при `ready` и `completed` — без тупика для архивных listed. На create: default `false`, optional `true` (чекбокс «создать в каталоге»). Публичный каталог: только listed и не `draft` (`completed` listed допускается). См. **catalog** / **unlisted**. |
| **PasswordResetToken**                      | Одноразовый токен сброса пароля; в БД — таблица `PasswordResetTokens` (только хеш, TTL ~1 ч). Письмо / Dev-лог → Web `/reset-password?token=…`. См. [DATABASE.md](CherryPlayServer/DATABASE.md), [CONTRACTS.md](CONTRACTS.md) §3.2.0a.                                                                                                                                                         |
| **RuSender**                                | Провайдер транзакционной почты (forgot-password). Конфиг: `RUSENDER_*`, `EMAIL_FROM_ADDRESS`. Prod без конфига → **503**; сбой отправки при полном конфиге → soft-fail **200**, токен остаётся usable до TTL. См. [ENV.md](ENV.md), [OPS.md](CherryPlayServer/OPS.md).                                                                                                                                                      |

---

## Компоненты системы

| Термин               | Описание                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **CherryPlayList**   | Десктопное приложение (Electron + React) для организатора: создание плейлистов, вечеринок, управление эфиром, трансляция состояния на сервер. |
| **CherryPlayServer** | Бэкенд (.NET): REST API, SignalR Hub, хранение вечеринок, плейлистов и состояния сессии.                                                      |
| **CherryPlayWeb**    | Веб-приложение (React) для зрителей: просмотр плейлиста и состояния вечеринки в реальном времени.                                             |
| **partyHub**         | SignalR Hub на сервере; URL: `{baseUrl}/partyHub`.                                                                                            |

### UI: shell vs PartyTheme

| Термин                                                             | Описание                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **shell UI**                                                       | Оболочка приложения вне контента вечеринки: модалки, кабинет, заголовок, редактор. Использует примитивы `@cherryplay/components` и CSS `primitives.css`.                                                                                                                                                                                           |
| **UI primitive** (`Button`, `ButtonLink`, `Icon`, `IconButton`, …) | Shared React-компонент оболочки с классами `cp-button`, `cp-icon`, `cp-disclosure` и токенами `--cp-button-*` / `--cp-icon-size-*` из `shell-palette.css`.                                                                                                                                                                                         |
| **дефолтные кнопки shell**                                         | Готовые стили `Button` / `ButtonLink` / `IconButton` из пакета: пакетный primary `#667eea`, danger через `--cp-accent-danger` (`var(--state-error, #d32f2f)`), размеры sm/md — **без** кастомного CSS на каждую кнопку. CherryPlayWeb переопределяет `--accent-primary` в `index.css` (`#00ff88`), CherryPlayList — в `variables.css` (`#4a9eff`). |
| **PartyTheme**                                                     | Изолированный визуальный слой контента вечеринки (`PartyDisplay`, `data-theme`). **Не обязан** наследовать `cp-button` или shell-токены; контракт примитивов на темы не распространяется. См. [THEMES.md](THEMES.md), [CherryPlayComponents/README.md](CherryPlayComponents/README.md#default-shell-buttons).                                      |
| **FormButton**                                                     | Legacy-обёртка над `Button` в `@cherryplay/components` (auth-формы); `outline` → `ghost`. Новый shell UI — через `Button` напрямую.                                                                                                                                                                                                                |

### Файлы (CherryPlayList, зона `fileBrowser`)

Панель в UI — **«Файлы»** (id `fileBrowser`). Внутренние имена модулей/IPC могут оставаться File Browser.

| Термин                            | Описание                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Назад** (кнопка в зоне)         | Возврат к **предыдущему шагу по истории** открытых папок, а не в родительский каталог.                                                                                                                                                                                               |
| **Вверх** (кнопка в зоне)         | Переход в **родительскую** папку в файловой системе. Не путать с «Назад» — при переходе по крошкам/диалогу родитель и «предыдущий в истории» путь различаются. См. [CherryPlayList/docs/modules/workspaces/file-browser.md](CherryPlayList/docs/modules/workspaces/file-browser.md). |

---

## Маршруты и ссылки (целевые по плану v1)

| Формат                     | Описание                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------- |
| **party/<shortCode>**      | Страница просмотра плейлиста и состояния сессии для зрителя.                           |
| **party/<shortCode>/info** | Страница с информацией о вечеринке (описание, место, город, дата, расписание, ссылки). |

_Примечание:_ в текущей реализации CherryPlayWeb может использовать `?party=<shortCode>`; целевой формат по плану — path `party/<shortCode>` и `party/<shortCode>/info`.
