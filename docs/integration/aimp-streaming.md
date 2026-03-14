# AIMP как источник стриминга

Описание интеграции **AIMP** с CherryPlay: когда организатор выбирает AIMP как источник стриминга, плейлист и состояние воспроизведения передаются из AIMP в CherryPlayList по named pipe, затем на сервер и на сайт вечеринки по тем же контрактам, что и при использовании встроенного плеера.

## Границы поддержки

| Ограничение     | Описание                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Платформа**   | Только Windows.                                                                                                                                               |
| **Архитектура** | Только x64 (AIMP x64 и плагин x64).                                                                                                                           |
| **Режим v1**    | Только чтение: отображение плейлиста и состояния в CherryPlayList, трансляция на сайт. Управление воспроизведением AIMP из приложения в v1 не поддерживается. |

## Установка плагина в AIMP

1. **Собрать плагин** (нужны Windows x64, CMake 3.25+, Visual Studio 2022 или новее, AIMP SDK в `D:\AIMP_SDK\Sources\Cpp` или свой путь через `-DAIMP_SDK_ROOT`):

   ```powershell
   cd CherryPlayAimpPlugin
   cmake --preset vs2022-x64-release
   cmake --build --preset build-release-vs2022
   ```

   Готовый файл: `CherryPlayAimpPlugin\build\vs2022-x64-release\Release\CherryPlayAimpBridge.dll` (или аналог для вашего пресета).

2. **Найти папку Plugins AIMP x64:**
   - Обычно: `C:\Program Files\AIMP\Plugins` (если AIMP ставили в Program Files).
   - Либо: каталог установки AIMP → подпапка `Plugins`.
   - Важно: нужна именно версия **AIMP x64**, не 32-битная.

3. **Скопировать DLL** в эту папку:
   - Скопировать `CherryPlayAimpBridge.dll` в папку `Plugins`.
   - Права: от имени администратора, если папка в Program Files (или запустить проводник с повышенными правами).

4. **Перезапустить AIMP** полностью (закрыть и открыть снова).

5. **Проверка:** в CherryPlayList в настройках выберите источник «AIMP», запустите AIMP — в панели AIMP должно появиться состояние «подключён» и версия плагина. Если плагин не подхватился, проверьте, что установлен AIMP **x64** и DLL лежит в папке **Plugins** именно этой установки.

Подробнее о сборке и пресетах: [CherryPlayAimpPlugin README](../../CherryPlayAimpPlugin/README.md).

## Как включить режим AIMP

1. **Настройки приложения** (Настройки → блок «Стриминг»):
   - Включить стриминг.
   - Выбрать источник **AIMP** (если пункт недоступен — см. раздел «Недоступность AIMP» ниже).
2. CherryPlayList поднимает **named-pipe сервер** `\\.\pipe\cherryplay-aimp-v1` и ждёт подключения плагина.
3. Установить и запустить **плагин AIMP** (см. [CherryPlayAimpPlugin](../../CherryPlayAimpPlugin/README.md)): сборка, копирование DLL в папку Plugins AIMP x64, перезапуск AIMP.
4. После подключения плагина в workspace **AIMP** отображаются плейлист и состояние воспроизведения.
5. **Запуск трансляции на сайт** — только по кнопке **«Старт стриминга»** в панели AIMP. Одно лишь подключение плагина не начинает эфир.

## Протокол (named pipe)

- **Транспорт:** один UTF-8 JSON-объект на строку (newline-delimited), duplex: плагин пишет в pipe, CherryPlayList отвечает (в т.ч. `helloAck` после `hello`).
- **Сообщения от плагина:** `hello`, `playlistSnapshot`, `playbackSnapshot`, `heartbeat`, `goodbye`.
- **Версионирование:** в `hello` передаётся версия протокола; при несовпадении CherryPlayList отвечает отказом, плагин может повторить попытку позже.
- **Heartbeat:** плагин отправляет heartbeat с заданным интервалом; при отсутствии heartbeat в течение таймаута соединение переводится в состояние «устарело» (stale).
- **Жизненный цикл:** при закрытии AIMP плагин по возможности отправляет `goodbye` с причиной; при перезапуске CherryPlayList плагин переподключается и начинает сессию заново с `hello`.

Подробности контракта, DTO и фикстуры: контракт в `CherryPlayList/src/shared/contracts/aimp.ts`, фикстуры в `CherryPlayList/electron/aimp/fixtures/`, сэмплы в `CherryPlayAimpPlugin/samples/*.ndjson`.

## Состояния и gating

