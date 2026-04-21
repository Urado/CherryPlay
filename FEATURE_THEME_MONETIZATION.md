# ТЗ: Монетизация PartyTheme (пакеты и права)

Документ — источник истины для разработки фичи «платные темы вечеринок». Базируется на ответах владельца продукта и закрепляет принятые решения. Используется как основной brief для ИИ-агентов (worker-dotnet, worker-frontend, worker-documentation) и для ручной разработки.

Связанные документы (перед правками — прочитать):

- [RELEASE_PLAN.md](RELEASE_PLAN.md) — §2.2 «Приватные темы как продаваемая фича — закладываем модель данных, UI/каталог тем позже», §4.4 Branding.
- [CONTRACTS.md](CONTRACTS.md) — §3.3 Profile, §3.4 REST вечеринок, §6 DTO.
- [CherryPlayServer/DATABASE.md](CherryPlayServer/DATABASE.md) — текущая схема БД.
- [THEMES.md](THEMES.md), [ADDING_THEME.md](ADDING_THEME.md) — текущая модель PartyTheme.
- [GLOSSARY.md](GLOSSARY.md) — термины (PartyTheme, partyThemeId, organizer, …).
- [docs/integration/accounts-and-auth.md](docs/integration/accounts-and-auth.md) — роли, JWT, cookie.
- [docs/integration/party-management.md](docs/integration/party-management.md) — CRUD вечеринок.

---

## 1. Цель

Дать владельцу продукта возможность **монетизировать PartyTheme** через ручную выдачу пакетов тем организаторам. На первой итерации — без платёжного шлюза: оплата проходит вне продукта (мессенджеры/переводы), админ вручную выдаёт доступ через админ-раздел в CherryPlayWeb.

Дополнительно — поддержать **приватные темы** для индивидуальных клиентов (темы, которые вообще не показываются в UI другим организаторам).

## 2. Границы (scope)

### 2.1 В этой фиче

- Каталог **тем** и **пакетов тем** в БД (источник истины по правам; сам код темы остаётся в `CherryPlayComponents`).
- **Entitlement-таблица** прав организатора на пакеты (с запасом под будущие подписки и «по N вечеринок»).
- **Роль admin** на Organizer; JWT claim `role`.
- Админ-раздел `/admin/*` в **CherryPlayWeb**: поиск организаторов, выдача/отзыв пакета.
- **Валидация прав** при создании/изменении темы вечеринки и при смене default-темы в профиле.
- **Эндпоинт `GET /api/organizer/me/theme-access`** для клиентов (CherryPlayList, CherryPlayWeb cabinet).
- UX «замков» на платных темах в **CherryPlayList PartyEditor** и **CherryPlayWeb CabinetPartyForm** + CTA-ссылка на админа.
- **Приватные темы**: флаг `visibility=private` скрывает тему из UI для всех, у кого нет entitlement.
- **admin_audit_log** — физическая запись grant/revoke (без UI чтения).
- Обновление документации: `CONTRACTS.md`, `DATABASE.md`, `GLOSSARY.md`, `THEMES.md`.

### 2.2 Явно отложено (not now)

- Платёжный шлюз и автосамообслуживание покупки. **Все оплаты — вручную.**
- UI-редактирование тем и пакетов из админки. Пакеты и их состав правятся **миграциями EF Core + DataSeeder**.
- Подписки (`kind=subscription`), квоты по вечеринкам (`kind=event_quota`). **Поля в схеме присутствуют** (`expires_at`, `uses_remaining`, `kind`), но проверки/джобы не реализуются.
- UI чтения admin_audit_log. Читаем через pgAdmin по SSH-туннелю (`SSH_TUNNEL_PGADMIN.md`).
- Самостоятельная выдача роли admin через API. Первого админа ставим вручную (UPDATE organizers SET role = 'admin' WHERE id = '…').
- Grandfathering существующих вечеринок: права выдаются админом вручную.
- Выбор default-темы организатора в UI. Поле `Organizer.DefaultPartyThemeId` в БД остаётся, но в DTO/UI не экспонируется; default для новой вечеринки всегда `basic`.

## 3. Термины

Дополнительно к [GLOSSARY.md](GLOSSARY.md):

