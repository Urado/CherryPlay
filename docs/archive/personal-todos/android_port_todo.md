# TODO — Полное отделение платформенного слоя + DRY-унификация плееров

Цель: отделить Electron/FS/OS-зависимости от веб-части `CherryPlayList` так, чтобы UI и бизнес-логика могли работать через платформенный адаптер (в т.ч. Android/WebView), и убрать дублирование в `demoPlayerStore` и `playerAudioStore`.

---

## 1) Аудит и карта зависимостей (Electron -> Renderer)

- [ ] Зафиксировать все вызовы `window.api`/`ipcService` по модулям (`fileBrowser`, `project`, `export`, `audio`, `dialog`, `system`, `auth`, `config`).
- [ ] Разделить вызовы на категории: критично для MVP Android / можно отложить / desktop-only.
- [ ] Отдельно выделить места, где в доменной модели используется файловый `path` как ключевая сущность.
- [ ] Подготовить документ соответствия: `текущий IPC channel -> будущий platform API method`.

Результат: таблица зависимостей и приоритетов миграции.

---

## 2) Введение платформенного контракта (Port/Adapter)

- [ ] Создать интерфейс платформенных возможностей в `src/shared/platform/contracts` (или аналогичном модуле).
- [ ] В контракт включить минимум:
  - [ ] файловую навигацию/метаданные;
  - [ ] чтение бинарного аудио-источника или выдачу streamable URI;
  - [ ] сохранение/загрузку проекта;
  - [ ] экспорт в папку;
  - [ ] диалоги выбора файлов/папок;
  - [ ] openPath/openExternal (опционально по платформе).
- [ ] Запретить прямое использование `window.api` вне слоя адаптера.
- [ ] Перевести `ipcService` из "глобального сервиса" в `electron adapter`, реализующий единый контракт.

Результат: веб-слой зависит от абстракции, а не от Electron API.

---

## 3) Рефактор сервисов на контракт платформы

- [ ] Перевести `fileService` на новый platform contract.
- [ ] Перевести `projectService` на новый platform contract.
- [ ] Перевести `exportService` на новый platform contract.
- [ ] Удалить прямые проверки `isIpcRendererAvailable` из UI-компонентов; заменить на capability flags из адаптера.
- [ ] Добавить graceful fallback-поведение там, где capability отсутствует (например, ограниченный режим WebView).

Результат: сервисы не знают, Electron это, WebView bridge или mock.

---

## 4) Нормализация модели трек-источника (path -> source handle)

- [ ] Ввести кроссплатформенную сущность источника трека (`sourceId`/`uri`/`provider` + metadata), чтобы не зависеть от абсолютных путей.
- [ ] Подготовить миграционный слой для старых проектов с `path` (backward compatibility).
- [ ] Обновить сериализацию/десериализацию проекта под новую модель (с поддержкой legacy-формата).
- [ ] Проверить DnD/selection/dedup-логику на работу с новой идентичностью треков.

Результат: доменная модель готова к Android SAF/URI и не привязана к desktop paths.

---

## 5) DRY-унификация демо и основного плееров

- [ ] Выделить общий модуль загрузки аудио (например, `shared/utils/audioSourceLoader.ts`):
  - [ ] `loadAudioSource(trackSource): Promise<{ objectUrl | streamUrl, mimeType }>`;
  - [ ] `disposeAudioSource(...)`.
- [ ] Выделить общий модуль управления output device + fallback (одинаковое поведение и тексты ошибок).
- [ ] Вынести общий код `HTMLAudioElement` lifecycle:
  - [ ] создание;
  - [ ] подписка/отписка на events;
  - [ ] sync status/position/duration/error.
- [ ] Оставить различия только в бизнес-логике:
  - [ ] demo: source workspace, ограничения preview;
  - [ ] player: session lifecycle, next/stop/pause timers, callbacks.
- [ ] Свести дублированные строки уведомлений/ошибок к единым константам.

Результат: один общий "engine/pipeline" загрузки и воспроизведения, разные orchestration-слои.

---

## 6) Подготовка Android/WebView адаптера

- [ ] Создать `webview/android adapter` (bridge) с реализацией platform contract.
- [ ] Определить стратегию выбора файлов/папок через Android API (SAF/document picker).
- [ ] Определить формат хранения persistent permissions и восстановление после рестарта.
- [ ] Для аудио выбрать стратегию:
  - [ ] URI streaming (предпочтительно);
  - [ ] либо binary transfer (только если неизбежно).
- [ ] Описать ограничения DnD на мобильных и альтернативный UX (add/move actions).

Результат: технически работоспособный адаптер вместо Electron.

---

## 7) Тесты и контроль регрессий

- [ ] Добавить unit-тесты для общего audio loader/pipeline (успех, ошибки, cleanup URL).
- [ ] Добавить unit-тесты для platform contract adapters (mocked).
- [ ] Добавить тесты на backward compatibility загрузки старых `.cherry` с `path`.
- [ ] Добавить integration-сценарии:
  - [ ] импорт треков;
  - [ ] предпрослушивание;
  - [ ] старт/стоп основной сессии;
  - [ ] сохранение и повторная загрузка проекта;
  - [ ] экспорт.

Результат: рефактор безопасен и воспроизводим.

---

## 8) Этапность внедрения (рекомендуемо)

- [ ] **Phase 1:** ввести platform contract + electron adapter без изменения поведения.
- [ ] **Phase 2:** DRY-рефактор плееров (без смены формата проекта).
- [ ] **Phase 3:** миграция модели `path` -> `source handle` + backward compatibility.
- [ ] **Phase 4:** Android/WebView adapter и UX-адаптация mobile flow.
- [ ] **Phase 5:** стабилизация, регресс-тесты, документация для команды.

Результат: постепенная миграция без "большого взрыва".
