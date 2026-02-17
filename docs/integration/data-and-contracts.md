# Данные и контракты

Идентичность вечеринки, общие DTO и ссылки на полное описание REST/SignalR и БД. Соответствует [RELEASE_PLAN.md](../../RELEASE_PLAN.md) §3.1, §3.2 и [CONTRACTS.md](../../CONTRACTS.md).

## Идентичность вечеринки и ссылки (план §3.1)

- **Публичная ссылка для зрителя**: `party/<shortCode>` (плейлист и сессия), `party/<shortCode>/info` (информация о вечеринке).
- **shortCode**: уникальный, короткий, устойчивый к похожим символам (0/O, 1/l); **неизменяемый** после создания; используется в каталоге и шаринге.
- **partyId**: GUID вечеринки; используется в API и SignalR **организатора**. В публичных эндпоинтах и для зрителя идентификатор — только **shortCode**.

## Данные на сервере (план §3.2)

- **Вечеринка**: название, описание, организатор, место, город, дата/расписание, тема, флаг «в каталоге», shortCode.
- **Плейлист**: только отображаемые поля (id, name/title, duration, структура групп), **без абсолютных путей** к файлам.
- **Состояние сессии**: минимум для отображения зрителю (played/disabled, «сессия активна/нет», последнее известное состояние).

## Где смотреть контракты и схему БД

| Что | Документ |
|-----|----------|
| **REST API** (Public и Organizer), **SignalR** (методы и события), **DTO** (PartyPlaylistDto, PlaybackStateDto, PublicPartyDto, PartyDto, CreatePartyDto, PartyStateDto и т.д.) | [CONTRACTS.md](../../CONTRACTS.md) |
| **Схема БД**: Organizer, Party, PartyPlaylist, SessionState; связи и политика удаления | [CherryPlayServer/DATABASE.md](../../CherryPlayServer/DATABASE.md) |
| **Версионирование и обратная совместимость** (ломающие изменения, shortCode и маршруты) | [CONTRACTS.md](../../CONTRACTS.md) §10 |
| **Реализация сервера**: запуск, эндпоинты, Hub, хранилище | [CherryPlayServer/README.md](../../CherryPlayServer/README.md); навигация по контрактам — [CherryPlayServer/API.md](../../CherryPlayServer/API.md) |
| **Реализация веб-клиента**: структура, API, настройка | [CherryPlayWeb/README.md](../../CherryPlayWeb/README.md) |

Имена полей в JSON — **camelCase**. Изменения имён методов Hub, событий и полей DTO считаются ломающими; новые необязательные поля и новые события — обратно совместимы.