- **environment eligible** — ОС Windows, архитектура x64, найден манифест плагина (`plugins/aimp/manifest.json`), источник = AIMP. Без этого выбор AIMP в настройках недоступен или пресет «AIMP + Party» скрыт.
- **app listening** — приложение подняло pipe-сервер и ждёт клиента.
- **plugin connected** — плагин подключился и прошёл handshake.
- **live-stream started** — организатор нажал «Старт стриминга» в панели AIMP; только тогда состояние публикуется на сервер/сайт.

Пресет **«AIMP + Party»** в выборе layout показывается при выбранном источнике AIMP и успешной проверке окружения (Windows x64, манифест плагина). Включённость стриминга на видимость пресета не влияет (она влияет только на выбор fallback-пресета при переключении с AIMP на Player).

## Поведение при обрыве и переключении источника

- **Обрыв плагина или pipe:** для зрителей то же, что обрыв организатора: состояние «замораживается», через 1 мин без реконнекта блок «сейчас играет» скрывается (см. [Streaming](./streaming.md)).
- **Переключение источника обратно на «CherryPlay Player»:** трансляция от AIMP прекращается, стриминг снова идёт от встроенного плеера; пресет «AIMP + Party» скрывается, пока источник снова не станет AIMP.

## Алгоритм передачи плейлиста и имени текущего трека

Ниже — как до приложения и UI доходят **плейлист** и **имя текущего трека** и чем они отличаются от **позиции в треке** (progress/duration).

### 1. Источники данных в плагине (C++)

| Данные                                           | Откуда берутся                                                            | Когда обновляются                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Плейлист (список треков, имена, active)**      | `observed_playlist_` → AIMP: GetActivePlaylist() или GetPlayingPlaylist() | SnapshotLoop по флагам refresh; при смене активного/играющего плейлиста (TrackObservedPlaylistLocked)                                                       |
| **Текущий трек (reference для currentTrackKey)** | Player → GetPlaylistItem()                                                | SnapshotLoop при RefreshPlaybackSnapshotLocked; только если этот трек есть в текущем `playlist_snapshot_.data.tracks` (иначе плагин обнуляет current_track) |
| **Позиция и длительность**                       | Player → GetPosition(), GetDuration()                                     | Тот же RefreshPlaybackSnapshotLocked, всегда из плеера                                                                                                      |

- **observed*playlist*** выставляется в TrackObservedPlaylistLocked: сначала активный плейлист (GetActivePlaylist), если нет — играющий (GetPlayingPlaylist), только если плеер не stopped. Если оба пусты — плейлист в снапшоте пустой (playlist_id/name по умолчанию, tracks = []).
- Плейлист и текущий трек идут **одним сообщением** `playlistSnapshot` (поля `tracks[]`, `activeTrack`, `activeTrackKey`). Позиция/длительность — **другим** сообщением `playbackSnapshot` (`positionMs`, `durationMs`, `currentTrack`, `currentTrackKey`).

### 2. Отправка по pipe (плагин)

- После успешного hello плагин выставляет `playlist_dirty_` и `playback_dirty_`, нотифицирует SnapshotLoop и ждёт ~250 ms, затем в следующей итерации копирует `playlist_snapshot_` и `playback_snapshot_` и отправляет:
  - при `playlist_dirty_` → одна строка JSON `playlistSnapshot` (tracks, activeTrackKey и т.д.);
  - при `playback_dirty_` → одна строка JSON `playbackSnapshot` (positionMs, durationMs, currentTrackKey и т.д.).
- Далее плагин шлёт playlistSnapshot только при изменении плейлиста (playlist*dirty*), playbackSnapshot — при изменении воспроизведения (playback*dirty*). Heartbeat не несёт треков/позиции.

Итог: **плейлист и имя текущего трека** попадают в приложение только через **playlistSnapshot**. **Позиция в треке** — только через **playbackSnapshot**. Порядок прихода сообщений может быть разным (сначала playback, потом playlist или наоборот).

### 3. Приложение (Electron): приём и состояние

- **playlistSnapshot:** парсинг → `validateAimpProtocolMessage` → `normalizeAimpPlaylistSnapshot` → в state пишется `state.playlistSnapshot` (tracks, activeTrackKey, revision и т.д.). Затем вызывается `reconcilePlaybackSnapshotWithPlaylist('playlistSnapshot')`.
- **playbackSnapshot:** парсинг → нормализация → в state пишется `state.playbackSnapshot` (positionMs, durationMs, currentTrackKey, status). Затем вызывается `reconcilePlaybackSnapshotWithPlaylist('playbackSnapshot')`.

