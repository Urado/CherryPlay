# Demo Player

Глобальная система предпрослушивания треков без очереди, используемая во всех workspace.

Целевая архитектура playback (слои, гибридное состояние, отдельный engine-инстанс `demo`, загрузка через adapter): [Playback Engine — слои](../audio/playback-layers.md) (см. также [Два независимых экземпляра](../audio/playback-layers.md#два-независимых-экземпляра)).

## Описание

Demo Player обеспечивает единое поведение предпрослушивания треков:

- располагается в шапке приложения (AppHeader);
- воспроизводит **один трек за раз**, без очереди и истории;
- используется всеми track‑based workspace (Playlist, Collections, File Browser, Player в режиме подготовки);
- синхронизируется с настройками аудиоустройства плеера.

Поддерживаются популярные форматы (MP3, WAV, FLAC, M4A, OGG).

## Основные компоненты

- **demoPlayerStore** (`src/shared/stores/demoPlayerStore.ts`) - Store управления плеером
- **DemoPlayer** (`src/shared/components/DemoPlayer.tsx`) - UI компонент в AppHeader

Дополнительно:

- **usePlaybackPreview** (`src/shared/hooks/usePlaybackPreview.ts`) — унифицированный hook для предпрослушивания треков из любых workspace.

## Функциональность

- Загрузка трека через `PlaybackEngine` (`WebAudioPlaybackEngine`, id `demo`) и `PlatformAudioAdapter`: `audio:getFileUrl` → `cherryplay-audio://` (стриминг, без base64/Blob; см. [Загрузка файлов (Electron)](../audio/playback-layers.md#загрузка-файлов-electron))
- Управление: Play/Pause, перемотка по таймлайну, регулировка громкости
- Отображение текущей позиции и общей длительности
- Кнопка "Показать в браузере" для навигации к файлу
- Выбор аудиоустройства (синхронизация с player workspace)
- Автоматическая блокировка **только в режиме сессии** плеера, когда выбран тот же аудио-выход, что и у основного плеера (в т.ч. когда оба «по умолчанию», т.е. оба null); при сбросе сессии блокировка снимается — политика в `playbackDeviceConflictSync.ts` (`shouldBlockSharedOutput`: `devicesMatch && mode === 'session'`); stores вызывают `syncDemoWithMainPlayer` / `syncMainWithDemoPlayer`
- Сессия плеера может быть запущена **без входа в сервис**: локальное воспроизведение и управление сессией не требуют авторизации; публикация на сервер и стриминг — по желанию после входа

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
  - В режиме подготовки (`preparation`) Player использует Demo Player через `usePlayerMode` для прослушивания треков без запуска полноценной сессии.
  - В режиме сессии (`session`) управление передаётся основному аудиоплееру (`playerAudioStore`), а Demo Player блокируется, если у него выбрано то же устройство, что и у плеера (включая «по умолчанию» для обоих).

Demo Player — самостоятельная система предпрослушивания, дополняющая, но не заменяющая основной плеер с сессиями.
