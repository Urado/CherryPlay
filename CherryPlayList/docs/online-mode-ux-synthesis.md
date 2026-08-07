# Онлайн-режим и Party: синтез идей, проблем и договорённостей

Документ фиксирует результат обсуждения UX вокруг Party, «стриминга» и онлайн-сценария в CherryPlayList.  
Источники: [`pasha_todo.md`](../../pasha_todo.md) (замечания автора), текущая реализация в коде/доках, ответы Павла на уточняющие вопросы (июль 2026).

**Цель:** не потерять контекст перед проектированием UI — что сломано сейчас, во что мы верим продуктово, что уже решено, что ещё открыто.

---

## 1. Две линии взгляда

### 1.1. Замечания из `pasha_todo.md` (внешний акцент)

- Стриминг / трансляция на сайт — **главная ценность** для части пользователей; сейчас спрятан.
- Нужна **заметная** точка входа: «Начать стриминг», «Начать вечеринку» или аналог.
- При запуске стриминга — **автоматически открывать Party**.
- **Party не должна** становиться видимой только после галочки «Включить стриминг» в настройках.
- **Разнести плееры по смыслу:** стриминговый — в Party, локальный — ближе к Playlist; убрать ощущение двух конкурирующих плееров.
- **«Начать сессию»** логичнее в Party, если она про онлайн.
- Party — **центр** всего, что связано с сайтом и гостями.
- Отключение сети — **режим приватности / офлайн**, а не переключатель, от которого зависит видимость основного сценария.

### 1.2. Позиция Павла (уточнённая)

- Приложение — **не один** главный сценарий, а **несколько режимов**:
  1. Оффлайн сборка плейлиста
  2. Оффлайн проигрывание (умные паузы и прочее)
  3. Проигрывание / трансляция **на сайт** (онлайн)
  4. Потенциально — библиотека треков (будущее)
- **Первичный акцент UI:** «собери плейлист», а не «начни эфир».
- Онлайн-сценарий (вечеринка для гостей) **важен**, но не должен **захватывать** весь интерфейс и вытеснять офлайн-сценарии.
- С **`pasha_todo`** частично **не согласен** по акценту «стриминг как единственный главный сценарий» и по идее насильно переключать layout.

---

## 2. Как устроено сейчас (as-is)

### 2.1. Разделение Workspaces и Systems

| Слой           | Что это                             | Примеры                                                                        |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| **Workspaces** | Самостоятельные панели в layout     | Playlist, Player, Party Editor, Party Preview, AIMP, Collections, File Browser |
| **Systems**    | Инфраструктура, сквозные подсистемы | Layout, Streaming (SignalR), Drag-and-drop, Storage, Demo Player               |

Документация: [`docs/modules/README.md`](./modules/README.md), [`docs/modules/systems/streaming.md`](./modules/systems/streaming.md), [`docs/modules/workspaces/party.md`](./modules/workspaces/party.md).

### 2.2. Три разных понятия, которые UI смешивает

| Понятие                             | Где живёт                                                    | Что делает                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Локальная сессия плеера**         | `projectStore.sessionState.mode` (`preparation` / `session`) | Локальное воспроизведение плейлиста; **не требует** сети и аккаунта                                                                       |
| **Party (вечеринка)**               | Party Editor + `meta.linkedParty`                            | Создание/привязка, метаданные, тема, lifecycle, публикация плейлиста на сервер, URL для гостей                                            |
| **Онлайн / трансляция (Streaming)** | `signalRService` + Player (или AIMP)                         | SignalR, позиция, полное состояние, синхронизация с CherryPlayWeb — **только** при `enableStreaming`, привязанной party и активной сессии |

Цепочка по докам: **Party** → URL и метаданные; **Player/AIMP** → источник воспроизведения; **Streaming** → доставка зрителям.

> Локальная сессия **может** работать без Party и без сети. Трансляция — опциональный слой поверх.

### 2.3. Где сейчас «спрятан» онлайн