**Reconcile:** если в state уже есть `playbackSnapshot` с непустым `currentTrackKey`, но в `playlistSnapshot.tracks` нет трека с таким `trackKey`, приложение считает данные несогласованными и **обнуляет** `state.playbackSnapshot` (логирует "Downgrading playback snapshot due to playlist mismatch"). При этом `state.playlistSnapshot` остаётся. В итоге: позиция/длительность из playback пропадают до следующего валидного playbackSnapshot, а плейлист и имя текущего трека (если они уже пришли) остаются только в playlistSnapshot; но **имя текущего трека** в UI берётся по currentTrackKey/activeTrackKey из треков плейлиста (см. ниже), поэтому при обнулённом playback «текущий трек» может всё ещё отображаться по activeTrackKey, а прогресс-бар — обнулиться.

### 4. Как в UI выводятся плейлист и имя текущего трека

- **Список треков:** `bridgeState.playlistSnapshot?.tracks ?? []`. Если playlistSnapshot не пришёл или пришёл с пустым `tracks`, список пустой.
- **Имя текущего трека (разрешение currentTrackKey):** `getAimpCurrentTrack(bridgeState)`:
  - ключ = `playbackSnapshot.currentTrackKey ?? playlistSnapshot.activeTrackKey`;
  - в `playlistSnapshot.tracks` ищется трек с `track.trackKey === этот ключ` (с учётом нормализации);
  - если найден — подставляются title/artist этого трека; если не найден — `currentTrack === null` (в UI «—» или «No active track»).

Имя текущего трека всегда привязано к плейлисту; позиция (progress bar) — к `playbackSnapshot.positionMs`/`durationMs` (с экстраполяцией при status === 'playing').

### 5. Троттлинг публикации на сервер (приложение)

Чтобы не слать полное состояние на каждое обновление позиции от плагина, приложение использует:

- **getAimpPlaybackPublishKey(state)** — ключ «уже опубликовали это воспроизведение» **без** position и revision. `UpdateFullState` вызывается только при смене трека, статуса, плейлиста или live-stream started.
- **Позиция** передаётся отдельно вызовом **UpdatePlaybackPosition(partyId, trackId, position)** с интервалом **1 с** (подписка в AIMP-режиме).

Итог: зрители получают частые обновления позиции по SignalR и редкие полные состояния при смене трека/плейлиста.

### 6. Чем плейлист/имя трека могут отличаться от позиции

| Ситуация                                                                 | Плейлист / имя текущего трека                                                          | Позиция в треке                                                                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Пришёл только playbackSnapshot (playlist ещё не пришёл или отброшен)     | Нет плейлиста или нет текущего трека (currentTrack = null, в UI «—»/«No active track») | Есть, если playbackSnapshot валиден (positionMs, durationMs)                                                                 |
| Пришёл только playlistSnapshot                                           | Есть список и activeTrackKey; имя текущего — по activeTrackKey                         | Нет (playbackSnapshot = null), прогресс 0 / не обновляется                                                                   |
| Reconcile отбросил playbackSnapshot (currentTrackKey не найден в tracks) | Плейлист и activeTrackKey остаются; имя текущего может быть по activeTrackKey          | Позиция сброшена (playback обнулён), пока не прийдёт новый согласованный playbackSnapshot                                    |
| В AIMP нет активного/играющего плейлиста (observed*playlist* = null)     | Плагин шлёт playlistSnapshot с пустым tracks; в UI пустой список и нет текущего трека  | Может быть (playbackSnapshot с position/duration и currentTrackKey = null), тогда прогресс есть, имя — «—»/«No active track» |
| Разный порядок сообщений                                                 | До прихода playlistSnapshot имя текущего не вывести                                    | position/duration могут уже прийти и отображаться                                                                            |

Итог: **плейлист и имя текущего трека** зависят от принятого **playlistSnapshot** и от того, что в плейлисте есть трек с ключом `currentTrackKey` или `activeTrackKey`. **Позиция в треке** зависит только от **playbackSnapshot** и не требует плейлиста. Поэтому возможна ситуация, когда время и прогресс есть, а список пустой или имя текущего трека не показывается — пока не пришёл или не прошёл валидацию playlistSnapshot с непустым tracks и совпадающим ключом.

### Когда плагин отправляет playlistSnapshot

