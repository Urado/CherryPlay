# Party

Workspace для создания и управления вечеринками с трансляцией плейлиста.

## Описание

Модуль позволяет организаторам создавать вечеринки с выбором стиля оформления, настраивать кастомизацию и получать уникальный URL для веб-страницы вечеринки.

## Основные компоненты

- **PartyView** (`src/workspaces/party/PartyView.tsx`) - Основной компонент workspace
- **PartyEditor** (`src/workspaces/party/components/PartyEditor.tsx`) - Форма создания вечеринки
- **PartyPreview** (`src/workspaces/party/PartyPreview.tsx`) - Превью плейлиста
- **partyStore** (`src/shared/stores/partyStore.ts`) - Store состояния вечеринки
- **partyService** (`src/shared/services/partyService.ts`) - Сервис для работы с API

## Функциональность

- Создание вечеринки с названием и выбором стиля (Cyberpunk, Sakura, Art Deco, Базовый)
- Настройка кастомизации для выбранного стиля
- Превью плейлиста с применением стиля
- Получение уникального URL для веб-страницы
- Сохранение состояния вечеринки между сессиями
- Интеграция с SignalR для трансляции (в разработке)

## Зависимости

- `@cherryplay/components` - библиотека компонентов для отображения плейлиста
- `projectStore` - данные плейлиста для трансляции (projectStore заменяет устаревший playerItemsStore)

## Связь со Streaming System и Player

Party workspace отвечает за **жизненный цикл вечеринки**:

- создание записи на сервере (через `partyService`);
- получение `partyId`, `shortCode` и публичного URL;
- сохранение этих данных в `partyStore.createdParty`.

Дальше в работу вступают другие модули:

- **Streaming System** (`../systems/streaming.md`):
  - использует `partyId` и `shortCode` для подключения к SignalR Hub;
  - синхронизирует плейлист и состояние воспроизведения с сервером;
  - обеспечивает доставку состояния до CherryPlayWeb.

- **Player workspace** (`./player.md`):
  - при наличии созданной вечеринки и активного подключения к серверу:
    - транслирует позицию и состояние воспроизведения;
    - обновляет плейлист вечеринки на сервере;
    - служит источником правды для Streaming System.

В итоге связка модулей выглядит так:

1. **Party** — создаёт вечеринку и выдаёт URL.
2. **Player** — запускает сессию воспроизведения.
3. **Streaming** — транслирует состояние для зрителей.

Подробнее о протоколах, потоках данных и серверной части см. модуль [Streaming](../systems/streaming.md) и [docs/integration/streaming.md](../../../../docs/integration/streaming.md).
