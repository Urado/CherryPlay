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

- Создание вечеринки с названием и выбором стиля (Cyberpunk, Sakura, Art Deco)
- Настройка кастомизации для выбранного стиля
- Превью плейлиста с применением стиля
- Получение уникального URL для веб-страницы
- Сохранение состояния вечеринки между сессиями
- Интеграция с SignalR для трансляции (в разработке)

## Зависимости

- `@cherryplay/components` - библиотека компонентов для отображения плейлиста
- `playerItemsStore` - данные плейлиста для трансляции
