# Описание таблиц БД

Модель данных приведена в соответствие с планом релиза v1: [RELEASE_PLAN.md](../RELEASE_PLAN.md) (§3.2, §4.1, §4.2, §4.4): мульти-тенантность (один аккаунт = одна организация), персистентное хранение метаданных вечеринки и плейлиста без путей к файлам, состояние сессии для отображения зрителю.

## Реализация (EF Core Code First)

- **Схема ведётся через EF Core миграции** (проект CherryPlayServer, папка `Migrations/`). Команды: `dotnet ef migrations add <Name>`, `dotnet ef database update`.
- **PostgreSQL (Npgsql)**. Имена таблиц и колонок в БД — **snake_case** (например `organizers`, `party_playlists`, `created_at`), задаётся конвенцией EFCore.NamingConventions.
- **Отдельный слой персистентности:** доменные сущности в `Core/Entities`, EF-сущности в `Infrastructure/Persistence/Entities`; маппинг Domain ↔ EF в `Infrastructure/Persistence/Mappings`. Репозитории возвращают только доменные типы.
- **Soft delete:** у таблиц `organizers` и `parties` есть колонка `is_deleted`; в выборках применяется Global Query Filter. Удаление организатора/вечеринки — установка флага, без физического удаления строки.

---

## Organizer (организатор)

Один аккаунт = одна организация. Профиль организатора для брендинга и кабинета.

| Колонка                        | Тип         | Ограничения                                                  | Описание                                                      |
| ------------------------------ | ----------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `Id`                           | GUID        | PK                                                           | Идентификатор организатора.                                   |
| `Name`                         | string      | NOT NULL                                                     | Название организации / отображаемое имя.                      |
| `LogoUrl`                      | string      | NULL                                                         | URL логотипа (опционально).                                   |
| `Links`                        | JSON/string | NULL                                                         | Ссылки (соцсети, сайт) — JSON-объект или текст.               |
| `DefaultPartyThemeId`          | string      | NULL                                                         | PartyTheme по умолчанию (cyberpunk, sakura, art-deco, basic). |
| `Role`                         | string      | NOT NULL, default organizer, CHECK IN (`organizer`, `admin`) | Роль организатора: `organizer` или `admin`.                   |
| `DefaultCustomizationSettings` | JSON        | NULL                                                         | Настройки оформления по умолчанию (override на уровне party). |
| `CreatedAt`                    | datetime    | NOT NULL                                                     | Дата создания.                                                |
| `UpdatedAt`                    | datetime    | NULL                                                         | Дата последнего обновления.                                   |
| `IsDeleted`                    | boolean     | NOT NULL, default false                                      | Soft delete (скрытие из выборок).                             |

Индекс: `IsDeleted` (global query filter).

_Связь с учётной записью: email+пароль (таблица EmailAccounts) и OAuth-привязки (таблица OAuthAccounts — в v1 используются VK, Mail.ru; OAuth2 для Telegram отложен). Один организатор может иметь несколько привязок к разным провайдерам._

---

## Themes (каталог тем)

Каталог метаданных тем, используемый для проверки доступа и отображения в UI.