| Термин                                         | Описание                                                                                                                                                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Theme (каталог)**                            | Запись в БД, соответствующая одному `PartyThemeId` из кода (`CherryPlayComponents` + C# enum). Хранит метаданные и флаг видимости. Тему нельзя добавить через API — только релизом кода.                                          |
| **ThemePackage (пакет тем)**                   | Группа тем, продаваемая как единое целое. Пакет может содержать одну или несколько тем. Тема может входить в несколько пакетов. Для доступа достаточно владения **любым** активным пакетом, содержащим эту тему.                  |
| **Entitlement**                                | Запись о выданном организатору праве на пакет. Атрибуты: `kind` (`lifetime` / `subscription` / `event_quota`), `grantedAt`, `expiresAt?`, `usesRemaining?`, `revokedAt?`, `source`, `note`. В MVP используется только `lifetime`. |
| **Private theme (приватная тема)**             | Тема с `visibility=private`. Не показывается в UI тем, у кого нет активного entitlement на пакет с этой темой. Используется для эксклюзивных клиентов.                                                                            |
| **Public theme (публичная тема)**              | Тема с `visibility=public`. Показывается всем в UI: бесплатная — без замка, платная — с замком и CTA на контакт с админом.                                                                                                        |
| **Auto-granted package (авто-выданный пакет)** | Пакет с флагом `isAutoGranted=true`. Темы из него доступны **всем организаторам без entitlement-строк в БД**. Используется для «free»-пакета. Если позже добавить тему в такой пакет — она автоматически станет доступна всем.    |

## 4. Продуктовые правила

### 4.1 Модель доступа

- **Единица продажи — только пакет.** Даже «одна тема» моделируется как пакет из одной темы.
- Организатор получает доступ к теме `T`, если выполнено хотя бы одно:
  1. существует активный пакет `P` с `isAutoGranted=true`, и `T ∈ P`; **или**
  2. существует активный **не отозванный, не просроченный** entitlement у этого организатора на активный пакет `P`, и `T ∈ P`.
- «Активный пакет»: `is_active = true`.
- «Не отозванный, не просроченный, с остатком» entitlement:
  - `revoked_at IS NULL`;
  - `expires_at IS NULL OR expires_at > now()`;
  - `uses_remaining IS NULL OR uses_remaining > 0`.

### 4.2 Проверка прав при операциях над вечеринкой

- **`POST /api/parties`**: `partyThemeId` обязан быть доступным организатору. Иначе `403` с кодом ошибки `theme_not_entitled`.
- **`PUT /api/parties/{partyId}`**: права на тему проверяются **только если тема меняется** — т.е. если в теле пришло поле `partyThemeId` и оно **отличается от сохранённого** в БД. Если тема не меняется — никаких проверок (даже если доступ к теме отозван позже; см. §4.4).
- **`PATCH /api/organizer/profile`**: в MVP поле `defaultPartyThemeId` в `UpdateOrganizerDto` **не принимается** (игнорируется / не экспонируется в OpenAPI). Значение в БД сохраняется как есть для обратной совместимости.
- При создании вечеринки без явно указанной темы — использовать `basic` (гарантированно доступна через free-пакет).

### 4.3 Отзыв и истечение (MVP)

- Отзыв/просрочка entitlement **не затрагивает** уже созданные вечеринки — они продолжают отображаться и работать с «отозванной» темой (см. §4.2 про «только при смене темы»).
- Прошедшие вечеринки **навсегда** сохраняют тему.
- Если организатор после отзыва доступа попытается создать **новую** вечеринку с недоступной темой или сменить тему у существующей на недоступную — `403 theme_not_entitled`.

### 4.4 Видимость тем в UI

| Статус темы для организатора | `visibility=public`                                              | `visibility=private`     |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------ |
| Есть entitlement (или free)  | Показать как доступную                                           | Показать как доступную   |
| Нет entitlement              | Показать с замком + CTA «Доступно в пакете X, [написать админу]» | **Не показывать** вообще |

### 4.5 Free-пакет

- Пакет с `code='free'`, `is_auto_granted=true`, `is_active=true`.
- Содержит тему `basic`.
- При проверке прав сервер **динамически** считает все темы из `is_auto_granted=true` пакетов доступными всем организаторам без создания entitlement-строк.
- Если в будущем добавить тему в free-пакет — она автоматически станет бесплатной для всех.

## 5. Роли

### 5.1 Организатор (`role='organizer'`) — поведение по умолчанию

Без изменений: CRUD своих вечеринок, Publish, сессии.

Дополнительно:

- `GET /api/organizer/me/theme-access` — доступен.
- Попытка вызвать любой `/api/admin/*` → `403 admin_only`.

### 5.2 Администратор (`role='admin'`)

- Полные права организатора плюс доступ к `/api/admin/*`.
- Роль выставляется **вручную** в БД (первый админ: `UPDATE organizers SET role='admin' WHERE id='…'`).
- В JWT добавляется claim `role` со значением `organizer` или `admin`.
- Админ — это обычный Organizer с дополнительной ролью; может иметь свои вечеринки, логиниться тем же способом (email+пароль или OAuth).

## 6. Модель данных

Все изменения реализуются **миграциями EF Core**; имена колонок — snake_case, сущности — в `Core/Entities` (domain) и `Infrastructure/Persistence/Entities` (EF), маппинг — в `Infrastructure/Persistence/Mappings`, репозитории возвращают доменные типы (см. [DATABASE.md](CherryPlayServer/DATABASE.md)).

### 6.1 Изменения в `organizers`

Добавить колонку:

| Колонка | Тип    | Ограничения                                                         | Описание           |
| ------- | ------ | ------------------------------------------------------------------- | ------------------ |
| `role`  | string | NOT NULL, default `'organizer'`, CHECK IN (`'organizer'`,`'admin'`) | Роль организатора. |

Миграция: заполнить существующим строкам значение `'organizer'`.

Поле `DefaultPartyThemeId` **оставить** как есть — в DTO в MVP не экспонируем.

### 6.2 `themes` (каталог тем)

Таблица метаданных для тем, **коды которых** объявлены в `CherryPlayServer/Core/Enums/PartyThemeId.cs` и `CherryPlayComponents/src/themes/index.ts`.

| Колонка        | Тип      | Ограничения                                                     | Описание                                                                           |
| -------------- | -------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `theme_id`     | string   | PK                                                              | Идентификатор темы (совпадает с `PartyThemeId` в API, напр. `basic`, `cyberpunk`). |
| `display_name` | string   | NOT NULL                                                        | Человекочитаемое имя темы.                                                         |
| `description`  | text     | NULL                                                            | Описание.                                                                          |
| `visibility`   | string   | NOT NULL, CHECK IN (`'public'`,`'private'`), default `'public'` | Видимость в UI для организаторов без доступа.                                      |
| `created_at`   | datetime | NOT NULL                                                        |                                                                                    |
| `updated_at`   | datetime | NULL                                                            |                                                                                    |

Индексы: PK `theme_id`, `visibility` (для списков).

Сидирование: при старте сервера `DataSeeder` для каждого значения enum `PartyThemeId` проверяет наличие записи в `themes`; недостающие добавляет с `visibility='public'`. Существующие записи **не перезаписываются**.

### 6.3 `theme_packages`

| Колонка           | Тип      | Ограничения               | Описание                                                                                          |
| ----------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`              | GUID     | PK                        |                                                                                                   |
| `code`            | string   | UNIQUE, NOT NULL          | Стабильный машинный код (`free`, `extended`, `spring-cross-step`, …). Используется в API и логах. |
| `name`            | string   | NOT NULL                  | Человекочитаемое имя («Расширенный»).                                                             |
| `description`     | text     | NULL                      | Описание для UI.                                                                                  |
| `is_auto_granted` | boolean  | NOT NULL, default `false` | Если `true` — доступ к темам этого пакета получают **все** организаторы без entitlement.          |
| `is_active`       | boolean  | NOT NULL, default `true`  | Неактивный пакет не учитывается при проверке прав и не показывается в UI.                         |
| `created_at`      | datetime | NOT NULL                  |                                                                                                   |
| `updated_at`      | datetime | NULL                      |                                                                                                   |

Индексы: UNIQUE `code`, `is_active`.

### 6.4 `theme_package_items`

Связь many-to-many между пакетами и темами.

| Колонка      | Тип      | Ограничения                                             | Описание |
| ------------ | -------- | ------------------------------------------------------- | -------- |
| `package_id` | GUID     | FK → `theme_packages.id`, ON DELETE CASCADE, part of PK |          |
| `theme_id`   | string   | FK → `themes.theme_id`, ON DELETE RESTRICT, part of PK  |          |
| `added_at`   | datetime | NOT NULL                                                |          |

PK: `(package_id, theme_id)`. Индексы: `theme_id` (для обратного поиска «в каких пакетах есть тема X»).

### 6.5 `organizer_entitlements`

Выданные права.

| Колонка               | Тип      | Ограничения                                                                              | Описание                                                             |
| --------------------- | -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `id`                  | GUID     | PK                                                                                       |                                                                      |
| `organizer_id`        | GUID     | FK → `organizers.id`, ON DELETE CASCADE, NOT NULL                                        | Кому выдано.                                                         |
| `package_id`          | GUID     | FK → `theme_packages.id`, ON DELETE RESTRICT, NOT NULL                                   | Что выдано.                                                          |
| `kind`                | string   | NOT NULL, CHECK IN (`'lifetime'`,`'subscription'`,`'event_quota'`), default `'lifetime'` | Тип доступа. В MVP только `lifetime`.                                |
| `source`              | string   | NOT NULL, CHECK IN (`'admin_grant'`,`'purchase'`,`'trial'`), default `'admin_grant'`     | Откуда появилось. В MVP только `admin_grant`.                        |
| `granted_by_admin_id` | GUID     | FK → `organizers.id`, NULL                                                               | Какой админ выдал.                                                   |
| `granted_at`          | datetime | NOT NULL                                                                                 |                                                                      |
| `expires_at`          | datetime | NULL                                                                                     | Для `subscription`; в MVP всегда `NULL`.                             |
| `uses_remaining`      | int      | NULL                                                                                     | Для `event_quota`; в MVP всегда `NULL`.                              |
| `revoked_at`          | datetime | NULL                                                                                     | Установлено при revoke.                                              |
| `revoked_by_admin_id` | GUID     | FK → `organizers.id`, NULL                                                               |                                                                      |
| `note`                | text     | NULL                                                                                     | Свободная заметка админа (например: «VK, @ivan, 1500р, 2026-04-21»). |

Индексы: `organizer_id`, `(organizer_id, package_id, revoked_at)`, `expires_at` (для будущей джобы просрочек).

**Запрет на повторный grant активного entitlement:** при `POST grant` сервер **отказывается** создавать новый entitlement, если уже есть активный не-отозванный не-истёкший entitlement того же организатора на тот же пакет — возвращает `409 entitlement_already_active` с existing `entitlementId`.

### 6.6 `admin_audit_log`

| Колонка               | Тип      | Ограничения                                               | Описание                                                            |
| --------------------- | -------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| `id`                  | GUID     | PK                                                        |                                                                     |
| `admin_id`            | GUID     | FK → `organizers.id`, NOT NULL                            | Кто совершил действие.                                              |
| `action`              | string   | NOT NULL, CHECK IN (`'grant_package'`,`'revoke_package'`) | Тип действия (расширяемый enum).                                    |
| `target_organizer_id` | GUID     | FK → `organizers.id`, NULL                                | На кого было направлено действие.                                   |
| `package_id`          | GUID     | FK → `theme_packages.id`, NULL                            | Контекстный пакет.                                                  |
| `entitlement_id`      | GUID     | FK → `organizer_entitlements.id`, NULL                    | Контекстный entitlement.                                            |
| `note`                | text     | NULL                                                      | Копия note из формы grant/revoke.                                   |
| `ip`                  | string   | NULL                                                      | IP админа (опционально; если просто реализуется через HttpContext). |
| `created_at`          | datetime | NOT NULL                                                  |                                                                     |

Индексы: `admin_id`, `target_organizer_id`, `created_at`.

**Запись в лог — обязательна** при каждом успешном grant/revoke; выполняется **в той же транзакции**, что и изменение `organizer_entitlements`.

### 6.7 Диаграмма связей (словесно)

```
organizers (role)
  └─< organizer_entitlements >─ theme_packages ─< theme_package_items >─ themes
  └─< admin_audit_log (admin_id)
                       (target_organizer_id, package_id, entitlement_id)
```

## 7. Начальные данные (seed)

Реализуется в `CherryPlayServer/Infrastructure/Data/DataSeeder.cs` идемпотентно (запускается при старте сервера; существующие записи не перезаписываются).

### 7.1 Темы (из enum `PartyThemeId`)

| theme_id            | display_name        | visibility |
| ------------------- | ------------------- | ---------- |
| `basic`             | Базовый             | public     |
| `cyberpunk`         | Cyberpunk           | public     |
| `sakura`            | Sakura              | public     |
| `art-deco`          | Art Deco            | public     |
| `spring-cross-step` | Весенний кросс-степ | public     |

### 7.2 Пакеты

| code                | name                | is_auto_granted | is_active |
| ------------------- | ------------------- | --------------- | --------- |
| `free`              | Бесплатный          | **true**        | true      |
| `extended`          | Расширенный         | false           | true      |
| `spring-cross-step` | Весенний кросс-степ | false           | true      |

### 7.3 Состав пакетов (`theme_package_items`)

- `free` → `basic`
- `extended` → `cyberpunk`, `sakura`, `art-deco`
- `spring-cross-step` → `spring-cross-step`

### 7.4 Первый админ

Сидирование **не создаёт** админа автоматически. Процедура (документируется в OPS):

```sql
UPDATE organizers SET role='admin' WHERE email='<admin-email>';
-- или для OAuth:
UPDATE organizers SET role='admin' WHERE id='<GUID>';
```

## 8. API контракты

Все новые эндпоинты документируются в [CONTRACTS.md](CONTRACTS.md) (новые разделы §3.6 «Admin» и §3.7 «Theme access») и индексируются в [CherryPlayServer/API.md](CherryPlayServer/API.md).

Имена полей — **camelCase** (как везде в API).

### 8.1 Theme access для организатора

#### `GET /api/organizer/me/theme-access`

Авторизация: JWT организатора (любая роль).

Ответ 200:

```json
{
  "grantedThemeIds": ["basic", "cyberpunk"],
  "visibleLockedThemes": [
    {
      "themeId": "sakura",
      "packageCode": "extended",
      "packageName": "Расширенный"
    },
    {
      "themeId": "art-deco",
      "packageCode": "extended",
      "packageName": "Расширенный"
    }
  ],
  "contactUrl": "https://vk.com/<owner>"
}
```

Семантика полей:

- `grantedThemeIds` — все темы (включая free), к которым у организатора есть доступ.
- `visibleLockedThemes` — **только публичные** темы, к которым доступа нет (клиент рисует их с замком и CTA). Для каждой недоступной публичной темы возвращается **первый подходящий** активный пакет (стабильная сортировка по `code`) — он показывается как «канонический пакет для покупки».
- Приватные темы, к которым у организатора нет доступа, **не возвращаются вовсе**.
- `contactUrl` — ссылка на админа из конфига (см. §10).

Ошибки: 401.

### 8.2 Админ-API

Префикс: `/api/admin/*`. Авторизация: JWT с `role=admin`. Любой запрос без роли admin → `403 admin_only` (без раскрытия существования эндпоинтов — единое тело ответа).

#### 8.2.1 `GET /api/admin/organizers`

Query:

| Параметр   | Тип     | Описание                                                 |
| ---------- | ------- | -------------------------------------------------------- |
| `query`    | string? | Поиск по подстроке в `name` и `email`. Case-insensitive. |
| `page`     | int?    | Страница (1-based), default 1.                           |
| `pageSize` | int?    | default 20, max 100.                                     |

Ответ 200:

```json
{
  "items": [
    {
      "id": "…",
      "name": "Иван Организатор",
      "email": "ivan@example.com",
      "oauthProviders": ["vk"],
      "role": "organizer",
      "activeEntitlementsCount": 1,
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

#### 8.2.2 `GET /api/admin/organizers/{id}`

Ответ 200 (`AdminOrganizerDetailDto`):

```json
{
  "id": "…",
  "name": "…",
  "email": "…",
  "oauthAccounts": [
    { "provider": "vk", "providerUserId": "…", "providerUserName": "…" }
  ],
  "role": "organizer",
  "createdAt": "…",
  "entitlements": [
    {
      "id": "…",
      "packageId": "…",
      "packageCode": "extended",
      "packageName": "Расширенный",
      "kind": "lifetime",
      "source": "admin_grant",
      "grantedAt": "…",
      "grantedByAdminId": "…",
      "grantedByAdminName": "…",
      "expiresAt": null,
      "usesRemaining": null,
      "revokedAt": null,
      "revokedByAdminId": null,
      "note": "VK, @ivan, 1500р"
    }
  ]
}
```

В `entitlements` возвращаются **все** записи (активные и отозванные/истёкшие), отсортированы по `grantedAt DESC`. UI может раздвинуть на две секции.

Ошибки: 404 `organizer_not_found`.

#### 8.2.3 `GET /api/admin/theme-packages`

Ответ 200:

```json
{
  "items": [
    {
      "id": "…",
      "code": "extended",
      "name": "Расширенный",
      "description": "Cyberpunk, Sakura, Art Deco",
      "isAutoGranted": false,
      "isActive": true,
      "themeIds": ["cyberpunk", "sakura", "art-deco"]
    }
  ]
}
```

Только чтение; сортировка по `code ASC`. Используется админским UI для формы grant.

#### 8.2.4 `POST /api/admin/organizers/{id}/entitlements`

Тело:

```json
{
  "packageId": "…",
  "note": "VK, @ivan, 1500р, 2026-04-21"
}
```

Поведение:

- Валидация: `organizerId` существует; `packageId` существует и `is_active=true`; пакет **не `isAutoGranted`** (авто-пакеты выдавать бессмысленно — всегда 400 `package_is_auto_granted`).
- Если уже есть активный не-отозванный не-истёкший entitlement на тот же пакет → `409 entitlement_already_active` с полем `existingEntitlementId`.
- Иначе: создать entitlement `kind='lifetime'`, `source='admin_grant'`, `granted_by_admin_id=<caller>`, `note=<body.note>`.
- Записать `admin_audit_log` (`action='grant_package'`) в той же транзакции.

Ответ 201: `EntitlementDto` (как в 8.2.2).

#### 8.2.5 `DELETE /api/admin/organizers/{id}/entitlements/{entitlementId}`

Тело (опционально):

```json
{ "note": "причина отзыва" }
```

Поведение:

- Валидация: entitlement существует и принадлежит указанному организатору.
- Если уже отозван → `409 entitlement_already_revoked`.
- Иначе: установить `revoked_at=now()`, `revoked_by_admin_id=<caller>`; `note` не затирается, а если в body указан — **конкатенируется** к существующему через `\n\n--- revoke: <date> ---\n`.
- Записать `admin_audit_log` (`action='revoke_package'`).

Ответ 204.

### 8.3 Изменения в существующих эндпоинтах

#### 8.3.1 `POST /api/parties`

- Перед сохранением: проверить, что `partyThemeId` доступен организатору (§4.1).
- Если недоступен → `403 theme_not_entitled`.
- Если `partyThemeId` не указан → использовать `basic`.

#### 8.3.2 `PUT /api/parties/{partyId}`

- Проверка entitlement выполняется **только если** в теле передан `partyThemeId` и он **отличается** от сохранённого у вечеринки.
- Если поле `partyThemeId` не передано или равно текущему — никаких проверок.

#### 8.3.3 `PATCH /api/organizer/profile` (`UpdateOrganizerDto`)

- В MVP поле `defaultPartyThemeId` **исключается** из `UpdateOrganizerDto` (если присутствует — игнорируется и **не меняет** значение в БД). Отдельный код ошибки не возвращается.
- Поле `defaultPartyThemeId` в `OrganizerDto` (ответах) **остаётся** — это обратно совместимо.

### 8.4 Общие ошибки (расширение §1.1 CONTRACTS)

Формат ошибки — существующий (см. CONTRACTS.md). Добавляются машинные коды:

| Код                           | HTTP | Когда                                                                                                          |
| ----------------------------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| `theme_not_entitled`          | 403  | POST/PUT party: тема недоступна организатору. Тело: `{ code, message, themeId, requiredPackageCodes: [...] }`. |
| `admin_only`                  | 403  | Не-админ дёрнул `/api/admin/*`.                                                                                |
| `package_not_found`           | 404  | Grant: пакета нет или `is_active=false`.                                                                       |
| `organizer_not_found`         | 404  | Grant/read: организатора нет.                                                                                  |
| `entitlement_not_found`       | 404  | Revoke: entitlement не найден.                                                                                 |
| `entitlement_already_active`  | 409  | Grant: активный entitlement уже существует.                                                                    |
| `entitlement_already_revoked` | 409  | Revoke: уже отозван.                                                                                           |
| `package_is_auto_granted`     | 400  | Попытка grant auto-granted пакета.                                                                             |

## 9. Фронтенд

### 9.1 CherryPlayList — PartyEditor

Файл: `CherryPlayList/src/workspaces/party/components/PartyEditor.tsx`.

Изменения:

1. При открытии PartyEditor подтянуть `GET /api/organizer/me/theme-access` (через `partyService` / новый метод, с кэшем на сессию приложения; инвалидация при явных действиях — логин/логаут).
2. Список тем строить следующим образом:
   - **Доступные темы** (`grantedThemeIds`) — рендерим стандартно, кликабельны.
   - **Публичные платные** темы (присутствуют в `visibleLockedThemes`) — рендерим с замком, **клик запрещён или открывает модалку с CTA** «Доступно в пакете `{packageName}`. Для покупки свяжитесь с администратором: `<contactUrl>`». Кнопка CTA ведёт на `contactUrl` (`target="_blank" rel="noopener noreferrer"`).
   - **Приватные темы без доступа** (не пришли в ответе) — **не показываем** в UI вообще.
3. Если текущий `themeId` вечеринки попадает в «locked» список (кейс: доступ был и пропал, но вечеринка живёт дальше) — оставить тему выбранной, но пометить визуально «ограничен доступ»; разрешить переключение на любую доступную; при сохранении без смены темы сервер отказа не даст (см. §4.2).
4. Тосты/ошибки: при ответе сервера `403 theme_not_entitled` показать сообщение с названием нужного пакета и CTA.

### 9.2 CherryPlayWeb — CabinetPartyForm

Файл: `CherryPlayWeb/src/pages/CabinetPartyForm.tsx`.

Аналогично §9.1 — подтянуть `theme-access`, рисовать замки, приватные скрывать, CTA.

Если Cabinet сейчас не предлагает выбор темы — этот пункт выполняется в будущей итерации; однако **проверка сервером при PUT — обязательна уже сейчас**, независимо от наличия UI.

### 9.3 CherryPlayWeb — Админ-раздел `/admin/*`

Директория: `CherryPlayWeb/src/pages/admin/` (новая).

Маршруты (в `src/constants/routes.ts`):

- `/admin` → редирект на `/admin/organizers`.
- `/admin/organizers` — список организаторов.
- `/admin/organizers/:id` — детальная страница.

**Guard роута:** HOC / hook `useRequireAdmin()`. Определение роли:

- После логина текущий claim `role` берётся из `GET /api/organizer/me` (расширить `OrganizerDto` полем `role`) либо из уже подписанного JWT (для Web — cookie; клиент не видит claims → лучше отдавать через `/me`).
- Если `role !== 'admin'` → редирект на `/cabinet` с тостом «Доступ запрещён».

**Страница `/admin/organizers`:**

- Поле поиска (debounce 300ms) → `GET /api/admin/organizers?query=…&page=…`.
- Таблица/карточки: `name`, `email` или `OAuth провайдер + providerUserName` (первый из списка `oauthProviders`), `role` (badge), `activeEntitlementsCount`, `createdAt`.
- Клик по строке → `/admin/organizers/:id`.
- Пагинация (Prev/Next + номер страницы).

**Страница `/admin/organizers/:id`:**

- Карточка профиля (read-only).
- Секция «Активные доступы» — список не отозванных и не истёкших entitlement'ов; у каждого — кнопка «Отозвать» → модалка с полем `note` → `DELETE`.
- Секция «История доступов» (collapsed) — отозванные и истёкшие.
- Кнопка «Выдать пакет» → модалка:
  - Select пакетов (из `GET /api/admin/theme-packages`, фильтруем `isActive=true` и `isAutoGranted=false`), с отображением состава тем.
  - Textarea `note` (обязательное поле, min 1 символ).
  - Кнопка «Выдать» → `POST` → обновить список.
- Все ошибки (409, 400, 404) — показывать понятным текстом в модалке, не закрывая её.

### 9.4 Компоненты и сервисы (Web)

- `src/services/adminApiService.ts` — вызовы `/api/admin/*`.
- `src/services/themeAccessService.ts` — `/api/organizer/me/theme-access`.
- `src/hooks/useThemeAccess.ts` — React-хук с SWR/кешом на время сессии.
- `src/hooks/useRequireAdmin.ts` — guard.
- `src/components/ThemeLockedTile.tsx` — UI плитки заблокированной темы.

## 10. Конфигурация

### 10.1 Константа ссылки на админа

Строка ссылки хранится как константа, доступная и бэкенду, и фронту. **Источник истины — env-переменная сервера**, чтобы поменять без пересборки фронта.

- Бэкенд: конфиг-ключ `Admin:ContactUrl` (`CherryPlayServer/appsettings.json` + env override `ADMIN_CONTACT_URL`).
- Начальное значение: **ссылка на VK владельца продукта** (заполнить на этапе настройки инфраструктуры; в репозиторий коммитить плейсхолдер `https://vk.com/<owner>`).
- Сервер отдаёт значение в `GET /api/organizer/me/theme-access` → `contactUrl`.
- Дополнительно — в `GET /api/config` (публичный) добавить поле `adminContactUrl` — на случай, если нужна ссылка на странице логина/в публичной витрине.

Документируется в [ENV.md](ENV.md) и [CherryPlayServer/OPS.md](CherryPlayServer/OPS.md).

### 10.2 Переменные для JWT

Без изменений: существующий `JWT_SECRET_KEY`. В payload токена добавляется claim `role`.

## 11. Безопасность

- Rate limiting на `/api/admin/*` — по существующему механизму (уровень «строгий»: например 30 req/min per admin). Документируется в OPS.md.
- Все ответы `/api/admin/*` для не-админов — одинаковое тело `admin_only` (не раскрываем существование ресурсов).
- `admin_audit_log` пишется **в той же транзакции**, что и изменение `organizer_entitlements`. Если транзакция откатилась — лога тоже нет (ОК), если прошла — лог гарантирован.
- `contactUrl` — это публичная ссылка; не содержит секретов.
- Валидация `note`: максимум 2000 символов, никакой HTML/MD-рендер на бэке.
- Добавить claim `role` в JWT **аккуратно** — старые токены без claim считаются `organizer` (бэкенд падает в дефолт).
- Защитные пояса: при любом обращении к `/api/admin/*` бэкенд повторно проверяет роль **из БД** (а не только из claim), на случай если роль была отозвана после выдачи токена. Для MVP достаточно проверки claim'а **+** один DB-hit `SELECT role FROM organizers WHERE id=@id` на запрос.

## 12. Миграционный план

Последовательность — строго в этом порядке:

1. **Миграция БД (bg-1):** добавить колонку `role` в `organizers`, заполнить дефолтом `'organizer'`.
2. **Миграция БД (bg-2):** создать таблицы `themes`, `theme_packages`, `theme_package_items`, `organizer_entitlements`, `admin_audit_log` с индексами из §6.
3. **Сидирование (код):** `DataSeeder` добавляет темы из §7.1 и пакеты/их состав из §7.2–§7.3, если их ещё нет.
4. **Enum/домен (код):** `PartyRole` или `OrganizerRole` enum в `Core/Enums`; добавить в доменную сущность `Organizer.Role`.
5. **Репозитории:** `IThemeRepository`, `IThemePackageRepository`, `IOrganizerEntitlementRepository`, `IAdminAuditLogRepository` + EF реализации.
6. **Сервис прав:** `IThemeAccessService.IsThemeAccessibleAsync(organizerId, themeId)`, `GetAccessSummaryAsync(organizerId)`. Используется и при валидации Party, и при `/theme-access`.
7. **JWT:** включить claim `role` в генерацию токена (`AuthService`); middleware — мапит claim в `HttpContext.User`.
8. **Атрибут авторизации:** `[AuthorizeAdmin]` (аналог существующего `[AuthorizeOrganizer]`; дополнительный DB-check см. §11).
9. **REST эндпоинты:** `ThemeAccessController`, `AdminOrganizersController`, `AdminThemePackagesController` (из §8).
10. **Расширить валидацию `PartyService`** (Create/Update) на вызов `IThemeAccessService` (см. §4.2).
11. **Конфиг `Admin:ContactUrl`** + exposure в `/api/config` и `/theme-access`.
12. **Фронт CherryPlayWeb:** guard + страницы `/admin/*` + хук `useThemeAccess` + обновление `CabinetPartyForm` (если тема редактируется).
13. **Фронт CherryPlayList:** хук `useThemeAccess` + замки/CTA в `PartyEditor`.
14. **Обновление документации** (см. §14).
15. **Первый админ:** вручную выставить `role='admin'` в prod.

Каждый шаг коммитится отдельно; после 1–3 проект должен билдиться, миграции применяться, сидер не падать. После 9 — бэкенд готов к использованию без UI.

## 13. Критерии приёмки (acceptance)

Функциональные:

1. Новый организатор сразу после регистрации может создать вечеринку с `basic` без каких-либо ручных действий админа.
2. Новый организатор при попытке `POST /api/parties` с `partyThemeId='cyberpunk'` получает `403 theme_not_entitled` с указанием `requiredPackageCodes: ['extended']`.
3. Админ через `/admin/organizers/:id` может выдать пакет `extended` этому организатору. После чего тот же `POST /api/parties` проходит успешно.
4. После revoke пакета `extended`:
   - существующие вечеринки организатора с темой `cyberpunk` **продолжают открываться и редактироваться** без смены темы;
   - попытка сменить тему на `sakura` у новой или существующей вечеринки → `403 theme_not_entitled`.
5. `GET /api/organizer/me/theme-access` у «чистого» организатора возвращает `grantedThemeIds: ['basic']` и 4 locked публичных темы.
6. Если тема помечена `visibility='private'` и у организатора нет доступа — её нет в `grantedThemeIds` и нет в `visibleLockedThemes`.
7. `POST /api/admin/organizers/{id}/entitlements` с `packageId` free-пакета → `400 package_is_auto_granted`.
8. Повторный `POST` того же пакета активному entitlement → `409 entitlement_already_active` с `existingEntitlementId`.
9. В таблице `admin_audit_log` после каждого успешного grant/revoke появляется ровно одна строка в той же транзакции.
10. Любой `/api/admin/*` от организатора с `role='organizer'` → `403 admin_only`.
11. В UI CherryPlayWeb страницы `/admin/*` недоступны не-админу (редирект) и видны админу.
12. В PartyEditor (CherryPlayList) для не-админа платные публичные темы отрисованы с замком, клик показывает CTA с `contactUrl`.
13. PUT вечеринки без поля `partyThemeId` **никогда** не падает по `theme_not_entitled`.

Нефункциональные:

14. Миграции применяются на чистой БД (новая установка) и на существующей dev-БД без ошибок.
15. Сидер идемпотентен: повторный запуск сервера не создаёт дублей в `themes`/`theme_packages`/`theme_package_items`.
16. Код проходит существующий lint/format (см. `.cursor/rules/cherryplay-lint-format.mdc`).

## 14. Обновления документации

Обязательные правки (в одной PR-пачке с кодом):

- **[CONTRACTS.md](CONTRACTS.md):**
  - §1.1 — добавить коды ошибок из §8.4 ТЗ.
  - §3.3 — в `UpdateOrganizerDto` пометить, что `defaultPartyThemeId` **не принимается** в MVP; в `OrganizerDto` добавить поле `role`.
  - §3.4 — в описаниях POST/PUT parties упомянуть проверку entitlement.
  - Новые разделы §3.6 «Theme access» (для `GET /api/organizer/me/theme-access`) и §3.7 «Admin» (все `/api/admin/*`).
  - §6 — DTO: `ThemeAccessDto`, `AdminOrganizerListItemDto`, `AdminOrganizerDetailDto`, `EntitlementDto`, `ThemePackageDto`, `GrantEntitlementRequest`, `RevokeEntitlementRequest`.
- **[CherryPlayServer/DATABASE.md](CherryPlayServer/DATABASE.md):**
  - В `organizers` — колонка `role`.
  - Новые таблицы `themes`, `theme_packages`, `theme_package_items`, `organizer_entitlements`, `admin_audit_log` (перенести описание из §6 ТЗ).
  - Раздел «Связи и политика удаления» — дополнить каскадами из §6.
- **[GLOSSARY.md](GLOSSARY.md):**
  - Новый раздел «Монетизация и доступ к темам» с терминами из §3 ТЗ: **ThemePackage, Entitlement, Private theme, Auto-granted package, Admin (роль)**.
- **[THEMES.md](THEMES.md):**
  - Добавить раздел «Доступ к темам и монетизация» со ссылкой на `FEATURE_THEME_MONETIZATION.md` и краткой моделью (пакеты, free, private).
- **[ADDING_THEME.md](ADDING_THEME.md):**
  - Шаг «Регистрация темы в каталоге БД»: напомнить, что при добавлении новой темы (кроме code-регистрации) нужно:
    - сидер добавит запись в `themes` автоматически;
    - в миграции/сидере решить, в какой пакет добавить тему (иначе она будет публичная, но недоступна никому).
- **[RELEASE_PLAN.md](RELEASE_PLAN.md):**
  - §2.2 — «приватные темы как продаваемая фича» переведено из «закладываем модель» в «реализовано через `FEATURE_THEME_MONETIZATION.md`» (ссылка).
- **[docs/integration/accounts-and-auth.md](docs/integration/accounts-and-auth.md):**
  - Раздел «Роли» — добавить роль `admin` и claim `role` в JWT.
- **[CherryPlayServer/OPS.md](CherryPlayServer/OPS.md):**
  - Раздел «Как выдать роль admin» (UPDATE SQL).
  - Раздел «Rate limiting» — упомянуть `/api/admin/*`.
- **[ENV.md](ENV.md):**
  - Новая переменная `ADMIN_CONTACT_URL` (и соответствующий ключ `Admin:ContactUrl`).
- **[CherryPlayServer/API.md](CherryPlayServer/API.md):**
  - Добавить строки указателя на §3.6 «Theme access» и §3.7 «Admin».
- **[CherryPlayWeb/docs/pages.md](CherryPlayWeb/docs/pages.md):**
  - Добавить новые маршруты `/admin/*`, их guard и используемые эндпоинты.

## 15. Открытые вопросы / закладки на будущее

Не требуются для реализации MVP, но **схема должна это позволять без миграций**:

1. **Subscription (`kind='subscription'`, `expires_at`)** — когда появится, добавить:
   - фоновая джоба, которая раз в сутки помечает истёкшие и шлёт Telegram/VK-нотификацию админу;
   - в `/theme-access` предупреждение «заканчивается через N дней».
2. **Event quota (`kind='event_quota'`, `uses_remaining`)** — правила:
   - «использование» = **первый `StartSession` по вечеринке** (решение владельца); отдельный флаг на вечеринке, чтобы не декрементить повторно;
   - при `usesRemaining=0` — автоматически считать entitlement неактивным.
3. **UI редактирования пакетов в админке** — когда количество пакетов вырастет > 5. Сейчас — миграции.
4. **Audit-log UI** — страница `/admin/audit` с фильтрами.
5. **Массовые действия** — grant пакета пачке организаторов.
6. **Биллинг/самообслуживание покупки** — интеграция с ЮKassa/Tinkoff/Boosty; grant автоматический; `source='purchase'`; реф на external payment id в `note` или отдельной колонке.
7. **Multi-admin delegation** — `/api/admin/organizers/{id}/role` для выдачи/отзыва роли admin.
8. **Grandfathering-миграция** — разовый скрипт «выдать всем текущим организаторам entitlement'ы на все используемые ими темы», если потребуется.
