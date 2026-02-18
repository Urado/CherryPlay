# Описание таблиц БД

Модель данных приведена в соответствие с планом релиза v1: [RELEASE_PLAN.md](../RELEASE_PLAN.md) (§3.2, §4.1, §4.2, §4.4): мульти-тенантность (один аккаунт = одна организация), персистентное хранение метаданных вечеринки и плейлиста без путей к файлам, состояние сессии для отображения зрителю.

---

## Organizer (организатор)

Один аккаунт = одна организация. Профиль организатора для брендинга и кабинета.

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| `Id` | GUID | PK | Идентификатор организатора. |
| `Name` | string | NOT NULL | Название организации / отображаемое имя. |
| `LogoUrl` | string | NULL | URL логотипа (опционально). |
| `Links` | JSON/string | NULL | Ссылки (соцсети, сайт) — JSON-объект или текст. |
| `DefaultThemeId` | string | NULL | Тема по умолчанию (cyberpunk, sakura, art-deco, basic). |
| `DefaultCustomizationSettings` | JSON | NULL | Настройки оформления по умолчанию (override на уровне party). |
| `CreatedAt` | datetime | NOT NULL | Дата создания. |
| `UpdatedAt` | datetime | NULL | Дата последнего обновления. |

*Связь с учётной записью: email+пароль (таблица EmailAccounts) и OAuth-привязки (таблица OAuthAccounts — в v1 используются VK, Mail.ru; OAuth2 для Telegram отложен). Один организатор может иметь несколько привязок к разным провайдерам.*

---

## OAuthAccounts (OAuth привязки)

Хранение привязок организатора к OAuth провайдерам. Один организатор может иметь несколько привязок к разным провайдерам.

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| `Id` | GUID | PK | Идентификатор привязки. |
| `OrganizerId` | GUID | FK → Organizer.Id, NOT NULL | Идентификатор организатора. |
| `Provider` | string | NOT NULL, CHECK IN ('telegram', 'vk', 'mailru') | Провайдер OAuth. В v1 используются `vk`, `mailru`; `telegram` зарезервирован (OAuth2 для Telegram отложен). |
| `ProviderUserId` | string | NOT NULL | Идентификатор пользователя у провайдера (уникален в рамках провайдера). |
| `ProviderUserName` | string | NULL | Отображаемое имя пользователя у провайдера (может меняться). |
| `ProviderUserAvatarUrl` | string | NULL | URL аватара пользователя у провайдера (опционально). |
| `CreatedAt` | datetime | NOT NULL | Дата создания привязки. |
| `LastUsedAt` | datetime | NULL | Дата последнего использования этой привязки для входа. |

**Уникальность:** `(Provider, ProviderUserId)` — уникальная комбинация (один аккаунт провайдера может быть привязан только к одному организатору).

**Поток создания:**
1. При первом входе через провайдера создаётся запись `OAuthAccounts` и (если организатора ещё нет) запись `Organizer`.
2. При последующих входах через тот же провайдер находится существующая привязка, обновляется `LastUsedAt` и возвращается JWT для существующего организатора.
3. Если организатор уже авторизован, можно добавить дополнительную привязку к другому провайдеру (например, войти через VK, затем привязать Mail.ru).

---

## Party (вечеринка)

Метаданные вечеринки и привязка к организатору. shortCode неизменяемый после создания.

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| `Id` | GUID | PK | Идентификатор вечеринки. |
| `OrganizerId` | GUID | FK → Organizer, NOT NULL | Владелец вечеринки. |
| `Name` | string | NOT NULL, длина 1–200 | Название вечеринки. |
| `ShortCode` | string | UNIQUE, NOT NULL, неизменяемый | Короткий код для ссылки (устойчивый к 0/O, 1/l). |
| `Description` | text | NULL | Описание вечеринки (для страницы `/info`). |
| `Place` | string | NULL | Место проведения. |
| `City` | string | NULL | Город. |
| `EventDateTime` | datetime | NULL | Дата и время мероприятия. |
| `Schedule` | text/JSON | NULL | Расписание (текст или структурированный JSON). |
| `ThemeId` | string | NOT NULL | Тема (cyberpunk, sakura, art-deco, basic). |
| `CustomizationSettings` | JSON | NULL | Настройки оформления (override поверх organizer). |
| `IsListedInCatalog` | boolean | NOT NULL, default false | По умолчанию unlisted; true — вечеринка в общем каталоге. |
| `CreatedAt` | datetime | NOT NULL | Дата создания. |
| `UpdatedAt` | datetime | NULL | Дата последнего обновления. |

Индексы: `ShortCode` (уникальный), `OrganizerId`, `IsListedInCatalog` (для выборки каталога).

---

## PartyPlaylist (плейлист вечеринки)

Хранит только отображаемые поля: id, name/title, duration, структура групп. **Без абсолютных путей к файлам.**

Вариант 1 — одна таблица с JSON:

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| `PartyId` | GUID | PK, FK → Party | Одна запись на вечеринку (1:1). |
| `Items` | JSON | NOT NULL | Массив элементов: `{ id, type: "track"|"group", name, displayOrder, level, duration?, items? }`. |
| `TotalDuration` | int | NOT NULL | Общая длительность в секундах. |
| `TotalTracks` | int | NOT NULL | Количество треков. |
| `UpdatedAt` | datetime | NULL | Время последней публикации (Publish). |

Вариант 2 — отдельная сущность в той же таблице Party (колонки `PlaylistItems` JSON, `PlaylistTotalDuration`, `PlaylistTotalTracks`) — на усмотрение реализации.

---

## SessionState (состояние сессии)

Минимум для отображения зрителю: сессия активна/нет, последнее известное состояние (played/disabled, текущий трек, позиция).

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| `PartyId` | GUID | PK, FK → Party | Одна запись на вечеринку (1:1). |
| `IsActive` | boolean | NOT NULL | true — сессия идёт, зрители видят «сейчас играет». |
| `SessionStartedAt` | datetime | NULL | Момент начала текущей сессии. |
| `CurrentTrackId` | string | NULL | ID текущего трека. |
| `Status` | string | NOT NULL | idle \| playing \| paused \| ended. |
| `Position` | float | NOT NULL | Позиция воспроизведения в секундах. |
| `Duration` | float | NOT NULL | Длительность текущего трека в секундах. |
| `Volume` | float | NOT NULL | Громкость 0–1. |
| `Mode` | string | NOT NULL | preparation \| session. |
| `PlayedTrackIds` | JSON (array) | NOT NULL | Список ID отыгранных треков. |
| `DisabledTrackIds` | JSON (array) | NOT NULL | Список ID отключённых треков. |
| `DisabledGroupIds` | JSON (array) | NOT NULL | Список ID отключённых групп. |
| `LastUpdatedAt` | datetime | NOT NULL | Время последнего обновления состояния. |

При рестарте сервера состояние сессии восстанавливается из этой таблицы; плейлист и метаданные вечеринки не теряются.

---

## Связи и политика удаления

- **Organizer** — владелец многих **Party**. Удаление организатора (если предусмотрено) — каскад или запрет при наличии вечеринок (по политике v1).
- **Party** — хранится «навсегда» до удаления организатором; в v1 без автоархивации. При удалении вечеринки удаляются связанные **PartyPlaylist** и **SessionState**.
- Каталог: в выборку попадают только вечеринки с `IsListedInCatalog = true`. Лимит «будущих» вечеринок на организатора (например, 2) проверяется при создании/обновлении (по §4.2).