| Колонка       | Тип    | Ограничения                              | Описание                                                                                              |
| ------------- | ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ThemeId`     | string | PK                                       | Стабильный идентификатор темы (`basic`, `cyberpunk`, ...).                                            |
| `DisplayName` | string | NOT NULL                                 | Отображаемое имя темы.                                                                                |
| `Description` | text   | NULL                                     | Описание темы.                                                                                        |
| `Visibility`  | string | NOT NULL, CHECK IN (`public`, `private`) | **AccessScope**: кто видит тему без entitlement (`public` = видна как lock/free, `private` = скрыта). |

---

## ThemePackages (пакеты тем)

Коммерческие пакеты, через которые организатор получает доступ к темам.

| Колонка         | Тип     | Ограничения             | Описание                                                              |
| --------------- | ------- | ----------------------- | --------------------------------------------------------------------- |
| `Id`            | GUID    | PK                      | Идентификатор пакета.                                                 |
| `Code`          | string  | UNIQUE, NOT NULL        | Стабильный машинный код (`free`, `extended`, ...).                    |
| `Name`          | string  | NOT NULL                | Отображаемое название пакета.                                         |
| `IsAutoGranted` | boolean | NOT NULL, default false | Если `true`, темы пакета доступны всем организаторам без entitlement. |
| `IsActive`      | boolean | NOT NULL, default true  | Неактивный пакет не участвует в расчете доступа.                      |

Индексы: `Code` (UNIQUE), `IsActive`.

---

## ThemePackageItems (состав пакета)

Связующая таблица many-to-many между `ThemePackages` и `Themes`.

| Колонка     | Тип    | Ограничения                                         | Описание                |
| ----------- | ------ | --------------------------------------------------- | ----------------------- |
| `PackageId` | GUID   | PK (part), FK → ThemePackages.Id, ON DELETE CASCADE | Пакет.                  |
| `ThemeId`   | string | PK (part), FK → Themes.ThemeId, ON DELETE RESTRICT  | Тема, входящая в пакет. |

Индекс: `ThemeId`.

---

## OrganizerEntitlements (выданные права)

Выдачи пакетов конкретным организаторам.

| Колонка         | Тип      | Ограничения                                                    | Описание                                     |
| --------------- | -------- | -------------------------------------------------------------- | -------------------------------------------- |
| `Id`            | GUID     | PK                                                             | Идентификатор выдачи.                        |
| `OrganizerId`   | GUID     | FK → Organizer.Id, NOT NULL, ON DELETE CASCADE                 | Организатор, получивший доступ.              |
| `PackageId`     | GUID     | FK → ThemePackages.Id, NOT NULL, ON DELETE RESTRICT            | Выданный пакет.                              |
| `Kind`          | string   | NOT NULL, CHECK IN (`lifetime`, `subscription`, `event_quota`) | Тип доступа (в MVP используется `lifetime`). |
| `Source`        | string   | NOT NULL, CHECK IN (`admin_grant`, `purchase`, `trial`)        | Источник выдачи.                             |
| `GrantedAt`     | datetime | NOT NULL                                                       | Когда выдано.                                |
| `ExpiresAt`     | datetime | NULL                                                           | Время окончания (для подписки).              |
| `UsesRemaining` | int      | NULL                                                           | Остаток использований (для квот).            |
| `RevokedAt`     | datetime | NULL                                                           | Когда доступ отозван.                        |
| `Note`          | text     | NULL                                                           | Служебная заметка по выдаче/отзыву.          |

Индексы: `OrganizerId`, `(OrganizerId, PackageId, RevokedAt)`, `ExpiresAt`.

---

## AdminAuditLog (аудит админ-действий)

Неперезаписываемый журнал успешных `grant/revoke` операций.

| Колонка             | Тип      | Ограничения                                            | Описание                                    |
| ------------------- | -------- | ------------------------------------------------------ | ------------------------------------------- |
| `Id`                | GUID     | PK                                                     | Идентификатор записи аудита.                |
| `AdminId`           | GUID     | FK → Organizer.Id, NOT NULL                            | Админ, выполнивший действие.                |
| `Action`            | string   | NOT NULL, CHECK IN (`grant_package`, `revoke_package`) | Тип действия.                               |
| `TargetOrganizerId` | GUID     | FK → Organizer.Id, NULL                                | Организатор, к которому применено действие. |
| `PackageId`         | GUID     | FK → ThemePackages.Id, NULL                            | Контекстный пакет.                          |
| `EntitlementId`     | GUID     | FK → OrganizerEntitlements.Id, NULL                    | Контекстная выдача.                         |
| `Note`              | text     | NULL                                                   | Примечание администратора.                  |
| `CreatedAt`         | datetime | NOT NULL                                               | Время записи в аудит.                       |

Индексы: `AdminId`, `TargetOrganizerId`, `CreatedAt`.

---

## OAuthAccounts (OAuth привязки)

Хранение привязок организатора к OAuth провайдерам. Один организатор может иметь несколько привязок к разным провайдерам.

| Колонка                 | Тип      | Ограничения                                     | Описание                                                                                                    |
| ----------------------- | -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Id`                    | GUID     | PK                                              | Идентификатор привязки.                                                                                     |
| `OrganizerId`           | GUID     | FK → Organizer.Id, NOT NULL                     | Идентификатор организатора.                                                                                 |
| `Provider`              | string   | NOT NULL, CHECK IN ('telegram', 'vk', 'mailru') | Провайдер OAuth. В v1 используются `vk`, `mailru`; `telegram` зарезервирован (OAuth2 для Telegram отложен). |
| `ProviderUserId`        | string   | NOT NULL                                        | Идентификатор пользователя у провайдера (уникален в рамках провайдера).                                     |
| `ProviderUserName`      | string   | NULL                                            | Отображаемое имя пользователя у провайдера (может меняться).                                                |
| `ProviderUserAvatarUrl` | string   | NULL                                            | URL аватара пользователя у провайдера (опционально).                                                        |
| `CreatedAt`             | datetime | NOT NULL                                        | Дата создания привязки.                                                                                     |
| `LastUsedAt`            | datetime | NULL                                            | Дата последнего использования этой привязки для входа.                                                      |

