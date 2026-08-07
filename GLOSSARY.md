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
| **preparation**          | **Код:** `sessionState.mode === 'preparation'`. Режим подготовки: редактирование плейлиста без локального проигрывания. В шапке **нет** playback pill. Переход к раскладке вечеринки — блок **HeaderPartyStatus** (**«Играть для гостей»**) при включённом **Онлайн**, либо зоны Party в layout.                                                                                                              |
| **Publish**              | **Код/API:** PUT плейлиста и метаданных (`updatePartyPlaylist`, `updateParty`). **UI:** **«Обновить на сайте»** / **«Обновить для гостей»**. **Не путать** с lifecycle **«Опубликовать»** (`draft` → `ready`, только для оставшихся черновиков) — тот меняет статус страницы без обязательного обновления плейлиста. Новая вечеринка после **Создать** сразу в `ready` (**Ждёт начала**); шаг **Опубликовать** не обязателен. |
| **freeze**               | Поведение UI зрителя при потере связи: блок «сейчас играет» скрывается; плейлист и пометки проигранных остаются видимыми. Также при завершении сессии организатором состояние на сервере сохраняется (IsActive=false); зрители видят тот же эффект — плейлист и пометки без блока «сейчас играет».                                                                                                          |
| **unlisted**             | Вечеринка не в общем каталоге. **UI:** **«По ссылке»** (`isListedInCatalog=false`). **Отдельно** от lifecycle: вечеринка может быть **«Ждёт начала»** / **«Идёт»**, но оставаться **«По ссылке»**.                                                                                                                                                                                                            |
| **catalog** (в каталоге) | Вечеринка в общем каталоге для зрителей. **UI:** **«В каталоге»** (`isListedInCatalog=true`). В Party Editor контроль каталога — **только** при lifecycle `ready` (`layout="header"`: кнопка без текстовой подсказки; строка «Отдельно от статуса…» — только в `layout="default"`, в shipped Editor не используется).                                                                                       |

### CherryPlayList: UI vs код (2026-07)

