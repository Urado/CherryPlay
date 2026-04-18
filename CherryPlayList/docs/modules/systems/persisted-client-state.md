# Клиентское состояние: что храним (persist)

Перечень данных, которые **Zustand `persist`** записывает через **`electronStorage`** (localforage → в типичном случае **IndexedDB**). Имена ключей — то, что передаётся как `name` в конфиге `persist` (см. исходники сторов).

За стек и расположение на диске см. **[Архитектура хранения](./storage-architecture.md)**.

**Безопасность:** токен и данные организатора лежат **в открытом виде** (JSON) в профиле Chromium/Electron вместе с остальными данными приложения; шифрования на уровне приложения нет — при компрометации диска или бэкапа профиля возможно чтение этих полей.

---

## Ключи и сторы

| Ключ persist                   | Store / модуль                                                    | Назначение                                          |
| ------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------- |
| `cherryplaylist-auth`          | `useAuthStore` (`authStore.ts`)                                   | Сессия организатора                                 |
| `cherryplaylist-settings`      | `useSettingsStore` (`settingsStore.ts`)                           | Пользовательские настройки приложения               |
| `cherryplaylist-layout`        | `useLayoutStore` (`layoutStore.ts`)                               | Дерево layout (зоны, workspace, сплиты)             |
| `cherryplaylist-project`       | `useProjectStore` (`projectStore.ts`)                             | Основной плейлист-проект (главный workspace)        |
| `cherryplaylist-<workspaceId>` | `ensureProjectStore` с `persist: true` (`projectStoreFactory.ts`) | Отдельные проекты по id workspace (коллекции и др.) |

Для динамических workspace id — **один ключ на каждый** уникальный `workspaceId`, для которого создан персистентный store.

---

## 1. Аутентификация (`cherryplaylist-auth`)

Сохраняется через `partialize`:

- **`accessToken`** — токен доступа к API
- **`organizer`** — `{ id, name }` или `null`

Методы стора (`setToken`, `clearAuth` и т.д.) в хранилище **не** попадают.

---

## 2. Настройки (`cherryplaylist-settings`)

Группы данных:

- **Экспорт:** `exportPath`, `exportStrategy` (`copyWithNumberPrefix` | `aimpPlaylist`)
- **Файлы и плейлист:** `lastOpenedPlaylist`, `fileBrowserPath`
- **Отображение списка:** `trackItemSizePreset`, `hourDividerInterval`, `showHourDividers`
- **Аудио:** `playerAudioDeviceId`, `demoPlayerAudioDeviceId`
- **Клавиши:** `keyBindings` (пользовательские привязки)
- **Стриминг:** `enableStreaming`, `streamingSource`

Поле **`_hasHydrated`** и сеттеры в persist **не** входят.

---

## 3. Layout (`cherryplaylist-layout`)

- Целиком объект **`layout`** (корневое дерево зон: контейнеры, workspace-зоны, размеры).

Версия persist в сторе используется для **migrate** (при смене версии может подставляться новый начальный layout — см. `layoutStore.ts`).

---

## 4. Основной проект (`cherryplaylist-project`)

Сохраняется существенная часть состояния проекта:

- **`name`**, **`items`**, **`settings`**
- **`trackSettings`**, **`groupSettings`** — в JSON как массивы пар `[id, value]` (Map сериализуется так в `partialize`)
- **`sessionState`** — режим сессии, проигранные/отключённые треки и группы, текущий трек, время старта и т.д. (см. типы в `@core/types/project`)
- **`meta`** (урезанно для сериализации):
  - `filePath`, `isDirty`, `lastSavedAt`
  - **`linkedParty`** — только `{ id, shortCode }` или `null` (URL в persist не хранится)
  - **`partyTrackDisplay`** — настройки отображения имён треков для страницы вечеринки
  - **`partyThemeId`** (опционально) — черновик/кэш идентификатора темы вечеринки (до синхронизации с сервером)
  - **`partyCustomizationSettings`** (опционально) — черновик/кэш настроек кастомизации темы (локальный JSON)

### Тема вечеринки: сервер и локальный кэш

- **Источник правды** для опубликованной вечеринки: **API/БД** — поля `partyThemeId` и `customizationSettings` возвращаются в `GET /api/parties/{partyId}` (см. корневой [CONTRACTS.md](../../../../CONTRACTS.md), секция **PartyDto**).
- После успешной загрузки метаданных с сервера CherryPlayList **приводит локальный `meta`** в соответствие с ответом (палитра и тема в UI соответствуют тому, что на сервере для последней публикации).
- Значения **`partyThemeId`** и **`partyCustomizationSettings`** в `cherryplaylist-project` и в файле **`.cherry`** — это **локальный кэш/черновик**: перенос между сессиями, работа до прихода ответа сети, сохранение в файле проекта. Они **не заменяют** серверное состояние после синхронизации; при расхождении приоритет у данных **с сервера** после успешного `getParty`.

Те же **`partyThemeId`** и **`partyCustomizationSettings`** записываются в файл проекта `.cherry` при сохранении на диск — см. [Save / Load](./save-load.md).

**Не** сохраняется в persist (на уровне `partialize` / merge):

- выбор элементов **`selectedItemIds`** — после восстановления сбрасывается.

---

## 5. Проекты по workspace (`cherryplaylist-<workspaceId>`)

Используется та же форма данных, что и у основного проекта (через фабрику), но **`meta`** в `partialize` **без** `linkedParty` и **`partyTrackDisplay`** — только путь к файлу и служебные поля (`filePath`, `isDirty`, `lastSavedAt`). Коллекции и другие зоны с `persist: true` получают собственный ключ по своему **`workspaceId`**.

---

## Поведение при старте

Восстановление из IndexedDB **асинхронно**. Код, которому нужны уже подгруженные данные (например восстановление сессии), должен учитывать **hydration** `persist` (см. использование `onFinishHydration` / `hasHydrated` в компонентах player и в `useSessionRecovery`).

---

## См. также

- [Архитектура хранения](./storage-architecture.md)
- [Storage](./storage.md)
- [Settings Store](../stores/settings-store.md)
- [Project Store](../stores/project-store.md)
- [Save / Load](./save-load.md) — файл проекта на диске