**Уникальность:** `(Provider, ProviderUserId)` — уникальная комбинация (один аккаунт провайдера может быть привязан только к одному организатору).

**Поток создания:**

1. При первом входе через провайдера создаётся запись `OAuthAccounts` и (если организатора ещё нет) запись `Organizer`.
2. При последующих входах через тот же провайдер находится существующая привязка, обновляется `LastUsedAt` и возвращается JWT для существующего организатора.
3. Если организатор уже авторизован, можно добавить дополнительную привязку к другому провайдеру (например, войти через VK, затем привязать Mail.ru).

---

## Party (вечеринка)

Метаданные вечеринки и привязка к организатору. shortCode неизменяемый после создания.

| Колонка                 | Тип       | Ограничения                    | Описание                                                                                  |
| ----------------------- | --------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| `Id`                    | GUID      | PK                             | Идентификатор вечеринки.                                                                  |
| `OrganizerId`           | GUID      | FK → Organizer, NOT NULL       | Владелец вечеринки.                                                                       |
| `Name`                  | string    | NOT NULL, длина 1–200          | Название вечеринки.                                                                       |
| `Title`                 | string    | NULL, длина до 500             | Заголовок на экране; если пусто — отображается Name.                                      |
| `Subtitle`              | string    | NULL, длина до 500             | Подзаголовок под заголовком.                                                              |
| `ShortCode`             | string    | UNIQUE, NOT NULL, неизменяемый | Короткий код для ссылки (устойчивый к 0/O, 1/l).                                          |
| `Description`           | text      | NULL                           | Описание вечеринки (для страницы `/info`).                                                |
| `Place`                 | string    | NULL                           | Место проведения.                                                                         |
| `City`                  | string    | NULL                           | Город.                                                                                    |
| `EventDateTime`         | datetime  | NULL                           | Дата и время начала мероприятия.                                                          |
| `EventEndDateTime`      | datetime  | NULL                           | Дата и время окончания мероприятия.                                                       |
| `PartyLifecycleState`   | int       | NOT NULL, default 1 (Draft)    | Жизненный цикл: 1 = Draft, 2 = Ready, 3 = Completed. JSON: `draft`, `ready`, `completed`. |
| `Schedule`              | text/JSON | NULL                           | Расписание (текст или структурированный JSON).                                            |
| `PartyThemeId`          | string    | NOT NULL                       | PartyTheme идентификатор (cyberpunk, sakura, art-deco, basic).                            |
| `CustomizationSettings` | JSON      | NULL                           | Настройки оформления (override поверх organizer).                                         |
| `IsListedInCatalog`     | boolean   | NOT NULL, default false        | По умолчанию unlisted; true — вечеринка в общем каталоге.                                 |
| `CreatedAt`             | datetime  | NOT NULL                       | Дата создания.                                                                            |
| `UpdatedAt`             | datetime  | NULL                           | Дата последнего обновления.                                                               |
| `IsDeleted`             | boolean   | NOT NULL, default false        | Soft delete (скрытие из выборок).                                                         |
| `ShortDescription`      | string    | NULL, длина до 200             | Краткое описание для карточки вечеринки.                                                  |
| `ExternalLinkUrl`       | string    | NULL, длина до 2048            | URL внешней ссылки.                                                                       |
| `ExternalLinkText`      | string    | NULL, длина до 200             | Текст ссылки (подпись).                                                                   |
| `DanceTagsJson`         | text/JSON | NULL                           | Массив тегов танцев (JSON), макс. 20 элементов.                                           |

Индексы: `ShortCode` (уникальный), `OrganizerId`, `IsListedInCatalog` (для выборки каталога).

