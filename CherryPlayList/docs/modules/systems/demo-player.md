# Demo Player

Глобальная система предпрослушивания треков без очереди, используемая во всех workspace.

**Отображаемое имя в UI** (зона `demo-player` и заголовок floating `DemoPlayerShell`): **«Предпросмотр (только у вас)»** (`workspaceDisplayNames.ts`). Внутренний id — `demo-player`. Не эфир и не гостевой плеер.

Целевая архитектура playback (слои, гибридное состояние, отдельный engine-инстанс `demo`, загрузка через adapter): [Playback Engine — слои](../audio/playback-layers.md) (см. также [Два независимых экземпляра](../audio/playback-layers.md#два-независимых-экземпляра)).

## Описание

Demo Player обеспечивает единое поведение предпрослушивания треков:

- по умолчанию используется как **плавающая панель** над workspace (`.app-content`), когда в текущем layout нет зоны `demo-player` **и** есть активная demo-сессия (загружен трек);
- воспроизводит **один трек за раз**, без очереди и истории;
- используется всеми track‑based workspace (Playlist, Collections, File Browser, Player — в т.ч. в режиме сессии);
- тот же UI `DemoPlayer` используется и во floating-контексте, и в workspace типа `demo-player`;
- синхронизируется с настройками аудиоустройства плеера.

Поддерживаются популярные форматы (MP3, WAV, FLAC, M4A, OGG).

## Основные компоненты

- **demoPlayerStore** (`src/shared/stores/demoPlayerStore.ts`) — store воспроизведения (семантика не зависит от размещения UI)
- **DemoPlayerShell** (`src/app/components/DemoPlayerShell.tsx`) — плавающая панель (drag, кнопка закрытия `X`, suppression при наличии workspace `demo-player`); монтируется из `App.tsx`
- **DemoPlayer workspace** (`src/workspaces/demoPlayer/DemoPlayerWorkspaceView.tsx`) — рендер того же `<DemoPlayer />` внутри layout-зоны типа `demo-player`
- **DemoPlayer** (`src/shared/components/DemoPlayer.tsx`) — UI управления (play/pause, таймлайн, громкость, «Показать в файлах»). В shell/workspace рендерится с `clearOnUnmount={false}`: очистка сессии выполняется в `DemoPlayerShell` (кнопка **X**, cleanup при размонтировании shell), а не при unmount внутреннего `DemoPlayer`.

Дополнительно:

- **usePlaybackPreview** (`src/shared/hooks/usePlaybackPreview.ts`) — унифицированный hook для предпрослушивания треков из любых workspace.
- **settingsStore** — persist позиции и открытости floating-панели (`demoPlayerFloatingPosition`, `demoPlayerFloatingOpen`); см. [Settings Store](../stores/settings-store.md), [клиентское persist](./persisted-client-state.md).

## Размещение

Demo Player рендерится в двух UI-контекстах внутри **одного** окна приложения (DOM), без отдельного окна Electron:

- **Floating**: overlay-панель над `.app-content`.
- **Workspace**: отдельная зона layout с `workspaceType: 'demo-player'`.

- Панель перетаскивается за grip; позиция persist в `demoPlayerFloatingPosition`.
- Открытость floating-панели persist в `demoPlayerFloatingOpen`.
- Основной **плеер** (сессия) размещается только в layout-зоне `player` (не в шапке приложения). Floating / demo player — отдельная поверхность и не заменяет основной плеер.

### Floating: открытие / подавление

- В floating-панели есть кнопка закрытия **X**.
- Нажатие **X** очищает demo-сессию (`clear`) и останавливает текущее предпрослушивание.
- После ручного закрытия (**X**) авто-открытие подавляется для текущего контекста (session epoch + track); панель снова откроется автоматически при новом контексте (другой трек или новая сессия).
- Если floating закрыт и контекст не подавлен, новый запуск предпрослушивания может снова открыть панель автоматически (когда разрешено логикой layout).
- При наличии в текущем layout зоны `demo-player` floating-панель не авто-открывается и принудительно скрывается (suppressed).
- После удаления зоны `demo-player` из layout floating снова может использоваться по текущей логике (`demoPlayerFloatingOpen` + активная demo-сессия).

### Визуальные особенности

- В workspace `demo-player` блок плеера не растягивается на всю высоту зоны: элементы выравниваются к верху, снизу может оставаться пустое пространство.
- Во floating- и workspace-контекстах у внутреннего блока `.demo-player` сняты собственные фон и рамка (прозрачный фон, `border: none`).

### Неизменное поведение

- **Сессия и конфликт устройств** — политика `playbackDeviceConflictSync` и `setDisabled` в `demoPlayerStore`; для floating UI применяются те же `demo-player--blocked` состояния и явные сообщения (см. [Предпрослушивание в режиме сессии](#предпрослушивание-в-режиме-сессии) и [Функциональность](#функциональность)).
- **Режим редактирования layout** — управление floating-панелью и drag отключены; визуально приглушено (`demo-player-panel--layout-blocked`). На контейнер плеера ставится `inert`, в `DemoPlayer` передаётся `interactionBlocked` (все контролы disabled). **Также блокируется** **HeaderPlaybackPill** — см. [layout-edit-mode](../../layout-edit-mode.md) §«Что блокируется в шапке».
- **Интеграция workspace** — `usePlaybackPreview`, кнопки Play в Playlist / Collections / File Browser / Player (preparation и session).

## Функциональность

- Загрузка трека через `PlaybackEngine` (`WebAudioPlaybackEngine`, id `demo`) и `PlatformAudioAdapter`: `audio:getFileUrl` → `cherryplay-audio://` (стриминг, без base64/Blob; см. [Загрузка файлов (Electron)](../audio/playback-layers.md#загрузка-файлов-electron))
- Управление: Play/Pause, перемотка по таймлайну, регулировка громкости
- Таймлайн обнуляется в UI только при `playbackBlocked` (нет трека, ошибка, device conflict); в layout edit (`interactionBlocked`) позиция сохраняется, контролы отключены
- Отображение текущей позиции и общей длительности
- Кнопка **«Показать в файлах»** для навигации к файлу
- Выбор аудиоустройства (синхронизация с player workspace)
- Автоматическая блокировка звука demo **только в режиме сессии** плеера, когда выбран тот же аудио-выход, что и у основного плеера (в т.ч. когда оба «по умолчанию», т.е. оба null); при сбросе сессии блокировка снимается — политика в `playbackDeviceConflictSync.ts` (`shouldBlockSharedOutput`: `devicesMatch && mode === 'session'`); stores вызывают `syncDemoWithMainPlayer` / `syncMainWithDemoPlayer`
- Toast-уведомления об ошибках воспроизведения дедуплицируются на уровне `demoPlayerStore` (`notifyDemoPlayerErrorOnce`); сброс при `clear`, успешной загрузке трека и переходе в `playing`, чтобы повторная ошибка в новом контексте снова показывала toast
- Сессия плеера может быть запущена **без входа в сервис**: локальное воспроизведение и управление сессией не требуют авторизации; публикация на сервер и стриминг — по желанию после входа

### Предпрослушивание в режиме сессии

UX-политика (без отдельного dual-audio engine):

| Аспект | Поведение |
| ------ | --------- |
| **Видимость** | Кнопка предпрослушивания (Play у трека) **всегда** доступна в режиме сессии — не скрывается из‑за session |
| **Успешный путь** | Открывается UI Demo Player и воспроизведение идёт как обычно |
| **Блокировка** | Если воспроизведение невозможно (конфликт устройств / локальный guard) — UI Demo Player **всё равно открывается**; в панели показывается явное сообщение **«Воспроизведение невозможно»** (или эквивалент с пояснением про то же устройство) |
| **Запрещено** | Скрывать кнопку в session; silent no-op по клику без UI |

Точка входа: `usePlaybackPreview` (`startPlayback`) — при blocked-состоянии выставляет `error` / статус и оставляет floating (или workspace demo) открытым.

## Состояния

- `idle` - Плеер не активен
- `loading` - Загрузка источника
- `buffering` - Буферизация (в контракте store/engine; backend может не эмитить)
- `playing` - Воспроизведение
- `paused` - Пауза
- `ended` - Трек завершён

## Интеграция с модулями

- **Playlist / Collections / File Browser**:
  - Используют `usePlaybackPreview` для запуска Demo Player при нажатии на кнопку Play рядом с треком.
  - Позволяют быстро прослушать любой трек, не влияя на основной плейлист и сессию плеера.

- **Player workspace**:
  - В режиме подготовки (`preparation`) Player использует Demo Player через `usePlayerMode` / `usePlaybackPreview` для прослушивания треков без запуска полноценной сессии.
  - В режиме сессии (`session`) очередь и transport основного плеера идут через `playerAudioStore`; кнопка предпрослушивания у трека остаётся доступной. Если demo нельзя играть (то же устройство и т.п.) — UI открывается с сообщением «Воспроизведение невозможно» (см. [выше](#предпрослушивание-в-режиме-сессии)).

Demo Player — самостоятельная система предпрослушивания, дополняющая, но не заменяющая основной плеер с сессиями.
