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
| `cherryplaylist-workspaces`    | `useLayoutStore` (`layoutStore.ts`)                               | Рабочие пространства и дерево layout                |
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
- **Файлы и плейлист:** `lastOpenedPlaylist`, `fileBrowserPathsByWorkspaceId` (`Record<WorkspaceId, string>`), legacy `fileBrowserPath` (зеркало path для `DEFAULT_FILEBROWSER_WORKSPACE_ID`; при rehydrate мигрируется в map — см. `migrateFileBrowserPathsOnRehydrate` в `settingsStore.ts`)
- **Отображение списка:** `trackItemSizePreset`, `hourDividerInterval`, `showHourDividers`
- **Аудио:** `playerAudioDeviceId`, `demoPlayerAudioDeviceId`, `demoPlayerFloatingPosition` (`{ x, y }` \| `null`), `demoPlayerFloatingOpen` (`boolean`), `playerInAppHeader` (`boolean`). `demoPlayerFloatingOpen` — persisted preference; runtime visibility floating-панели может переопределяться логикой layout и активной demo-сессии — см. [Demo Player — Floating: открытие / подавление](./demo-player.md#floating-открытие--подавление).
- **Клавиши:** `keyBindings` (пользовательские привязки)
- **Стриминг / Онлайн:** `enableStreaming`, `streamingSource` (в UI — **Онлайн**, **Источник состояния для гостей**)

Поле **`_hasHydrated`** и сеттеры в persist **не** входят.

---

## 3. Рабочие пространства и layout (`cherryplaylist-workspaces`)

Ключ **`cherryplaylist-workspaces`** (persist version **1**) в `layoutStore.ts`. В `partialize` попадает срез `WorkspacePersistSlice`:

| Поле                  | Описание                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`activeWorkspace`** | `{ kind: 'builtin', preset }` \| `{ kind: 'user', id }` — **не** `scratch` (нормализуется при persist/rehydrate) |
| **`userWorkspaces`**  | Массив `{ id, name, layout, createdAt?, updatedAt? }` — сохранённые пользовательские снимки дерева               |
| **`layout`**          | Живое дерево зон текущего workspace (корень, контейнеры, workspace-зоны, размеры)                                |

**Не** сохраняется (runtime only): **`isLayoutEditMode`**, **`openLayoutEditPickerKey`**, **`baselineLayout`**, dirty-хелперы. См. [layout-edit-mode.md](../../layout-edit-mode.md), [Layout System](./layout-system.md).

**По умолчанию** (свежая установка / пустой persist): `activeWorkspace: { kind: 'builtin', preset: 'collections' }`, `userWorkspaces: []`, layout от `createCollectionsLayout()`.

### Миграция с `cherryplaylist-layout`

Старый ключ **`cherryplaylist-layout`** (только `layout`) **не мигрируется** в пользовательский preset. При гидрации `onRehydrateStorage` всегда вызывает `removeLegacyLayoutPersistKey()` — ключ удаляется из IndexedDB. Если есть только legacy-данные, приложение стартует с дефолтным built-in `collections` (как при первом запуске).

### Автосохранение и runtime API (`layoutStore`)

Изменения дерева layout **не привязаны к файлу проекта** (`.cherry`). Сохраняются на уровне приложения:

| Метод                              | Когда                                                    |
| ---------------------------------- | -------------------------------------------------------- |
| `autoCommitWorkspaceChanges()`     | Перед switch / exit edit / «Создать с нуля…» при dirty   |
| `saveCurrentWorkspace({ silent })` | Dirty **user** — обновить снимок в `userWorkspaces`      |
| `saveCurrentWorkspaceAsUnnamed()`  | Dirty **builtin** / **scratch** — новая запись в **Мои** |
| `saveCurrentWorkspaceAs(name)`     | Явное имя (pill для scratch, импорт и т.д.)              |

Оркестрация в UI: `useWorkspaceDirtyGuard.ts` (`requestActivateWorkspace`, `requestExitEditMode`, …). Модальных диалогов нет.

### Имена «Без имени»

Auto-save использует `allocateUnnamedWorkspaceName()` (`workspacePreset.ts`):

1. Если нет workspace с именем **«Без имени»** → **«Без имени»**
2. Иначе → **«Без имени 2»**, **«Без имени 3»**, … (первый свободный номер)

`isUnnamedWorkspaceName()` распознаёт всю серию для UI (курсив, inline-rename). Имена в `userWorkspaces` хранятся как обычные строки.

### Коллекции vs имя workspace

Данные коллекций лежат в **`cherryplaylist-<workspaceId>`** по **`workspaceId` из дерева layout**, а не по имени пользовательского workspace. Смена built-in/user workspace пересоздаёт дерево — старые ключи коллекций могут остаться в хранилище. См. [Layout System](./layout-system.md).

**Electron:** после перезапуска восстанавливаются `activeWorkspace`, `userWorkspaces` и живое `layout`.

**Веб-демо** (`VITE_APP_MODE=demo`, `npm run dev:web`): при каждом старте `bootstrap.ts` вызывает `resetDemoPersistStorage()` и **удаляет** `cherryplaylist-workspaces` (и другие ключи AC12) **до** гидрации сторов. В рамках **одной** сессии страницы persist работает как обычно; полная перезагрузка снова очищает ключ. См. [веб-демо](../../web-demo.md), [layout-edit-mode.md](../../layout-edit-mode.md).

### Экспорт/импорт bundle

Пользовательские workspace и настройки можно выгрузить в JSON (`cherryplaylist-settings-bundle.json`, `schemaVersion: 1`) из **Настройки → Резервная копия настроек**. В bundle входят поля `settingsStore` и `userWorkspaces` (снимки layout), опционально `activeWorkspace`. Живое дерево `layout` вне сохранённых user workspace **не** экспортируется отдельно.

**Безопасность:** в bundle **нет** данных auth (`accessToken`, `organizer`, `refreshToken`) — экспортируются только поля `settingsStore`; валидатор `validateSettingsExportBundle` отклоняет файлы с auth-полями. См. [Settings Store](../stores/settings-store.md).

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

В **веб-демо** перед гидрацией выполняется сброс ключей AC12 (`resetDemoPersistStorage` в `src/bootstrap.ts`) — см. [веб-демо](../../web-demo.md#что-работает-в-демо).

---

## См. также

- [Архитектура хранения](./storage-architecture.md)
- [Storage](./storage.md)
- [Layout System](./layout-system.md) — built-in vs user workspace, pill UI
- [Веб-демо](../../web-demo.md) — сброс persist (AC12) при bootstrap
- [Режим редактирования layout](../../layout-edit-mode.md) — edit mode, автосохранение workspace
- [Settings Store](../stores/settings-store.md) — экспорт/импорт bundle
- [Project Store](../stores/project-store.md)
- [Save / Load](./save-load.md) — файл проекта на диске