| В коде / persist                                   | В интерфейсе                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enableStreaming`                                  | **Онлайн** / **Работа без сети** (toggle в настройках; ON — «Связь с сервером и страницей для гостей», OFF — «Работа без сети — запросы к серверу не выполняются»)                                                                                |
| `networkEnabled`                                   | _(внутренний флаг; отдельной метки в UI нет)_                                                                                                                                                                                                     |
| `partyDiscoverabilityEnabled`                      | _(внутренний; preset `party` и зоны Party **всегда** discoverable в меню **Рабочие окна** / picker)_                                                                                                                                             |
| `isListedInCatalog`                                | **В каталоге** / **По ссылке** — в Editor только при lifecycle `ready`; также **Мои вечеринки**                                                                                                                                                   |
| `streamingSource`                                  | **Источник проигрывания** (CherryPlay / AIMP; среди playback-related в Settings — первым)                                                                                                                                                          |
| `fileBrowser` (workspace type id)                  | **Файлы** (панель в layout / picker; id остаётся `fileBrowser`)                                                                                                                                                                                      |
| `collection` (workspace type id)                   | **Подборка** (id остаётся `collection`)                                                                                                                                                                                                            |
| `demo-player` (workspace type id)                  | **Предпросмотр (только у вас)** (зона и floating shell; id `demo-player`)                                                                                                                                                                          |
| `linkedParty`                                      | Привязка проекта к серверной вечеринке (`{ id, shortCode }`); баннера «Подключено…» в Editor **нет**                                                                                                                                              |
| `partyLifecycleState` draft/ready/completed        | Единые UI-метки List **и** Web-кабинета (**Не создана** / **Черновик** / **Ждёт начала** / **Идёт** / **Завершена**) — см. [lifecycle UI labels](#cherryplaylist-lifecycle-ui-labels) и [header party-status](#cherryplaylist-header-party-status). Create → `ready` (**Ждёт начала**); `draft` — legacy, не часть нормального create-pipeline. Серверный enum без изменений. |
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
| Party Editor, к существующей на сервере | **Привязать существующую…** (`title`: привязка существующей вечеринки на сервере к проекту); модалка **«Привязать существующую вечеринку»** |
| **Мои вечеринки**                       | **Привязать** / badge **«Привязана»**                                                |

Баннера **«Подключено к вечеринке»** в Party Editor нет — статус даёт lifecycle-метка / шапка.

### CherryPlayList: lifecycle UI labels

Единые продуктовые метки (`resolvePartyLifecycleDisplayLabel` / `partyLifecycleLabels.ts`). Серверный `PartyLifecycleState` по-прежнему `draft` \| `ready` \| `completed` — **без** новых enum-значений. Кабинет организатора в **CherryPlayWeb** использует те же Sonya-friendly метки и действия (**Ждёт начала**, **В архив**, **Опубликовать** только для legacy `draft`); `draft` не входит в обычный create-pipeline (create → `ready`).

| Условие                             | UI-метка         |
| ----------------------------------- | ---------------- |
| нет `meta.linkedParty`              | **Не создана**   |
| `linkedParty` + `draft`             | **Черновик**     |
| `linkedParty` + `ready`, не session | **Ждёт начала**  |
| `linkedParty` + `ready`, session    | **Идёт**         |
| `linkedParty` + `completed`         | **Завершена**    |

**Черновик ≠ каталог:** метка **«Черновик»** — lifecycle на сервере (ещё готовится), **не** «скрыта из каталога». Видимость в каталоге — отдельно: **«По ссылке»** / **«В каталоге»** (только при `ready`). Tooltip в шапке это явно поясняет (`headerPartyStatusVisuals`).

**Где видны:**

| Поверхность                                         | Метки                                                                                                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AppHeader** (`HeaderPartyStatus`, при **Онлайн**) | Полная лестница, включая **Не создана** и **Идёт** — **основной** статус для организатора                                                                                                                     |
| Party Editor shell phase badge                      | Обычно **скрыт**, когда показаны lifecycle-controls (`hidePhaseBadge={showLifecycle}`: фазы `draft-linked` / `ready`). Чаще виден **Завершена** (`completed`) или когда header/lifecycle UI статус не закрывает |
| **Мои вечеринки**                                   | Lifecycle badge (`resolvePartyLifecycleServerBadgeLabel`): **Черновик** / **Ждёт начала** / **Завершена**; для строки, совпадающей с `linkedParty` проекта, при `sessionState.mode === 'session'` и lifecycle `ready` — **Идёт** (session-overlay, как в Editor/шапке) |
| **Кабинет Web** (организатор)                       | Те же статус-метки (**Черновик** / **Ждёт начала** / **Завершена**); actions **Опубликовать** / **В архив**; без **«Вернуть»** / return-to-draft. Session-overlay **Идёт** в кабинете нет                     |
| Preview scenario presets                            | Только server states: **Черновик** / **Ждёт начала** / **Завершена** (без **Не создана** / **Идёт**)                                                                                                                |

### CherryPlayList: lifecycle и действия Party Editor

После **Создать** (`POST /api/parties`) вечеринка сразу в lifecycle `ready` (**Ждёт начала**). Каталог (**По ссылке** / **В каталоге**) — отдельно от lifecycle и от Publish (**Обновить на сайте**). Возврат `ready` → `draft` снят с продукта (API → **409** `invalid_lifecycle_transition`).

| Код / действие                       | Русский UI                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `transitionPartyLifecycle` → `ready` | **Опубликовать** — только для legacy / ещё `draft` (`draft-linked`); happy-path create этот шаг не требует                                 |
| → `completed`                        | **В архив**                                                                                                                                |
| `completed` → `ready`                | В UI **нет** кнопки **«Вернуть»** (controls для `completed` не рендерятся); сервер **запрещает** переход `completed` → `ready`              |
| `ready` → `draft`                    | В UI **нет**; сервер **запрещает** (**409** `invalid_lifecycle_transition`)                                                                |
| Publish (плейлист + метаданные)      | **Обновить для гостей** / **Обновить на сайте**                                                                                            |
| **Скопировать URL**                  | Видна при `draft-linked` и `ready` (есть `linkedParty.url`)                                                                                |
| Успех lifecycle                      | «Вечеринка опубликована» / «Вечеринка в архиве»                                                                                            |

### CherryPlayList: фазы редактора (`partyEditorPhase`)

Заголовок shell в Party Editor:

| Код              | Заголовок UI                 | Shell phase badge                                                                                    |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `draft-unlinked` | **Создание вечеринки**       | —                                                                                                    |
| `draft-linked`   | **Редактирование вечеринки** | Метка **Черновик** в коде есть, но при видимых lifecycle-controls badge **скрыт** (`hidePhaseBadge`) |
| `ready`          | **Публикация и настройки**   | То же: **Ждёт начала** / **Идёт** не показываются в shell, пока видны lifecycle-controls               |
| `completed`      | **Завершённая вечеринка**    | **Завершена** (lifecycle-controls нет → badge обычно виден)                                              |

Первичный статус организатора при **Онлайн** — [AppHeader](#cherryplaylist-header-party-status), не shell badge. Нумерованной ready-phase подсказки в Editor **нет**. Контроль каталога (**«По ссылке»** / **«В каталоге»**) — **только** в фазе `ready`.

### CherryPlayList: header party-status

Сводка lifecycle в [`AppHeader`](CherryPlayList/src/app/components/AppHeader.tsx) — UI-метки (`resolveHeaderPartyStatus` → `resolvePartyLifecycleDisplayLabel`) плюс иконка **i** с native `title` / `aria-label` пояснением (`headerPartyStatusVisuals`). Каталог и SignalR-«лампа готовности» в шапке **не** показываются.

**Видимость:** блок [`HeaderPartyStatus`](CherryPlayList/src/app/components/HeaderPartyStatus.tsx) только при **Онлайн** (`enableStreaming === true`). При выключенном онлайне блок не рендерится.

| Условие                             | Primary          | Secondary |
| ----------------------------------- | ---------------- | --------- |
| нет `meta.linkedParty`              | **Не создана**   | —         |
| `linkedParty` + `draft`             | **Черновик**     | —         |
| `linkedParty` + `ready`, не session | **Ждёт начала**  | —         |
| `linkedParty` + `ready`, session    | **Идёт**         | —         |
| `linkedParty` + `completed`         | **Завершена**    | —         |

- При `serverUnreachable` primary без изменений; secondary = **нет связи**.
- Кнопка **«Играть для гостей»** — icon-only (Dashboard); `title` **«Открыть раскладку «Играть для гостей»»** (или **«Раскладка «Играть для гостей» уже открыта»** при no-op) → `setLayoutPreset('party')` (preset display **«Играть для гостей»**); **no-op**, если уже preset `party` / `aimp-party` или в layout уже есть зоны `party-editor` + `party-preview`. В layout edit mode кнопка disabled.

Подробнее: [party.md — Шапка](CherryPlayList/docs/modules/workspaces/party.md#шапка-appheader-статус-и-pill).

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
| **session** (`cherryPlayPlayer`) | party-status (**Идёт** при `ready`) + session pill | party-status скрыт; session pill виден |

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
| **isListedInCatalog**                       | Флаг каталога; desktop toggle **«В каталоге»** / **«По ссылке»**. На create: default `false`, optional `true` (открыть в каталоге сразу). Независимо от lifecycle. См. **catalog** / **unlisted**.                                                                                                                                                                                                                                                              |
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