| Место                                                  | Поведение (после desktop feedback follow-up, 2026-07)                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Settings** → **«Онлайн»** (`enableStreaming`)      | Глобальный privacy/offline; блокирует SignalR и REST, **не** скрывает Party                 |
| **WorkspaceMenu**                                      | Пресет **«Играть для гостей»** (`party`) **всегда** в меню **Рабочие окна** (`partyDiscoverabilityEnabled`) |
| **Party zones**                                        | Всегда в layout; при офлайне — баннер **«Онлайн-функции отключены»** внутри зоны           |
| **AppHeader**                                          | Верхний ряд: слева меню **«Файл»** (⋮), справа **Account** + **Settings**; нижний ряд: **HeaderPartyStatus** (lifecycle UI labels + **«Играть для гостей»**) при **Онлайн**, **HeaderPlaybackPill** только в session (`cherryPlayPlayer`) |
| **PlayerHeader**                                       | **«Начать проигрывание»** / **«Остановить проигрывание»**; Stop в controls — **«Начать заново»** |
| **Settings** → **«Источник проигрывания»**     | `cherryPlayPlayer` \| `aimp`; переключатель в зоне Проигрывание                            |

Внутренний `networkEnabled` (`onlineNetworkPolicy`) зеркалит `enableStreaming` (в т.ч. web demo); hub дополнительно gated через `supportsRealAuth`. **Не** показывается пользователю. См. [party.md](./modules/workspaces/party.md), [веб-демо](./web-demo.md).

### 2.4. Layout и кастомизация workspace (важный контекст)

- Пользователь работает не только с **встроенными пресетами**, но и с **«Мои»** workspace, **scratch** и **режимом редактирования** (✎).
- Layout **кастомизируется**: можно добавить `party-editor`, `party-preview`, `player`, `aimp` и др. в произвольную раскладку без переключения на preset **«Играть для гостей»**.
- Дефолт при первом запуске — **`collections`** (**«Сборка плейлиста»**), не Party.
- Доки: [`layout-system.md`](./modules/systems/layout-system.md), [`layout-edit-mode.md`](./layout-edit-mode.md).

**Вывод:** авто-переключение на preset Party по-прежнему **нежелательно**. Явная кнопка **«Играть для гостей»** (см. §2.3) — opt-in на preset `party` с **no-op**, если layout уже party / aimp-party / editor+preview; кастомные workspace без Party-зон остаются first-class. Отдельного переключателя режимов «Сборка / Проигрывание» в шапке **нет**.

### 2.5. Визуальные / сценарные проблемы

1. ~~**`enableStreaming` управляет и сетью, и discoverability Party**~~ — **исправлено:** split `networkEnabled` / `partyDiscoverabilityEnabled` ([`onlineNetworkPolicy.ts`](../src/shared/streaming/onlineNetworkPolicy.ts)).
2. **«Начать сессию»** звучит как локальное действие, но при наличии party + streaming запускает и SignalR — пользователь не видит связи с «онлайном». _(Частично: переименовано в «Начать проигрывание»; в шапке — **HeaderPartyStatus** + session pill.)_
3. **Два «плеера» в одном layout** (Player + что-то ещё) или **Player vs AIMP** — непонятно, какой источник «на сайт». _(Частично: переключатель в зоне Проигрывание.)_
4. **Party и Player разнесены по зонам** — чтобы управлять вечеринкой и видеть эфир, нужно иметь нужный layout; в другом layout **нет глобального статуса** «идёт проигрывание / идёт онлайн». _(Частично: шапка показывает status + pill без смены layout.)_
5. **Нет единого места в шапке**, где видно: вечеринка, готовность, соединение, факт проигрывания. _(Сделано: **HeaderPartyStatus** + session **HeaderPlaybackPill**; каталог — только Editor / **Мои вечеринки**.)_
6. ~~**Термин «стриминг»** в настройках~~ — **исправлено:** **«Онлайн»** в UI.

---

## 3. Согласованные принципы (to-be, продуктово)

### 3.1. Режимы приложения

