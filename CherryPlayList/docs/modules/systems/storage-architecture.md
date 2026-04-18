# Архитектура клиентского персистентного хранения

Документ описывает **цепочку технологий** и **место в архитектуре приложения**, через которые состояние CherryPlayList сохраняется между запусками в среде Electron/Chromium. За содержимое по ключам и полям см. **[Клиентское состояние: что храним](./persisted-client-state.md)**.

---

## Назначение

Обеспечить **восстановление выбранных фрагментов Zustand-состояния** после перезапуска без участия кода main-процесса и без прямой записи в файловую систему из рендерера (для этого слоя).

Это **не** то же самое, что:

- сохранение проекта в файл **`.cherry`** — см. [Save / Load](./save-load.md);
- конфигурация сервера в **Electron** (`serverConfig.*.json`, IPC) — см. `electron/ipc/config.ts` и [serverConfig](../../../src/shared/config/serverConfig.ts).

---

## Уровни (сверху вниз)

```text
┌─────────────────────────────────────────────────────────┐
│  React / Zustand stores (useAuthStore, useProjectStore,  │
│  useSettingsStore, useLayoutStore, ensureProjectStore…)   │
└───────────────────────────┬───────────────────────────────┘
                            │ subscribe, partialize
┌───────────────────────────▼───────────────────────────────┐
│  zustand/middleware «persist»                           │
│  — ключи вида cherryplaylist-*                          │
│  — версия состояния для migrate                         │
└───────────────────────────┬───────────────────────────────┘
                            │ PersistStorage API
┌───────────────────────────▼───────────────────────────────┐
│  electronStorage                                          │
│  src/shared/storage/electronStorage.ts                   │
│  — JSON.stringify / JSON.parse (StorageValue)            │
└───────────────────────────┬───────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│  localforage (один instance)                              │
│  name: «CherryPlayList», storeName: «app-storage»        │
│  driver: INDEXEDDB → WEBSQL → LOCALSTORAGE               │
└───────────────────────────┬───────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│  Web API Chromium (рендерер Electron)                      │
│  в типичном случае: IndexedDB                            │
└───────────────────────────────────────────────────────────┘
```

### Роль `persist`

Middleware **подписывается** на изменения стора, сериализует только данные из **`partialize`** (или всё сериализуемое), добавляет **версию** для миграций и вызывает асинхронный адаптер `getItem` / `setItem` / `removeItem`.

### Роль `electronStorage`

Реализует интерфейс **`PersistStorage`** из Zustand: значение передаётся как **`JSON`**-строка в localforage. Несериализуемые сущности в persist не должны попадать (методы, `Set` в сыром виде и т.д. — в коде проекта учитывается через `partialize` и преобразование Maps в массивы пар).

### Роль localforage

Единая обёртка над движковым хранилищем с **приоритетом драйверов**:

1. **IndexedDB** — основной ожидаемый путь в актуальном Electron: асинхронно, больший объём, устойчивее для крупных объектов (плейлист, layout).
2. **WebSQL** — резерв в цепочке localforage (в современных сборках часто недоступен).
3. **localStorage** — последний fallback; синхронный API, жёстче лимиты по объёму.

Параметры instance в коде:

```15:21:CherryPlayList/src/shared/storage/electronStorage.ts
const storage = localforage.createInstance({
  name: 'CherryPlayList',
  storeName: 'app-storage',
  description: 'CherryPlayList application storage',
  // Используем IndexedDB как приоритетный драйвер
  driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
});
```

---

## Где физически лежат данные

Код приложения **не** задаёт путь к файлам IndexedDB напрямую. Данные создаёт **Chromium** в профиле приложения (оригин страницы Electron), обычно рядом с кэшем и прочими web-storage для этого окна.

Каталог профиля пользователя Electron определяется **`app.getPath('userData')`** (см. `electron/ipc/system.ts`, IPC `system:getPath`). Внутри — внутренняя структура LevelDB/Chromium для **IndexedDB**. Точные имена подпапок зависят от версии Electron и режима запуска; для отладки ориентир — **`userData`**, а не исходники репозитория.

Важно: чтение/запись идёт из **рендерерного** контекста через браузерные API, а не через `fs` в main-процессе.

---

## Связь с остальной системой

| Механизм                           | Назначение                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Клиентский persist (этот документ) | Автовосстановление UI и черновика проекта между сеансами                          |
| Файл `.cherry`                     | Явное сохранение/обмен проектом — [save-load.md](./save-load.md)                  |
| Сервер / SignalR                   | Состояние вечеринки в сети — [интеграция](../../../../docs/integration/README.md) |

---

## См. также

- [Storage](./storage.md) — краткий обзор модуля и ссылки
- [Клиентское состояние: что храним](./persisted-client-state.md) — ключи и состав полей
- [Project Store](../stores/project-store.md) — логика основного проекта в памяти
- [Settings Store](../stores/settings-store.md) — настройки приложения
- [Layout System](./layout-system.md) — дерево зон и workspace
