# Анализ проблем передачи плейлиста и текущего трека (AIMP Plugin → CherryPlayList)

**Примечание:** в текущей реализации плагин при наличии `IAIMPServiceThreads` выполняет сбор снапшотов в главном потоке через `ExecuteInMainThread` (п. 1 ниже). Транспортная отправка по pipe выполняется в отдельном потоке; частота отправки `playbackSnapshot` ограничена минимальным интервалом 500 ms.

## Итог

Наиболее вероятные причины проблем:

1. **Вызов API плейлиста/плеера не из главного потока** — снапшоты строятся в worker-потоке `SnapshotLoop`, тогда как в SDK есть `IAIMPServiceThreads::ExecuteInMainThread`, что указывает на требование главного потока для части API.
2. **Получение свойств плейлиста по неправильному интерфейсу** — используется `IID_IAIMPPropertyList` у объекта плейлиста; в SDK свойства плейлиста описаны для `IAIMPPlaylistProperties` (наследует `IAIMPPropertyList2`).
3. **Сброс текущего трека при несовпадении с плейлистом** — если плейлист пустой или ключи треков не совпадают, `current_track` обнуляется и текущий трек «пропадает» на десктопе.

Ниже — детали и рекомендуемые правки.

---

## 1. Потоковая модель (главный поток)

### Где в коде

- `SnapshotLoop()` выполняется в отдельном потоке (`snapshot_thread_`).
- Из него вызываются:
  - `TrackObservedPlaylistLocked()` → `playlist_manager_->GetPlayingPlaylist()`, `GetActivePlaylist()`, `player_->GetPlaylistItem()`, `item->GetValueAsObject(..., IID_IAIMPPlaylist)` и т.д.
  - `RefreshPlaylistSnapshotLocked()` → `observed->GetItemCount()`, `GetItem()`, `GetGroup()`, чтение свойств плейлиста и элементов.
  - `RefreshPlaybackSnapshotLocked()` → `player_->GetState()`, `GetPosition()`, `GetDuration()`, `GetPlaylistItem()`, `BuildTrackReferenceFromItemLocked()`.

### Что в SDK

- `apiThreading.h`: есть `IAIMPServiceThreads` с методом **`ExecuteInMainThread(IAIMPTask* Task, LongWord Flags)`** — явное указание, что часть логики должна выполняться в главном потоке.
- Обычная практика для плееров/плейлистов: доступ к текущему треку и списку воспроизведения привязан к главному/UI-потоку. Вызовы из фонового потока могут возвращать пустые или устаревшие данные без ошибок.

### Рекомендация

- Получение снапшотов плейлиста и воспроизведения выполнять в главном потоке AIMP через `IAIMPServiceThreads::ExecuteInMainThread`:
  - В `Initialize` сохранить `IAIMPServiceThreads` (через `core->QueryInterface(IID_IAIMPServiceThreads, ...)`).
  - В `SnapshotLoop` не вызывать напрямую `TrackObservedPlaylistLocked` / `RefreshPlaylistSnapshotLocked` / `RefreshPlaybackSnapshotLocked`.
  - Вместо этого поставить задачу (реализация `IAIMPTask`), которая в `Execute` вызывает эти три метода (или одну общую «собрать все снапшоты»), и запускать её через `ExecuteInMainThread(..., AIMP_SERVICE_THREADS_FLAGS_WAITFOR)`.
- Так вы гарантируете, что все вызовы к плейлисту и плееру идут из главного потока и данные (список треков, текущий трек, позиция) должны стать корректными.

---

## 2. Интерфейс свойств плейлиста

### Где в коде

- `RefreshPlaylistSnapshotLocked()`:
  - `playlist_properties = QueryComInterface<IAIMPPropertyList>(observed.Get(), IID_IAIMPPropertyList)`.
  - Дальше используются `AIMP_PLAYLIST_PROPID_ID`, `AIMP_PLAYLIST_PROPID_NAME`, `AIMP_PLAYLIST_PROPID_FOCUSINDEX`, `AIMP_PLAYLIST_PROPID_PLAYBACKCURSOR`, `AIMP_PLAYLIST_PROPID_PLAYINGINDEX`.

### Что в SDK