Колонки `EventDateTime` и `EventEndDateTime` обе допускают `NULL` и используются для отображения времени мероприятия в публичном каталоге и карточках CherryPlayWeb: начало и (опционально) конец попадают в публичные DTO (`PublicPartyDto`, `PublicPartyListItemDto`) как `eventDateTime`/`eventEndDateTime` (см. [CONTRACTS.md](../CONTRACTS.md)). Отсутствующее значение конца трактуется как «конец не задан» и не ломает существующие данные.

---

## PartyPlaylist (плейлист вечеринки)

Хранит только отображаемые поля: id, name/title, duration, структура групп. **Без абсолютных путей к файлам.**

Вариант 1 — одна таблица с JSON:

| Колонка         | Тип      | Ограничения    | Описание                                                                                            |
| --------------- | -------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `PartyId`       | GUID     | PK, FK → Party | Одна запись на вечеринку (1:1).                                                                     |
| `Items`         | JSON     | NOT NULL       | Массив элементов: `{ id, type: "track" \| "group", name, displayOrder, level, duration?, items? }`. |
| `TotalDuration` | int      | NOT NULL       | Общая длительность в секундах.                                                                      |
| `TotalTracks`   | int      | NOT NULL       | Количество треков.                                                                                  |
| `UpdatedAt`     | datetime | NULL           | Время последней публикации (Publish).                                                               |

Вариант 2 — отдельная сущность в той же таблице Party (колонки `PlaylistItems` JSON, `PlaylistTotalDuration`, `PlaylistTotalTracks`) — на усмотрение реализации.

---

## SessionState (состояние сессии)

Минимум для отображения зрителю: сессия активна/нет, последнее известное состояние (played/disabled, текущий трек, позиция).

| Колонка            | Тип          | Ограничения    | Описание                                           |
| ------------------ | ------------ | -------------- | -------------------------------------------------- |
| `PartyId`          | GUID         | PK, FK → Party | Одна запись на вечеринку (1:1).                    |
| `IsActive`         | boolean      | NOT NULL       | true — сессия идёт, зрители видят «сейчас играет». |
| `SessionStartedAt` | datetime     | NULL           | Момент начала текущей сессии.                      |
| `CurrentTrackId`   | string       | NULL           | ID текущего трека.                                 |
| `Status`           | string       | NOT NULL       | idle \| playing \| paused \| ended.                |
| `Position`         | float        | NOT NULL       | Позиция воспроизведения в секундах.                |
| `Duration`         | float        | NOT NULL       | Длительность текущего трека в секундах.            |
| `Volume`           | float        | NOT NULL       | Громкость 0–1.                                     |
| `Mode`             | string       | NOT NULL       | preparation \| session.                            |
| `PlayedTrackIds`   | JSON (array) | NOT NULL       | Список ID отыгранных треков.                       |
| `DisabledTrackIds` | JSON (array) | NOT NULL       | Список ID отключённых треков.                      |
| `DisabledGroupIds` | JSON (array) | NOT NULL       | Список ID отключённых групп.                       |
| `LastUpdatedAt`    | datetime     | NOT NULL       | Время последнего обновления состояния.             |

При рестарте сервера состояние сессии восстанавливается из этой таблицы; плейлист и метаданные вечеринки не теряются.

---

## Связи и политика удаления

- **Organizer** — владелец многих **Party**. FK `Party.OrganizerId` использует `RESTRICT`; soft-delete организатора не удаляет вечеринки физически.
- **Party** — хранится «навсегда» до удаления организатором; в v1 без автоархивации. При удалении вечеринки удаляются связанные **PartyPlaylist** и **SessionState**.
- **ThemePackages** ↔ **Themes**: связь many-to-many через **ThemePackageItems**. Удаление пакета каскадно удаляет его элементы (`ThemePackageItems`), удаление темы ограничено (`RESTRICT`), если она входит в пакет.
- **OrganizerEntitlements**: удаляются каскадно при удалении организатора, но пакет (`ThemePackage`) удалять при наличии выдач нельзя (`RESTRICT`).
- **AdminAuditLog**: хранит ссылки на организаторов, пакеты и entitlement для трассировки действий; записи аудита создаются вместе с выдачей/отзывом в одной транзакции.
- В `AdminAuditLog` удаление ссылочных сущностей переводит внешние ключи в `NULL` (`SET NULL`) для сохранения истории аудита.
- Каталог: в выборку попадают только вечеринки с `IsListedInCatalog = true`. Лимит «будущих» вечеринок на организатора (например, 2) проверяется при создании/обновлении (по §4.2).