- **Первый раз после подключения к pipe:** после успешного `hello` → `helloAck` плагин запрашивает обновление снапшотов (SnapshotLoop), ждёт ~250 ms, запрашивает повторное обновление и ждёт ещё ~200 ms, затем в следующей итерации TransportLoop копирует `playlist_snapshot_` и `playback_snapshot_` и отправляет по одной строке `playlistSnapshot` и `playbackSnapshot` (если соответствующие флаги `playlist_dirty_` / `playback_dirty_` были true). Содержимое этого первого снапшота зависит от того, успел ли AIMP выставить активный плейлист к моменту двух прогонов SnapshotLoop: если `GetActivePlaylist()` / `GetPlayingPlaylist()` ещё возвращают null, в `playlistSnapshot` уходит **пустой список треков** (и тогда в приложении список пустой, а имя текущего трека не выводится, пока не придёт следующий непустой playlistSnapshot).
- **Дальше:** плагин отправляет `playlistSnapshot` только когда изменился плейлист: SnapshotLoop вызывает `RefreshPlaylistSnapshotLocked()`, обнаруживает отличия от текущего `playlist_snapshot_.data`, обновляет снапшот и выставляет `playlist_dirty_ = true`; TransportLoop при следующем пробуждении (по флагу или по таймауту heartbeat) копирует снапшот и отправляет его. SnapshotLoop вызывается при событиях AIMP: смена активного/играющего плейлиста, изменение содержимого плейлиста, старт/конец трека, смена позиции и т.д. Если после старта AIMP восстанавливает последний плейлист, но не шлёт такие события (или шлёт с задержкой), первый отправленный playlistSnapshot может остаться пустым; следующий непустой уйдёт только после одного из этих событий.

Итог: **да**, возможна ситуация, когда при старте AIMP первый `playlistSnapshot` уходит до того, как плагин «увидел» активный плейлист и текущий трек, и поэтому с пустым списком треков. Позиция в треке при этом может уже приходить в `playbackSnapshot` (плеер даёт position/duration). Чтобы уменьшить вероятность пустого первого снапшота, плагин после подключения делает два цикла обновления (250 ms + 200 ms) перед первой отправкой.

## Troubleshooting

| Проблема                                       | Что проверить                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Источник AIMP недоступен в настройках**      | Windows x64; наличие `plugins/aimp/manifest.json` (в dev — рядом с приложением, в установленном — в `resources/plugins/aimp/`); при необходимости задать путь к манифесту/ресурсам.                                                                                                                                                                                                 |
| **Пресет «AIMP + Party» не появляется**        | Выбран источник AIMP; окружение прошло проверку (Windows x64, манифест). Включённость стриминга на видимость пресета не влияет.                                                                                                                                                                                                                                                     |
| **Плагин не подключается**                     | AIMP x64 запущен; DLL плагина в папке Plugins AIMP x64; в CherryPlayList выбран источник AIMP и приложение слушает pipe; версия протокола плагина совпадает с версией в CherryPlayList.                                                                                                                                                                                             |
| **Несовпадение версии протокола**              | Обновить плагин или приложение так, чтобы использовалась одна версия протокола (см. контракт `AIMP_PROTOCOL_VERSION`).                                                                                                                                                                                                                                                              |
| **Состояние «устарело» (stale)**               | Плагин перестал слать heartbeat (зависание AIMP, закрытие и т.п.). Перезапуск AIMP или восстановление работы плагина; при необходимости перезапуск CherryPlayList.                                                                                                                                                                                                                  |
| **Плейлист пустой или имя текущего трека «—»** | См. раздел «Алгоритм передачи плейлиста и имени текущего трека»: в AIMP должен быть выбран активный/играющий плейлист с треками; плагин шлёт playlistSnapshot только при observed*playlist*. Проверить, что приходят оба типа сообщений (playlistSnapshot и playbackSnapshot) и что reconcile не обнуляет playback (currentTrackKey должен совпадать с одним из trackKey в tracks). |
| **После переключения на Player что-то не так** | Убедиться, что выбран источник «CherryPlay Player» и пресет изменён при необходимости; перезапуск приложения при сомнительном состоянии.                                                                                                                                                                                                                                            |

## Связанные документы

- [Streaming (обзор)](./streaming.md) — общий поток стриминга организатор → сервер → зрители.
- [Streaming (модуль CherryPlayList)](../../CherryPlayList/docs/modules/systems/streaming.md) — компоненты и потоки в приложении.
- [AIMP (workspace)](../../CherryPlayList/docs/modules/workspaces/aimp.md) — панель AIMP, состояния, пресет, публикация и троттлинг.
- [CherryPlayAimpPlugin README](../../CherryPlayAimpPlugin/README.md) — сборка и установка плагина, протокол NDJSON, троттлинг 500 ms, потоки.