- `apiPlaylists.h`:
  - `IAIMPPlaylist` объявлен как `class IAIMPPlaylist : public IUnknown` — **не** наследует `IAIMPPropertyList`.
  - Свойства плейлиста описаны как «Property IDs for **IAIMPPropertyList from IAIMPPlaylist**» и отдельно есть интерфейс **`IAIMPPlaylistProperties`** (наследует `IAIMPPropertyList2` → `IAIMPPropertyList`).
- То есть объект плейлиста может отдавать свойства через `IAIMPPlaylistProperties`, а не через «голый» `IAIMPPropertyList`. Если QI по `IID_IAIMPPropertyList` не поддерживается, `playlist_properties` будет nullptr, и все чтения дадут пустые значения (в т.ч. имя/ID плейлиста и индексы активного/играющего трека).

### Рекомендация

- Сначала запрашивать **`IID_IAIMPPlaylistProperties`** у `observed` (привести к `IAIMPPropertyList*` для существующих вызовов `ReadStringProperty` / `ReadIntProperty` — они совместимы).
- Если не удалось — fallback на `IID_IAIMPPropertyList`.
- Так вы получите корректные `playlist_id`, `playlist_name` и `active_index`, даже если AIMP отдаёт свойства только через `IAIMPPlaylistProperties`.

---

## 3. Сброс текущего трека при «не в плейлисте»

### Где в коде

- `RefreshPlaybackSnapshotLocked()`:
  - После `BuildTrackReferenceFromItemLocked(current_item)` проверяется, есть ли этот трек в `playlist_copy.tracks` (по `TrackReference ==`).
  - Если нет: `next_state.current_track.reset()`.

### Почему это может ломать сценарии

- Если из-за потока или неправильного `active_index` плейлист приходит пустым или с другими ключами (например, путь в разном регистре, или один раз по `nativeTrackId`, другой по `filePath`), текущий трек будет считаться «не из плейлиста» и обнуляться.
- В результате на десктопе пропадает отображение текущего трека, хотя в AIMP он играет.

### Рекомендация

- Не сбрасывать `current_track` только из-за отсутствия в текущем снапшоте плейлиста: оставлять трек из `GetPlaylistItem()`, а консистентность проверять на стороне CherryPlayList (как сейчас в `getAimpPlaybackPlaylistConsistencyError` / `reconcilePlaybackSnapshotWithPlaylist`).
- Либо ослабить проверку: сбрасывать только если плейлист не пустой и при этом трек действительно не найден по всем стратегиям идентификации (native/id, path, title+duration), и залогировать такие случаи для отладки.

---

## 4. Проверка по SDK (кратко)

- **apiPlaylists.h**: `GetItem`/`GetItemCount`/`GetGroup`/`GetGroupCount` у `IAIMPPlaylist`; свойства плейлиста — через property list (см. п. 2); `IAIMPServicePlaylistManager::GetActivePlaylist`/`GetPlayingPlaylist` — используются корректно.
- **apiPlayer.h**: `GetPlaylistItem`, `GetState`, `GetPosition`, `GetDuration`, `GetVolume`, `GetMute` — вызовы соответствуют SDK.
- **apiFileManager.h**: `AIMP_FILEINFO_PROPID_*` (в т.ч. KEY=46, FILENAME=18, TITLE=25, DURATION=17, ARTIST=6, ALBUM=1) — используются верно в плагине.
- **apiObjects.h**: `IAIMPPropertyList::GetValueAsObject`/`GetValueAsInt32`/`GetValueAsFloat` — использование корректно.

То есть проблема не в «неправильных» константах или методах, а в потоке выполнения и, возможно, в выборе интерфейса для свойств плейлиста.

---

## 5. Порядок внедрения

1. Внедрить выполнение сбора снапшотов в главном потоке через `IAIMPServiceThreads::ExecuteInMainThread` (п. 1).
2. Добавить получение свойств плейлиста через `IAIMPPlaylistProperties` с fallback на `IAIMPPropertyList` (п. 2).
3. Ослабить или убрать сброс `current_track` при отсутствии в плейлисте и при необходимости добавить логирование (п. 3).

После (1) и (2) передача плейлиста и текущего трека в десктоп должна стабилизироваться; (3) устраняет ложное «пропадание» текущего трека при рассинхроне плейлиста и воспроизведения.
