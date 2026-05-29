# Party Management

Управление вечеринками: создание, редактирование метаданных, публикация плейлиста, каталог и видимость. Соответствует [RELEASE_PLAN.md](../../RELEASE_PLAN.md) §4.2, §6.2 и §3.3.

## Обзор

- **Кабинет организатора** (минимум): профиль (название/лого/ссылки), список своих вечеринок, управление публичностью (unlisted ↔ в каталоге), создание/редактирование/удаление метаданных вечеринки.
- В кабинете v1 **нет управления эфиром** (сессией) — только метаданные и публикация; эфир управляется из **CherryPlayList**.
- **Локальный проект — источник истины**: при Publish в режиме редактирования серверная версия плейлиста перетирается данными из приложения.

## Поток: связь локального проекта и серверной вечеринки

По плану §3.3:

1. Организатор создаёт вечеринку на сервере (из приложения или кабинета Web).
2. В **CherryPlayList** сохраняется **partyId** в локальном проекте (и shortCode/url для шаринга).
3. **Режим редактирования**: публикация плейлиста на сервер — **по кнопке Publish**; локальный проект перетирает серверную версию.
4. **Режим сессии**: изменения плейлиста и состояния идут **live** (через SignalR и при необходимости REST PUT playlist).

## CRUD вечеринок

- **Создание**: POST `/api/parties` с телом CreatePartyDto → ответ PartyDto (id, shortCode, …).
- **Чтение своей вечеринки**: GET `/api/parties/{partyId}` (только организатор).
- **Редактирование метаданных**: PUT `/api/parties/{partyId}` (описание, место, город, дата, расписание, флаг «в каталоге» и т.д.).
- **Удаление**: DELETE `/api/parties/{partyId}`.
- **Публикация плейлиста**: PUT `/api/parties/{partyId}/playlist` с телом PartyPlaylistDto (перетирает серверную версию).
- **Жизненный цикл**: POST `/api/parties/{partyId}/lifecycle` с телом `TransitionPartyLifecycleDto` (`partyLifecycleState`: `draft` \| `ready` \| `completed`) → ответ `PartyDto`. Разрешённые переходы: `draft` → `ready`; `ready` → `completed`; `ready` → `draft`. Состояние `completed` терминальное. При недопустимом переходе — **409** `invalid_lifecycle_transition` (поля `currentState`, `requestedState` в теле ошибки).

Список `GET /api/parties` (кабинет, модальное окно привязки в CherryPlayList) **не содержит** вечеринок в `draft`; черновик доступен по `GET /api/parties/{partyId}`. Публичный каталог (`GET /api/parties/public/list`) также исключает `draft`.

Полная спецификация — в [CONTRACTS.md](../../CONTRACTS.md) §3.4 (REST API вечеринок). Используют: **CherryPlayList** (создание, привязка partyId, Publish, переходы lifecycle); **кабинет в Web** (CRUD, toggle каталога, переходы lifecycle).

## Каталог и публичность

- По умолчанию вечеринка **unlisted** (доступна только по ссылке).
- Включение в **каталог** — решение организатора (toggle в кабинете).
- Публичный список вечеринок: GET `/api/parties/public/list` — только вечеринки с флагом «в каталоге».
- Антиспам: rate limiting на публичные ручки и Hub; лимиты по вечеринкам (например, ограничение числа «будущих» вечеринок на организатора — по плану §4.2).

### Карточка вечеринки в каталоге

В каталоге (PartyListPage, CherryPlayWeb) карточка вечеринки отображает **6 полей** в порядке: название, краткое описание, город, дата/время, теги танцев, внешняя ссылка. Тема, количество треков, длительность, shortCode, кнопка «Подробнее» и бейдж «В эфире» на карточке не показываются. Редактирование этих полей — в **CherryPlayList** (PartyEditor); данные сохраняются через PUT `/api/parties/{partyId}` (UpdatePartyDto) и сущность Party на сервере (см. [CONTRACTS.md](../../CONTRACTS.md) §6.4, §6.5; [CherryPlayServer/DATABASE.md](../../CherryPlayServer/DATABASE.md) — таблица Party: ShortDescription, ExternalLinkUrl, ExternalLinkText, DanceTagsJson).

## Лимиты v1

- Ограничение «будущих» вечеринок на организатора (например, 2); повышение лимита — вручную, без админки.

## Страницы для зрителей

- `party/<shortCode>` — просмотр плейлиста и состояния сессии (если есть).
- `party/<shortCode>/info` — информация о вечеринке (описание, город, место, дата, расписание, ссылки).

Данные для этих страниц — из публичных API по shortCode (см. [Data and Contracts](./data-and-contracts.md), [CONTRACTS.md](../../CONTRACTS.md) §2).

## Связь с модулями приложения

- [Party workspace](../../CherryPlayList/docs/modules/workspaces/party.md) — создание вечеринки, сохранение partyId/shortCode/url в partyStore, отображение URL зрителям.
- [Streaming](./streaming.md) — после создания вечеринки используется partyId для подключения к SignalR и публикации/синхронизации плейлиста и состояния.

## Контракты и модель данных

- REST и DTO: [CONTRACTS.md](../../CONTRACTS.md) §2 (Public), §3 (Organizer), §6 (модели).
- Схема БД (Party, Organizer, PartyPlaylist, SessionState): [CherryPlayServer/DATABASE.md](../../CherryPlayServer/DATABASE.md).