| Режим                    | Сеть           | Party                     | Что видит пользователь                                       |
| ------------------------ | -------------- | ------------------------- | ------------------------------------------------------------ |
| Сборка плейлиста         | не обязательна | опционально               | Playlist, подборки, **Файлы** — **основной фокус**       |
| Локальное проигрывание   | не нужна       | не нужна                  | Сессия плеера без трансляции — **допустимо, не главный CTA** |
| Онлайн (страница гостей) | нужна          | нужна                     | Party + источник воспроизведения + трансляция                |
| Privacy / офлайн         | **выключена**  | **видна**, но с заглушкой | «Онлайн-функции отключены» — не прячем концепт Party          |

### 3.2. Терминология (UI)

- Пользовательский термин: **«Онлайн»** (не «стриминг», не обязательно «эфир» в интерфейсе).
- **Не разделять** две отдельные кнопки «начать сессию» и «начать эфир».
- Нужно **одно новое название** для действия старта проигрывания, которое:
  - всегда запускает локальную сессию;
  - **автоматически** включает трансляцию на сайт, если онлайн не отключён в настройках **и** вечеринка настроена;
  - иначе — просто локальное проигрывание без лишних вопросов.
- Если трансляции нет — пользователь либо **сам отключил онлайн** (privacy), либо **не настроил вечеринку** — без отдельного режима «я не хочу эфир, но хочу сессию» как равноправной главной ветки.

### 3.3. Party — видимость и заглушки

- **Party workspace (editor/preview) всегда discoverable** — в picker layout, в меню workspace, как концепт.
- При **privacy/offline** — заглушка «онлайн-функции отключены», не пустота и не исчезновение зоны.
- При **отсутствии логина** — использовать **существующую** заглушку/auth-flow (уже есть).
- **Не привязывать** видимость Party к `enableStreaming`.

### 3.4. Privacy / «не ходить в сеть»

- Нужен **глобальный toggle** (режим приватности / офлайн-работа).
- Он **блокирует** API, SignalR, сетевые запросы.
- Он **не скрывает** Party и не убирает preset/типы workspace из UI.
- Переосмыслить `enableStreaming` → что-то вроде **«Онлайн / работа без сети»**, а не «показать Party».

### 3.5. Шапка приложения — статус, не главный CTA

- В шапке — прежде всего **статус**, не большая кнопка «Начать вечerинку».
- Блок про онлайн/вечеринку должен отражать **минимум контекста**, когда пользователь **в другом layout**:
  - идёт ли **проигрывание плейлиста**;
  - идёт ли **онлайн / трансляция** (если применимо);
  - состояние **текущей вечerинки** (нет / черновик / готова / завершена / …).
- **Shipped (2026-08):** при **Онлайн** — read-only lifecycle status (`HeaderPartyStatus`: **Не создана** / **Черновик** / **Ждёт начала** / **Идёт** / **В архиве**; secondary **нет связи** при unreachable) + кнопка **«Играть для гостей»** → `setLayoutPreset('party')` (no-op на уже party-layout); session-only `HeaderPlaybackPill` (без prep / readiness). Copy и матрица видимости: [GLOSSARY](../../GLOSSARY.md#cherryplaylist-header-party-status), [party.md — Шапка](./modules/workspaces/party.md#шапка-appheader-статус-и-pill).
- **Backlog:** подменю быстрых действий по клику на статус (copy link, reconnect, …); **не** авто-переключать layout при старте проигрывания; **не** вводить mode switcher «Сборка / Проигрывание» в шапке.

### 3.6. Индикатор «готовности к онлайну»

Пользователь должен понимать, **что ещё не готово**. Критерии готовности (**все** значимы):

1. Создана / привязана вечerинка (`linkedParty`)
2. Опубликован актуальный плейлист / метаданные
3. Есть ссылка для гостей
4. Выбран **источник** воспроизведения (CherryPlay Player / AIMP)
5. Запущена **сессия** проигрывания
6. Есть **соединение** с сервером (SignalR / API)

UI может агрегировать это в один статус («Не настроено» / «Почти готово» / «В онлайне») с детализацией в подменю или checklist.

### 3.7. Источник воспроизведения (Player vs AIMP)

- Выбор **не обязательно** оставлять в глобальных Settings как сейчас.
- Гипотеза: настройка **на уровня layout / зоны плеера** — **объединить** AIMP и Player как «один блок источника» с переключателем внутри.
- Открытый вопрос: персистить на уровне приложения, workspace или проекта.

### 3.8. Layout и Party

- Кастомные workspace — **first-class**; пользователь сам решает, где Party Editor/Preview и Player/AIMP.
- Встроенный preset **«Играть для гостей»** (`party`) остаётся **шаблоном**, не единственным входом.
- При `enableStreaming === false` preset **«Играть для гостей»** **всё равно должен быть доступен** — **не скрывать**.

---

## 4. Расхождения с `pasha_todo.md` (осознанные)

| Идея из `pasha_todo`                         | Решение / позиция Павла                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Главная кнопка «Начать стриминг / вечerинку» | **Статус в шапке** + подменю; главный сценарий — плейlist                                                  |
| Авто-открытие Party при старте трансляции    | **Не переключать layout**; достаточно глобального статуса и быстрых действий                               |
| Перенести «Начать сессию» в Party            | **Одна кнопка** с новым именем остаётся у **источника проигрывания** (Player/AIMP), не дублировать в Party |
| Стриминговый плеер только в Party            | Источник — **объединённый блок Player/AIMP**; Party — метаданные, preview, lifecycle                       |
| Локальный плеер под Playlist                 | **Идея на обдумывание**; не зафиксировано в этом документе                                                 |
| Party — единственный центр онлайна           | Party — **центр настройки** вечerинки; **шапка** — центр **наблюдения** за онлайном из любого layout       |

---

## 5. Открытые вопросы (ещё не решено)

### 5.1. Шапка и подменю

- **Сделано (2026-08):** единые lifecycle UI labels + **«Играть для гостей»**; session pill без prep/readiness. См. [GLOSSARY](../../GLOSSARY.md#cherryplaylist-header-party-status).
- **Ещё открыто:** точный набор быстрых действий в **подменю** (если появится); checklist готовности — не в header lamp (§3.6 / §8).
- Где физически в шапке: рядом с именем проекта (текущее) vs отдельный «Онлайн» pill справа — продукт может уточнить.

### 5.2. Название действия старта проигрывания

- **Сделано:** **«Начать проигрывание»** / **«Остановить проигрывание»** (`PlayerHeader`).
- Как в одной кнопке **мягко** сообщить, что онлайн не пойдёт (offline / нет party) — toast, статус в шапке, checklist? — backlog.

### 5.3. Player + AIMP в одном блоке

- UI переключателя источника.
- Поведение при смене источника mid-session.
- Связь с AIMP-party preset и кастомным layout.

### 5.4. Локальный плеер vs Playlist

- Из `pasha_todo`: перенос «обычного» плеера под Playlist — **не обсуждалось** с Павлом напрямую; оставить как backlog.

### 5.5. Технический рефакторинг

- ~~Снятие gate с `WorkspaceMenu` и `PartyStreamingGate`~~ — **сделано** (in-zone stubs, `partyDiscoverabilityEnabled` always true).
- ~~Split `networkEnabled` vs `enableStreaming` в коде~~ — **сделано** (`onlineNetworkPolicy`); пользователь видит только **«Онлайн»**.
- ~~Контроль каталога **«В каталоге»** / **«По ссылке»**~~ — **сделано** в Party Editor и **«Мои вечеринки»**.
- ~~Сводка lifecycle в шапке~~ — **сделано** (`HeaderPartyStatus` + session `HeaderPlaybackPill`); единый online-status hook/store и подменю checklist (§5.1) — backlog.

### 5.6. Модерация / бан пользователей

- Из `pasha_todo` — **API/admin**, не часть текущего UI-обсуждения; не блокирует desktop UX.

---

## 6. Черновик целевой модели UI (для следующего этапа)

```
┌─────────────────────────────────────────────────────────────────┐
│ AppHeader                                                        │
│  [ Workspace pill ▾ ] [ ✎ ]   …   [ Онлайн: статус ▾ ]  …       │
│                                    └─ подменю: checklist,       │
│                                       copy link, party actions   │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         │ layout (кастомный или preset)       │ всегда виден
         ▼                                    ▼
  Playlist / Collections              Privacy OFF → «Онлайн-функции отключены»
   Player или AIMP (источник)          No party → «Вечerинка не настроена»
   Party Editor / Preview (опц.)       In session + connected → «В онлайне»
```

**Settings:** privacy/offline, детали (устройства, экспорт) — **не** gate для Party.

**Party zones:** полная форма + preview; заглушки по auth / offline / server.

**Player/AIMP zone:** одна кнопка старта (новое имя) + локальные controls.

---

## 7. Связанные файлы и доки (implementation map)

| Область          | Файлы / доки                                                                       |
| ---------------- | ---------------------------------------------------------------------------------- |
| Online policy    | `onlineNetworkPolicy.ts`, `useOnlineNetworkPolicy.ts`                              |
| Party connectivity | `PartyConnectivityBanner.tsx`, `PartyEditorView.tsx`, `PartyPreviewView.tsx`     |
| Preset visibility | `WorkspaceMenu.tsx`, `aimpPresetVisibility.ts`                                    |
| Catalog listing  | `PartyCatalogVisibilityControl.tsx`, `partyWorkspaceStore.ts`, `MyPartiesList.tsx` |
| Настройки        | `SettingsModal.tsx`, `settingsStore.ts` (`enableStreaming`, `streamingSource`)     |
| Сессия + SignalR | `PlayerHeader.tsx`, `PlayerControls.tsx`, `usePlayerSession.ts`                    |
| Party actions    | `PartyEditorActions.tsx`, `PartyLifecycleControls.tsx`, `usePartyServerActions.ts` |
| Modals keyboard  | `useModalKeyboard.ts`, `modalKeyboard.ts` — см. [Keyboard Shortcuts](./modules/hooks-utils/keyboard-shortcuts.md#модальные-окна) |
| Layout           | `layoutStore.ts`, `layout-edit-mode.md`, `workspaceLayoutEditOptions.ts`           |
| Streaming system | `docs/modules/systems/streaming.md`, `signalRService.ts`                           |

---

## 8. Краткий checklist для дизайна / реализации

- [x] Отвязать **видимость Party** от `enableStreaming` (2026-07)
- [x] Переформулировать **privacy/offline** отдельно от discoverability Party (`networkEnabled` internal, `partyDiscoverabilityEnabled` always on)
- [x] **Шапка:** **HeaderPartyStatus** (lifecycle labels + **«Играть для гостей»**) при Онлайн; session-only **HeaderPlaybackPill**; **«Мои вечеринки»** — секция в Account. Подменю «Онлайн: статус ▾» с checklist — по-прежнему backlog
- [ ] Агрегировать **checklist готовности** (party, publish, link, source, session, connection) — не в header lamp; backlog (Editor numbered ready-hint убран)
- [x] Переименовать **«Начать сессию»** → **«Начать проигрывание»** / **«Остановить проигрывание»**
- [x] Stop в player controls → **«Начать заново»** (label/a11y; поведение без изменений)
- [x] Унифицировать термин **«Онлайн»** в UI (copy-only, 2026-07)
- [x] **Player/AIMP** как один блок источника (переключатель в зоне Проигрывание)
- [x] Заглушки Party: offline (`PartyConnectivityBanner`), no auth (есть), server down (in-zone banner, не full replace)
- [x] Контроль каталога **«В каталоге»** / **«По ссылке»** в Editor (`ready` и `completed`) и **«Мои вечеринки»**
- [x] Единый контракт клавиатуры модалок (`useModalKeyboard`)
- [x] UI copy rename (2026-08): меню **Рабочие окна**; preset/zone display names; header **«Играть для гостей»**; `complex`/`test*` скрыты из discoverability
- [ ] Учесть **кастомные workspace** — не завязать UX на preset switch _(частично: **«Играть для гостей»** no-op на `party` / `aimp-party` / layout с editor+preview)_
- [ ] Backlog: локальный плеер под Playlist (`pasha_todo`)
- [ ] Backlog: модерация пользователей (`pasha_todo`)

---

## 9. История

| Дата       | Событие                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-04 | Первичный синтез после ревью кода и диалога с Павлом                                                                                                      |
| 2026-07-04 | **Copy rename (UI):** «Онлайн», «Начать проигрывание», Party actions, layout presets, lifecycle badges — см. [GLOSSARY.md](../../GLOSSARY.md) § UI vs код |
| 2026-07-08 | **Desktop feedback follow-up:** Party always visible; `networkEnabled`/`partyDiscoverabilityEnabled` split; catalog control; «Мои вечеринки»; modal keyboard contract; Stop → «Начать заново». См. [party.md](./modules/workspaces/party.md) |
| 2026-08-02 | **Header party-status:** lifecycle UI labels в шапке + **«Играть для гостей»** (ранее «К вечеринке»); session-only playback pill. См. [GLOSSARY](../../GLOSSARY.md#cherryplaylist-header-party-status), [party.md — Шапка](./modules/workspaces/party.md#шапка-appheader-статус-и-pill) |
| 2026-08-02 | **Party lifecycle visual clarity** *(исторически):* единые метки Editor + header; тогда actions **Опубликовать** / **Вернуть в черновик** / **В архив**; каталог только в `ready`; без баннера привязки и ready numbered hint; archive без **«Вернуть»** в UI. Актуальные UI-метки — в строке 2026-08-05; текущие lifecycle-actions — в строке 2026-08-07 |
| 2026-08-03 | **Web-demo dual mode:** `networkEnabled` зеркалит `enableStreaming` (fixtures + live); hub только при `supportsRealAuth` (Electron / `VITE_DEMO_LIVE`). См. [web-demo.md](./web-demo.md) |
| 2026-08-05 | **UI copy rename:** меню **Рабочие окна**; presets **Простая сборка** / **Сборка плейлиста** / **Играть и править** / **Играть для гостей**; зоны **Файлы** (ранее **Источники**) / **Подборка** / **Предпросмотр (только у вас)**; `complex`/`test*` скрыты из discoverability. См. [GLOSSARY](../../GLOSSARY.md#cherryplaylist-рабочие-окна-и-зоны) |
| 2026-08-05 | **Party lifecycle Sonya-friendly labels** *(исторически по actions):* **Не создана** / **Черновик** / **Ждёт начала** / **Идёт** / **Завершена** (display only; server enum `draft`/`ready`/`completed` без изменений); tooltip **Черновик** ≠ каталог (**«По ссылке»** / **«В каталоге»**). Тогда actions **В архив** / **Вернуть в черновик** без смены меток. См. [GLOSSARY — lifecycle UI labels](../../GLOSSARY.md#cherryplaylist-lifecycle-ui-labels); актуальные actions — 2026-08-07 |
| 2026-08-07 | **Party create → `ready`, no return-to-draft:** `POST /api/parties` сразу `ready` (**Ждёт начала**); UI без return-to-draft; `ready` → `draft` запрещён (**409**); тогда UI **Опубликовать** только для legacy `draft` (позже **Сделать доступной** — строка ниже); create default **«По ссылке»** (`isListedInCatalog: false`, optional `true`). См. [GLOSSARY — lifecycle actions](../../GLOSSARY.md#cherryplaylist-lifecycle-и-действия-party-editor), [party.md](./modules/workspaces/party.md), [CONTRACTS.md](../../CONTRACTS.md) |
| 2026-08-07 | **Archive not terminal + drafts in organizer lists:** `completed` → `ready` (тогда UI **Из архива**, позже **Вернуть из архива**); каталог UI при `ready` и `completed`; `GET /api/parties` снова включает `draft` (badge **Черновик**, legacy draft→ready); публичный каталог без `draft`, но listed `completed` допускается. Publish ≠ каталог. См. [CONTRACTS.md](../../CONTRACTS.md) §3.4, [party-management](../../docs/integration/party-management.md) |
| 2026-08-07 | **Lifecycle UI copy (archive-friendly):** badge/status **В архиве** (не «Завершена»); actions **Сделать доступной** / **В архив** / **Вернуть из архива**; shell **Настройки вечеринки** / **Вечеринка в архиве**. Исторические «Опубликовать» / «Завершена» / «Из архива» / «Публикация и настройки» — в строках выше. См. [GLOSSARY](../../GLOSSARY.md#cherryplaylist-lifecycle-ui-labels) |)
