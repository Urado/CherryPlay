# Архитектура системы трансляции состояния плейлиста

## 1. Обзор системы

### 1.1 Назначение
Система позволяет организаторам создавать веб-страницы для трансляции состояния плейлиста в реальном времени. Зрители могут просматривать текущий плейлист и состояние воспроизведения через веб-интерфейс.

### 1.2 Основные компоненты
- **CherryPlayList** - Electron приложение для организаторов
- **CherryPlayWeb** - React веб-приложение для зрителей
- **CherryPlayComponents** - Общая библиотека React компонентов
- **CherryPlayServer** - C# сервер с SignalR Hub, API и БД

### 1.3 Основные сценарии использования

#### Сценарий 1: Подготовка вечеринки
1. Организатор создает плейлист в приложении
2. Создает вечеринку с выбором стиля и настройками кастомизации
3. Получает уникальный URL для веб-страницы
4. Зрители могут просматривать плейлист (без состояния воспроизведения)

#### Сценарий 2: Трансляция сессии
1. Организатор запускает сессию в приложении
2. Electron подключается к SignalR Hub
3. Начинается трансляция состояния воспроизведения (каждую секунду)
4. Зрители видят текущий трек, позицию, статус воспроизведения
5. При разрыве связи показывается офлайн состояние с последними данными

## 2. Архитектура системы

### 2.1 Общая схема

```
┌─────────────────┐
│  CherryPlayList │
│   (Electron)    │
│                 │
│  ┌───────────┐  │
│  │ Zustand   │  │
│  │  Stores   │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ SignalR   │  │
│  │  Client   │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │
         │ SignalR Connection
         │
┌────────▼─────────────────────────┐
│     CherryPlayServer             │
│                                 │
│  ┌──────────────┐  ┌──────────┐ │
│  │ SignalR Hub  │  │ REST API │ │
│  └──────┬───────┘  └────┬──────┘ │
│         │              │        │
│  ┌──────▼──────────────▼──────┐ │
│  │     Business Logic          │ │
│  └──────┬──────────────────────┘ │
│         │                         │
│  ┌──────▼──────┐                 │
│  │  MS SQL DB  │                 │
│  └─────────────┘                 │
└─────────┬─────────────────────────┘
          │
          │ SignalR / HTTP
          │
┌─────────▼─────────┐
│  CherryPlayWeb    │
│  (React + TS)     │
│                   │
│  ┌─────────────┐  │
│  │ SignalR     │  │
│  │  Client     │  │
│  └─────────────┘  │
└───────────────────┘
```

**Примечание:** CherryPlayServer построен на основе **слоистой архитектуры** (Layered Architecture) с применением принципов **Clean Code** и **SOLID**. Подробное описание архитектурных принципов см. в разделе 5.5.

### 2.2 Потоки данных

#### Поток 1: Создание вечеринки
1. Организатор создает вечеринку в приложении
2. Приложение отправляет данные на сервер через REST API
3. Сервер сохраняет в БД и возвращает уникальный URL
4. Приложение отображает URL организатору

#### Поток 2: Просмотр плейлиста (до сессии)
1. Зритель открывает URL вечеринки
2. React приложение запрашивает данные через REST API
3. Сервер возвращает сохраненный плейлист
4. React приложение отображает плейлист используя CherryPlayComponents

#### Поток 3: Трансляция состояния (во время сессии)
1. Организатор запускает сессию в приложении
2. Electron подключается к SignalR Hub
3. Приложение подписывается на изменения Zustand stores
4. При изменении состояния отправляется delta-обновление через SignalR
5. Сервер транслирует обновления всем подключенным зрителям
6. React приложение получает обновления и обновляет UI

#### Поток 4: Оптимизированная трансляция позиции
1. Каждую секунду Electron отправляет только `{ trackId, position }`
2. При изменении трека/статуса отправляется `{ stateChanged: true }`
3. Клиенты запрашивают полное состояние через SignalR метод
4. Сервер возвращает полное состояние

## 3. Структура базы данных

### 3.1 Таблицы

#### Users
- `Id` (Guid, PK)
- `Email` (string, unique, not null)
- `PasswordHash` (string, not null)
- `CreatedAt` (DateTime, not null)
- `LastLoginAt` (DateTime, nullable)

#### Parties
- `Id` (Guid, PK)
- `OrganizerId` (Guid, FK -> Users.Id, not null)
- `Name` (string, not null)
- `ShortCode` (string, unique, not null, index)
- `StyleId` (string, not null) - идентификатор стиля (cyberpunk, sakura, art-deco, etc.)
- `CustomizationSettings` (JSON, nullable) - настройки кастомизации для выбранного стиля
- `IsActive` (bool, not null, default: true)
- `CreatedAt` (DateTime, not null)
- `UpdatedAt` (DateTime, not null)
- `EventDateTime` (DateTime, nullable) - дата и время проведения мероприятия

#### PartyTracks
- `Id` (Guid, PK)
- `PartyId` (Guid, FK -> Parties.Id, not null, index)
- `TrackId` (string, not null) - UUID трека из приложения
- `Path` (string, not null)
- `Name` (string, not null)
- `Duration` (int, nullable) - в секундах
- `DisplayOrder` (int, not null) - порядок отображения в плоском списке
- `ParentGroupId` (Guid, nullable, FK -> PartyGroups.Id) - null для корневых треков

#### PartyGroups
- `Id` (Guid, PK)
- `PartyId` (Guid, FK -> Parties.Id, not null, index)
- `GroupId` (string, not null) - UUID группы из приложения
- `Name` (string, nullable)
- `DisplayOrder` (int, not null)
- `ParentGroupId` (Guid, nullable, FK -> PartyGroups.Id) - для вложенных групп
- `Settings` (JSON, nullable) - настройки группы (pauseBetweenTracks, actionAfterTrack)

#### PartySessions
- `Id` (Guid, PK)
- `PartyId` (Guid, FK -> Parties.Id, not null, unique index)
- `StartedAt` (DateTime, not null)
- `EndedAt` (DateTime, nullable)
- `CurrentTrackId` (string, nullable) - UUID текущего трека
- `Status` (string, not null) - idle, playing, paused, ended
- `Position` (float, not null, default: 0) - текущая позиция в секундах
- `Volume` (float, not null, default: 0.8)
- `Mode` (string, not null) - preparation, session
- `PlayedTrackIds` (JSON, nullable) - массив UUID проигранных треков
- `DisabledTrackIds` (JSON, nullable) - массив UUID отключенных треков
- `DisabledGroupIds` (JSON, nullable) - массив UUID отключенных групп
- `LastUpdatedAt` (DateTime, not null)

### 3.2 Индексы
- `Parties.ShortCode` - уникальный индекс для быстрого поиска по URL
- `Parties.OrganizerId` - индекс для списка вечеринок организатора
- `PartyTracks.PartyId` - индекс для загрузки треков вечеринки
- `PartyGroups.PartyId` - индекс для загрузки групп вечеринки
- `PartySessions.PartyId` - уникальный индекс (одна активная сессия на вечеринку)

### 3.3 Нормализация данных
- Треки и группы хранятся в нормализованном виде
- Иерархия групп восстанавливается через `ParentGroupId`
- Порядок элементов определяется через `DisplayOrder`
- Для быстрого доступа используется плоский список с указанием родителя

### 3.4 Миграции базы данных
- Миграции осуществляются с помощью **Code First** подхода в C# (Entity Framework Core)
- Схема базы данных определяется через Entity классы в `CherryPlayServer.Core/Entities/`
- Конфигурация сущностей выполняется через Fluent API в `CherryPlayServer.Infrastructure/Data/Configurations/`
- Миграции создаются и применяются через команды EF Core:
  - `dotnet ef migrations add <MigrationName>` - создание миграции
  - `dotnet ef database update` - применение миграций
- Все изменения схемы БД версионируются через миграции
- Миграции применяются автоматически при запуске приложения или вручную через CLI

## 4. API контракты

### 4.1 REST API

#### Аутентификация организатора
```
POST /api/auth/login
Request: { email: string, password: string }
Response: { token: string, userId: Guid }

POST /api/auth/register
Request: { email: string, password: string }
Response: { token: string, userId: Guid }
```

#### Управление вечеринками
```
GET /api/parties
Headers: Authorization: Bearer {token}
Response: PartyDto[]

GET /api/parties/{partyId}
Headers: Authorization: Bearer {token}
Response: PartyDto

POST /api/parties
Headers: Authorization: Bearer {token}
Request: CreatePartyDto
Response: PartyDto

PUT /api/parties/{partyId}
Headers: Authorization: Bearer {token}
Request: UpdatePartyDto
Response: PartyDto

DELETE /api/parties/{partyId}
Headers: Authorization: Bearer {token}
Response: 204 No Content
```

#### Публичный доступ (без аутентификации)
```
GET /api/parties/public/{shortCode}
Response: PublicPartyDto

GET /api/parties/public/{shortCode}/playlist
Response: PartyPlaylistDto

GET /api/parties/public/{shortCode}/state
Response: PartyStateDto
```

### 4.2 SignalR Hub методы

#### Методы клиента (вызываются клиентом)

##### Для Electron (организатор)
```
JoinPartyAsOrganizer(partyId: Guid, token: string)
  - Подключение организатора к вечеринке
  - Валидация токена
  - Возвращает: void

StartSession(partyId: Guid)
  - Запуск сессии трансляции
  - Создает/обновляет PartySession
  - Уведомляет всех зрителей о начале сессии
  - Возвращает: void

EndSession(partyId: Guid)
  - Завершение сессии
  - Обновляет PartySession.EndedAt
  - Уведомляет всех зрителей
  - Возвращает: void

UpdatePlaybackPosition(partyId: Guid, trackId: string, position: number)
  - Обновление позиции воспроизведения (каждую секунду)
  - Транслируется всем зрителям
  - Возвращает: void

NotifyStateChanged(partyId: Guid)
  - Уведомление об изменении состояния (трек, статус)
  - Клиенты должны запросить полное состояние
  - Возвращает: void

UpdateFullState(partyId: Guid, state: PlaybackStateDto)
  - Полное обновление состояния (при изменении трека/статуса)
  - Транслируется всем зрителям
  - Возвращает: void
```

##### Для React (зрители)
```
JoinPartyAsViewer(shortCode: string)
  - Подключение зрителя к вечеринке
  - Возвращает: PartyStateDto | null (текущее состояние если сессия активна)

RequestFullState(shortCode: string)
  - Запрос полного состояния вечеринки
  - Возвращает: PartyStateDto
```

#### События Hub (отправляются клиентам)

##### Для всех подключенных клиентов
```
OnSessionStarted(partyId: Guid)
  - Уведомление о начале сессии

OnSessionEnded(partyId: Guid)
  - Уведомление о завершении сессии

OnPlaybackPositionUpdated(partyId: Guid, trackId: string, position: number)
  - Обновление позиции воспроизведения

OnStateChanged(partyId: Guid)
  - Уведомление об изменении состояния (трек/статус)

OnFullStateUpdated(partyId: Guid, state: PlaybackStateDto)
  - Полное обновление состояния

OnConnectionStatusChanged(partyId: Guid, isOnline: bool)
  - Изменение статуса подключения организатора
```

### 4.3 DTO (Data Transfer Objects)

#### CreatePartyDto
```typescript
{
  name: string;
  styleId: string;
  customizationSettings?: Record<string, any>;
  playlistData: PlayerItemsData; // Текущее состояние playerItemsStore
  eventDateTime?: string; // ISO 8601 строка с датой и временем мероприятия
}
```

#### UpdatePartyDto
```typescript
{
  name?: string;
  styleId?: string;
  customizationSettings?: Record<string, any>;
  playlistData?: PlayerItemsData;
}
```

#### PartyDto
```typescript
{
  id: string;
  organizerId: string;
  name: string;
  shortCode: string;
  styleId: string;
  customizationSettings?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasActiveSession: boolean;
  eventDateTime?: string; // ISO 8601 строка с датой и временем мероприятия
}
```

#### PublicPartyDto
```typescript
{
  id: string;
  name: string;
  styleId: string;
  customizationSettings?: Record<string, any>;
  hasActiveSession: boolean;
  sessionStartedAt?: string;
}
```

#### PartyPlaylistDto
```typescript
{
  items: PlayerItemDto[];
  totalDuration: number;
  totalTracks: number;
}
```

#### PublicPartyListItemDto
```typescript
{
  id: string;
  name: string;
  shortCode: string;
  styleId: string;
  hasActiveSession: boolean;
  createdAt: string;
  totalTracks: number;
  totalDuration: number;
  eventDateTime?: string; // ISO 8601 строка с датой и временем мероприятия
}
```

#### PlayerItemDto
```typescript
{
  id: string;
  type: 'track' | 'group';
  name: string;
  // Для трека
  path?: string;
  duration?: number;
  // Для группы
  items?: PlayerItemDto[];
  settings?: GroupSettingsDto;
  // Общее
  displayOrder: number;
  level: number; // Уровень вложенности (0 для корневых)
}
```

#### GroupSettingsDto
```typescript
{
  pauseBetweenTracks?: number;
  actionAfterTrack?: string;
}
```

#### PartyStateDto
```typescript
{
  partyId: string;
  isSessionActive: boolean;
  sessionStartedAt?: string;
  playbackState?: PlaybackStateDto;
  playlist: PartyPlaylistDto;
}
```

#### PlaybackStateDto
```typescript
{
  currentTrackId: string | null;
  status: 'idle' | 'playing' | 'paused' | 'ended';
  position: number; // в секундах
  duration: number; // в секундах
  volume: number; // 0-1
  mode: 'preparation' | 'session';
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  lastUpdatedAt: string;
}
```

#### PlayerItemsData
```typescript
{
  items: PlayerItemDto[];
  // Вспомогательные данные для восстановления структуры
  rootItemIds: string[]; // Порядок корневых элементов
}
```

## 5. Структура проектов

### 5.1 CherryPlayList (Electron)
```
CherryPlayList/
├── electron/
│   ├── ipc/
│   │   └── streaming.ts          # IPC handlers для стриминга
│   └── services/
│       └── signalRService.ts     # SignalR клиент для Electron
├── src/
│   ├── workspaces/
│   │   └── party/
│   │       ├── PartyView.tsx     # UI для создания/управления вечеринками
│   │       ├── PartyPreview.tsx  # Превью дизайна вечеринки
│   │       └── components/
│   │           ├── PartyList.tsx
│   │           ├── PartyEditor.tsx
│   │           └── StyleSelector.tsx
│   └── shared/
│       ├── services/
│       │   └── partyService.ts    # Сервис для работы с вечеринками
│       └── stores/
│           └── partyStore.ts       # Store для управления вечеринками
```

### 5.2 CherryPlayWeb (React)
```
CherryPlayWeb/
├── src/
│   ├── pages/
│   │   ├── PartyView.tsx         # Страница просмотра вечеринки
│   │   └── PartyListPage.tsx     # Страница со списком всех вечеринок с фильтрами
│   ├── components/
│   │   ├── ConnectionStatus.tsx  # Статус подключения к SignalR
│   │   ├── ErrorMessage.tsx      # Компонент отображения ошибок
│   │   └── LoadingSpinner.tsx    # Компонент загрузки
│   ├── services/
│   │   ├── signalRService.ts    # SignalR клиент
│   │   └── partyApiService.ts    # REST API клиент
│   ├── hooks/
│   │   ├── usePartyState.ts     # Хук для состояния вечеринки
│   │   └── useSignalR.ts        # Хук для SignalR подключения
│   └── types/
│       └── api.ts               # TypeScript типы для API
```

**Примечание:** CherryPlayWeb использует фасадный компонент `PartyDisplay` из библиотеки `CherryPlayComponents` для отображения плейлиста и состояния воспроизведения. Все стили и темы изолированы в библиотеке, фронт только передает данные и `themeId`. Подробнее см. раздел 13.

#### 5.2.1 Страница списка вечеринок (PartyListPage)

Страница `PartyListPage` предоставляет интерфейс для просмотра всех доступных вечеринок с возможностью фильтрации.

**Основные функции:**
- Отображение списка всех публичных вечеринок в виде карточек
- Показ информации о каждой вечеринке: название, тема, количество треков, длительность, дата создания, дата мероприятия
- Индикация активных сессий (бейдж "В эфире")
- Переход к просмотру конкретной вечеринки по клику на карточку

**Система фильтров:**

Страница включает расширяемый блок фильтров для поиска вечеринок:

1. **Фильтр по датам:**
   - Дата от (`dateFrom`) - показывает только вечеринки с датой мероприятия не ранее указанной
   - Дата до (`dateTo`) - показывает только вечеринки с датой мероприятия не позднее указанной
   - Оба фильтра могут использоваться одновременно для выбора диапазона дат

2. **Фильтр по дням недели:**
   - Множественный выбор дней недели (воскресенье, понедельник, вторник и т.д.)
   - Показывает только вечеринки, дата мероприятия которых попадает на выбранные дни недели
   - Дни недели определяются по дате мероприятия (`EventDateTime`)

3. **Расширяемость:**
   - Блок фильтров спроектирован для легкого добавления новых фильтров в будущем
   - Фильтры можно сворачивать/разворачивать для экономии места
   - Кнопка "Сбросить" очищает все активные фильтры

**Особенности реализации:**
- Фильтрация выполняется на клиенте после загрузки всех вечеринок
- Вечеринки без указанной даты мероприятия (`EventDateTime === null`) исключаются из результатов при применении любых фильтров по датам
- Фильтры применяются комбинированно (логическое И): вечеринка должна соответствовать всем активным фильтрам

### 5.3 CherryPlayComponents (Библиотека)

Библиотека построена на основе системы изолированных тем с единым фасадом для фронта.

```
CherryPlayComponents/
├── src/
│   ├── core/                          # Общий слой (типы, утилиты, хуки)
│   │   ├── utils/
│   │   │   ├── time.ts                # Форматирование времени/длительности
│   │   │   └── playlist.ts            # Утилиты для работы с плейлистом
│   │   └── hooks/
│   │       └── useThemeVars.ts        # Хук для преобразования настроек в CSS переменные
│   │
│   ├── types/
│   │   └── index.ts                   # TypeScript типы (PlayerItem, PlaybackState, PartyDisplayData и т.д.)
│   │
│   ├── components/                    # Универсальные компоненты (для обратной совместимости)
│   │   ├── PartyDisplay/              # Фасадный компонент - единая точка входа для фронта
│   │   │   ├── PartyDisplay.tsx       # Выбирает тему по themeId и проксирует данные
│   │   │   └── PartyDisplay.css      # Базовые стили шапки
│   │   ├── Playlist/
│   │   │   ├── PlaylistView.tsx      # (deprecated - используйте PartyDisplay)
│   │   │   └── PlaylistItem.tsx      # (deprecated - используйте PartyDisplay)
│   │   └── Player/
│   │       └── CurrentTrackDisplay.tsx # (deprecated - используйте PartyDisplay)
│   │
│   └── themes/                        # Изолированные темы
│       ├── index.ts                   # Реестр тем (THEME_REGISTRY) и фабрики
│       ├── cyberpunk/                 # Тема Cyberpunk
│       │   ├── PartyDisplay.tsx       # Компонент вечеринки для темы
│       │   ├── PlaylistView.tsx       # Компонент плейлиста для темы
│       │   ├── PlaylistItem.tsx       # Компонент элемента для темы
│       │   ├── CurrentTrackDisplay.tsx # Компонент плеера для темы
│       │   └── styles/
│       │       ├── index.css
│       │       ├── playlist.css
│       │       ├── playlist-item.css
│       │       └── player.css
│       ├── sakura/                    # Тема Sakura (аналогичная структура)
│       └── art-deco/                  # Тема Art Deco (аналогичная структура)
```

**Принципы архитектуры:**

1. **Core-слой** - содержит общую логику (типы, утилиты форматирования, хуки), используемую всеми темами
2. **Изоляция тем** - каждая тема имеет собственные компоненты и стили, полностью независимые от других тем
3. **Фасадный компонент** - `PartyDisplay` принимает стандартизированные данные (`PartyDisplayData`) и автоматически выбирает нужную тему по `themeId`
4. **Фронт не знает о темах** - фронт передаёт только данные и `themeId`, вся логика выбора темы инкапсулирована в библиотеке

### 5.4 CherryPlayServer (C#)
```
CherryPlayServer/
├── CherryPlayServer.Api/
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── PartiesController.cs
│   │   └── PublicPartiesController.cs
│   ├── Hubs/
│   │   └── PartyHub.cs           # SignalR Hub
│   ├── DTOs/
│   │   └── ...
│   └── Program.cs
├── CherryPlayServer.Core/
│   ├── Entities/
│   │   └── ...
│   ├── Interfaces/
│   │   └── ...
│   └── Services/
│       ├── PartyService.cs
│       ├── StreamingService.cs
│       └── AuthService.cs
├── CherryPlayServer.Infrastructure/
│   ├── Data/
│   │   ├── ApplicationDbContext.cs
│   │   └── Configurations/        # Fluent API конфигурации Entity
│   └── Repositories/
│       └── ...
└── CherryPlayServer.Tests/
```

### 5.5 Архитектурные принципы

#### 5.5.1 Слоистая архитектура (Layered Architecture)

Проект **CherryPlayServer** построен на основе слоистой архитектуры с четким разделением ответственности:

```
┌─────────────────────────────────────┐
│   Presentation Layer (Api)          │
│   - Controllers                      │
│   - Hubs (SignalR)                  │
│   - DTOs                            │
│   - Валидация входных данных        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Business Logic Layer (Core)        │
│   - Entities (доменные модели)      │
│   - Interfaces (контракты)          │
│   - Services (бизнес-логика)        │
│   - Без зависимостей от Infrastructure│
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Data Access Layer (Infrastructure) │
│   - DbContext                       │
│   - Repositories                    │
│   - Entity Configurations           │
│   - Внешние зависимости            │
└─────────────────────────────────────┘
```

**Принципы разделения слоев:**
- **Api** зависит только от **Core** (через интерфейсы)
- **Core** не зависит от **Infrastructure** (инверсия зависимостей)
- **Infrastructure** реализует интерфейсы из **Core**
- Все зависимости направлены внутрь (Dependency Inversion Principle)

#### 5.5.2 Clean Code принципы

**Применяемые практики:**

1. **Именование:**
   - Понятные имена классов, методов, переменных
   - Имена отражают намерение (Intention-Revealing Names)
   - Избегание сокращений и аббревиатур

2. **Функции:**
   - Маленькие функции с одной ответственностью
   - Один уровень абстракции на функцию
   - Избегание побочных эффектов

3. **Комментарии:**
   - Код должен быть самодокументируемым
   - Комментарии только для объяснения "почему", а не "что"

4. **Обработка ошибок:**
   - Явная обработка ошибок
   - Использование исключений для исключительных ситуаций
   - Валидация входных данных на границах слоев

#### 5.5.3 SOLID принципы

**Single Responsibility Principle (SRP):**
- Каждый класс имеет одну причину для изменения
- `PartyService` - управление вечеринками
- `StreamingService` - трансляция состояния
- `AuthService` - аутентификация

**Open/Closed Principle (OCP):**
- Классы открыты для расширения, закрыты для модификации
- Использование интерфейсов для расширяемости
- Стратегии и паттерны для добавления функциональности

**Liskov Substitution Principle (LSP):**
- Реализации интерфейсов взаимозаменяемы
- Репозитории могут быть заменены без изменения бизнес-логики

**Interface Segregation Principle (ISP):**
- Интерфейсы специфичны и не содержат лишних методов
- Разделение `ISignalRService` для организатора и зрителя (если необходимо)

**Dependency Inversion Principle (DIP):**
- Зависимости направлены на абстракции (интерфейсы), а не на конкретные реализации
- Dependency Injection через конструкторы
- `Core` определяет интерфейсы, `Infrastructure` их реализует

#### 5.5.4 Dependency Injection

**Принципы DI:**
- Все зависимости внедряются через конструкторы
- Использование встроенного DI контейнера ASP.NET Core
- Регистрация сервисов в `Program.cs` или `Startup.cs`

**Пример регистрации:**
```csharp
// В Program.cs
builder.Services.AddScoped<IPartyService, PartyService>();
builder.Services.AddScoped<IStreamingService, StreamingService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPartyRepository, PartyRepository>();
```

**Преимущества:**
- Тестируемость (легко мокировать зависимости)
- Слабая связанность компонентов
- Гибкость (легко заменить реализации)

#### 5.5.5 Разделение ответственности

**По слоям:**

- **Presentation Layer (Api):**
  - Обработка HTTP запросов
  - Валидация входных данных
  - Маппинг DTO ↔ Entity
  - Обработка исключений и возврат корректных HTTP статусов

- **Business Logic Layer (Core):**
  - Бизнес-правила и валидация
  - Оркестрация операций
  - Работа с доменными моделями
  - Независимость от внешних технологий

- **Data Access Layer (Infrastructure):**
  - Работа с БД через Entity Framework
  - Реализация репозиториев
  - Конфигурация Entity
  - Работа с внешними сервисами

#### 5.5.6 Дополнительные практики

**Repository Pattern:**
- Абстракция доступа к данным
- Легкая замена источника данных
- Упрощение тестирования

**Unit of Work:**
- Управление транзакциями
- Отслеживание изменений через DbContext

**DTO Pattern:**
- Разделение внутренних моделей и внешних контрактов
- Защита доменной модели
- Оптимизация передачи данных

**Валидация:**
- FluentValidation для входных данных
- Валидация на уровне DTO
- Бизнес-валидация в сервисах

## 6. Интерфейсы взаимодействия

### 6.1 SignalR Service (Electron)

#### Интерфейс ISignalRService
```typescript
interface ISignalRService {
  // Подключение
  connect(serverUrl: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Подписка на события
  onConnectionStatusChanged(callback: (isOnline: boolean) => void): void;
  onError(callback: (error: Error) => void): void;
  
  // Методы для организатора
  joinPartyAsOrganizer(partyId: string, token: string): Promise<void>;
  startSession(partyId: string): Promise<void>;
  endSession(partyId: string): Promise<void>;
  updatePlaybackPosition(partyId: string, trackId: string, position: number): Promise<void>;
  notifyStateChanged(partyId: string): Promise<void>;
  updateFullState(partyId: string, state: PlaybackStateDto): Promise<void>;
}
```

### 6.2 Party Service (Electron)

#### Интерфейс IPartyService
```typescript
interface IPartyService {
  // REST API методы
  createParty(data: CreatePartyDto): Promise<PartyDto>;
  getParties(): Promise<PartyDto[]>;
  getParty(partyId: string): Promise<PartyDto>;
  updateParty(partyId: string, data: UpdatePartyDto): Promise<PartyDto>;
  deleteParty(partyId: string): Promise<void>;
  
  // Аутентификация
  login(email: string, password: string): Promise<AuthResponse>;
  register(email: string, password: string): Promise<AuthResponse>;
  
  // Генерация URL
  getPartyUrl(shortCode: string): string;
}
```

### 6.3 SignalR Service (React)

#### Интерфейс ISignalRService
```typescript
interface ISignalRService {
  // Подключение
  connect(serverUrl: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Подписка на события
  onSessionStarted(callback: (partyId: string) => void): void;
  onSessionEnded(callback: (partyId: string) => void): void;
  onPlaybackPositionUpdated(callback: (partyId: string, trackId: string, position: number) => void): void;
  onStateChanged(callback: (partyId: string) => void): void;
  onFullStateUpdated(callback: (partyId: string, state: PlaybackStateDto) => void): void;
  onConnectionStatusChanged(callback: (partyId: string, isOnline: boolean) => void): void;
  onError(callback: (error: Error) => void): void;
  
  // Методы для зрителей
  joinPartyAsViewer(shortCode: string): Promise<PartyStateDto | null>;
  requestFullState(shortCode: string): Promise<PartyStateDto>;
}
```

### 6.4 Party API Service (React)

#### Интерфейс IPartyApiService
```typescript
interface IPartyApiService {
  getPublicParty(shortCode: string): Promise<PublicPartyDto>;
  getPartyPlaylist(shortCode: string): Promise<PartyPlaylistDto>;
  getPartyState(shortCode: string): Promise<PartyStateDto>;
}
```

## 7. Потоки данных детально

### 7.1 Создание вечеринки

1. **Организатор в приложении:**
   - Открывает PartyView
   - Выбирает стиль и настраивает кастомизацию
   - Нажимает "Создать вечеринку"
   - Приложение собирает текущее состояние `playerItemsStore`
   - Отправляет `CreatePartyDto` на сервер через REST API

2. **Сервер:**
   - Валидирует данные
   - Генерирует уникальный `shortCode`
   - Нормализует структуру плейлиста (треки и группы)
   - Сохраняет в БД
   - Возвращает `PartyDto` с URL

3. **Приложение:**
   - Сохраняет вечеринку в `partyStore`
   - Отображает URL организатору
   - Предоставляет возможность скопировать ссылку

### 7.2 Просмотр вечеринки (до сессии)

1. **Зритель:**
   - Открывает URL вечеринки
   - React приложение извлекает `shortCode` из URL

2. **React приложение:**
   - Запрашивает `GET /api/parties/public/{shortCode}`
   - Получает `PublicPartyDto` и `PartyPlaylistDto`
   - Отображает плейлист используя CherryPlayComponents
   - Применяет выбранный стиль и настройки кастомизации

3. **Отображение:**
   - Показывается только плейлист
   - Нет информации о воспроизведении
   - Статус: "Сессия не начата"

### 7.3 Запуск сессии

1. **Организатор:**
   - В приложении выбирает вечеринку
   - Нажимает "Начать сессию"
   - Приложение подключается к SignalR Hub

2. **Electron:**
   - Вызывает `signalRService.connect(serverUrl, token)`
   - После подключения вызывает `joinPartyAsOrganizer(partyId, token)`
   - Вызывает `startSession(partyId)`
   - Подписывается на изменения Zustand stores:
     - `playerAudioStore` - для состояния воспроизведения
     - `playerSessionStore` - для сессии
     - `playerItemsStore` - для изменений плейлиста

3. **Сервер:**
   - Создает/обновляет `PartySession`
   - Отправляет событие `OnSessionStarted` всем зрителям
   - Начинает принимать обновления от организатора

4. **Зрители:**
   - Получают событие `OnSessionStarted`
   - Запрашивают полное состояние через `requestFullState`
   - Обновляют UI для отображения состояния воспроизведения

### 7.4 Трансляция позиции (каждую секунду)

1. **Electron:**
   - Таймер каждую секунду проверяет `playerAudioStore.position`
   - Если позиция изменилась, вызывает:
     ```typescript
     signalRService.updatePlaybackPosition(
       partyId,
       currentTrackId,
       position
     )
     ```

2. **Сервер:**
   - Получает обновление позиции
   - Обновляет `PartySessions.Position` и `LastUpdatedAt`
   - Транслирует событие `OnPlaybackPositionUpdated` всем зрителям

3. **Зрители:**
   - Получают событие с новой позицией
   - Обновляют UI прогресс-бара и время

### 7.5 Изменение трека/статуса

1. **Electron:**
   - Обнаруживает изменение в `playerAudioStore`:
     - Изменение `currentTrack`
     - Изменение `status`
   - Вызывает `signalRService.notifyStateChanged(partyId)`
   - Затем вызывает `signalRService.updateFullState(partyId, fullState)`

2. **Сервер:**
   - Получает уведомление `NotifyStateChanged`
   - Отправляет событие `OnStateChanged` всем зрителям
   - Получает полное состояние через `UpdateFullState`
   - Обновляет `PartySession` в БД
   - Транслирует событие `OnFullStateUpdated` всем зрителям

3. **Зрители:**
   - Получают событие `OnStateChanged`
   - Вызывают `requestFullState(shortCode)`
   - Получают полное состояние
   - Обновляют UI (текущий трек, статус, список проигранных треков)

### 7.6 Обработка разрыва связи

1. **Обнаружение разрыва:**
   - SignalR Hub автоматически обнаруживает отключение клиента
   - Сервер отправляет событие `OnConnectionStatusChanged(partyId, false)` всем зрителям

2. **Зрители:**
   - Получают событие об отключении
   - Переключают UI в режим "Офлайн"
   - Показывают последнее известное состояние
   - Отображают индикатор "Организатор отключен"

3. **Переподключение:**
   - Electron автоматически пытается переподключиться
   - При успешном переподключении отправляет текущее состояние
   - Сервер отправляет `OnConnectionStatusChanged(partyId, true)`

## 8. Стили и кастомизация

### 8.1 Система изолированных тем

#### Архитектура тем
- Каждая тема является **полностью изолированным модулем** со своими компонентами и стилями
- Темы находятся в `CherryPlayComponents/src/themes/<themeId>/`
- Каждая тема реализует собственные версии компонентов:
  - `PartyDisplay` - главный компонент вечеринки
  - `PlaylistView` - компонент плейлиста (может иметь уникальный дизайн)
  - `PlaylistItem` - компонент элемента плейлиста (может иметь уникальный дизайн)
  - `CurrentTrackDisplay` - компонент отображения текущего трека
- Все темы используют общие утилиты из `core/utils` (форматирование времени, работа с плейлистом)

#### Регистрация тем
- Темы регистрируются в `CherryPlayComponents/src/themes/index.ts` в `THEME_REGISTRY`
- Каждая тема имеет:
  - `id` - уникальный идентификатор темы
  - `name` - отображаемое имя
  - `description` - описание темы
  - `customizationOptions` - список опций кастомизации
  - `components` - ссылки на React компоненты темы

#### Структура темы
```
themes/<themeId>/
├── PartyDisplay.tsx          # Главный компонент темы
├── PlaylistView.tsx          # Компонент плейлиста (уникальный для темы)
├── PlaylistItem.tsx          # Компонент элемента (уникальный для темы)
├── CurrentTrackDisplay.tsx   # Компонент плеера (уникальный для темы)
└── styles/
    ├── index.css             # Главный файл стилей темы
    ├── playlist.css          # Стили плейлиста
    ├── playlist-item.css     # Стили элементов
    └── player.css            # Стили плеера
```

#### CustomizationOption
```typescript
{
  key: string;
  label: string;
  type: 'color' | 'number' | 'string' | 'image' | 'select';
  defaultValue: any;
  options?: { value: any; label: string }[]; // для select
  min?: number; // для number
  max?: number; // для number
}
```

### 8.2 Примеры тем

#### Cyberpunk
- Цветовая схема: неон, темный фон
- Шрифты: моноширинные, футуристические
- Эффекты: свечение, анимации
- Настройки кастомизации: `accentColor`, `glowIntensity`
- Компоненты: имеют неоновый стиль с эффектами свечения

#### Sakura
- Цветовая схема: пастельные тона, розовый/белый
- Шрифты: элегантные, с засечками
- Эффекты: плавные переходы, цветочные элементы
- Настройки кастомизации: `pinkTint`, `backgroundOpacity`
- Компоненты: имеют нежный пастельный дизайн

#### Art-Deco
- Цветовая схема: золотой, черный, белый
- Шрифты: геометрические, стилизованные
- Эффекты: геометрические паттерны, градиенты
- Настройки кастомизации: `goldColor`, `patternStyle`
- Компоненты: имеют элегантный дизайн в стиле ар-деко

### 8.3 Применение тем

1. **В приложении (PartyEditor):**
   - Организатор выбирает тему (`themeId`)
   - Отображаются доступные настройки кастомизации для выбранной темы
   - Превью обновляется в реальном времени
   - Настройки сохраняются в `customizationSettings`

2. **На веб-странице (CherryPlayWeb):**
   - React приложение получает `PartyDisplayData` с `themeId` и `customizationSettings`
   - Использует единый компонент `PartyDisplay` из библиотеки:
     ```typescript
     import { PartyDisplay } from '@cherryplay/components';
     
     <PartyDisplay data={partyDisplayData} />
     ```
   - Фасадный компонент `PartyDisplay` автоматически:
     - Выбирает нужную тему по `themeId` из `THEME_REGISTRY`
     - Преобразует `customizationSettings` в CSS переменные через `useThemeVars`
     - Рендерит компоненты выбранной темы с примененными настройками
   - **Фронт не знает о внутренней реализации тем** - просто передаёт стандартизированные данные

3. **Добавление новой темы:**
   - Создать директорию `CherryPlayComponents/src/themes/<theme-id>/`
   - Реализовать компоненты темы (PartyDisplay, PlaylistView, PlaylistItem, CurrentTrackDisplay)
   - Добавить CSS стили
   - Зарегистрировать тему в `THEME_REGISTRY`
   - Фронт автоматически получит доступ к новой теме через `PartyDisplay`

## 9. Безопасность

### 9.1 Аутентификация организатора

- Использование JWT токенов
- Хеширование паролей (bcrypt/Argon2)
- Токены имеют срок действия
- Refresh токены для обновления сессии

### 9.2 Авторизация

- Только организатор может управлять своими вечеринками
- Проверка владельца при всех операциях изменения
- Публичный доступ только для чтения

### 9.3 Защита от злоупотреблений

- Rate limiting на API endpoints
- Валидация всех входных данных
- Ограничение размера плейлиста (максимум треков)
- Защита от SQL injection через параметризованные запросы

### 9.4 SignalR безопасность

- Аутентификация через JWT в query string или заголовках
- Проверка прав доступа в методах Hub
- Валидация partyId при всех операциях

## 10. Производительность и масштабирование

### 10.1 Оптимизация для 1000+ зрителей

#### На стороне сервера
- Использование групп SignalR для изоляции вечеринок
- Кэширование состояния вечеринки в памяти
- Batch обновления позиции (если необходимо)
- Асинхронная обработка всех операций

#### На стороне клиента
- Дебаунсинг обновлений UI
- Виртуализация списка треков для больших плейлистов
- Ленивая загрузка компонентов
- Оптимизация ре-рендеров через React.memo

### 10.2 Кэширование

- Кэш плейлиста вечеринки (редко меняется)
- Кэш состояния сессии (обновляется часто)
- Инвалидация кэша при изменении данных

### 10.3 Мониторинг

- Логирование всех операций
- Метрики подключений
- Отслеживание производительности запросов
- Алерты при проблемах

## 11. План реализации

### Этап 1: Базовая инфраструктура
1. Создание структуры проектов с соблюдением слоистой архитектуры:
   - Разделение на Api, Core, Infrastructure слои
   - Настройка Dependency Injection
   - Определение интерфейсов в Core
2. Настройка БД с использованием Code First подхода (Entity Framework Core):
   - Создание Entity классов в Core
   - Настройка Fluent API конфигураций в Infrastructure
   - Создание и применение начальных миграций
3. Реализация базовой REST API с применением Clean Code и SOLID принципов:
   - Создание DTOs для входных/выходных данных
   - Реализация сервисов с единой ответственностью
   - Валидация данных на границах слоев
   - Аутентификация и авторизация
4. SignalR Hub с базовыми методами:
   - Разделение логики между Hub и Services
   - Использование интерфейсов для тестируемости

### Этап 2: Electron интеграция
1. UI для создания вечеринок
2. PartyService для REST API
3. SignalR клиент для Electron
4. Подписка на изменения Zustand stores
5. Трансляция состояния

### Этап 3: React веб-приложение
1. Базовая структура проекта
2. Страница просмотра вечеринки
3. SignalR клиент для React
4. Отображение плейлиста (до сессии)

### Этап 4: Библиотека компонентов
1. Базовые компоненты плейлиста
2. Компоненты состояния воспроизведения
3. Система изолированных тем с фасадным компонентом PartyDisplay

### Этап 5: Стили и кастомизация
1. Реализация базовых стилей (Cyberpunk, Sakura)
2. Система кастомизации
3. Превью в приложении

### Этап 6: Оптимизация и полировка
1. Оптимизация производительности
2. Обработка ошибок и edge cases
3. Тестирование под нагрузкой
4. Документация для пользователей

## 12. Дополнительные соображения

### 12.1 Расширяемость

- Система плагинов для новых стилей
- Возможность добавления кастомных компонентов
- API для интеграций

### 12.2 Будущие улучшения

- Статистика просмотров
- Чат для зрителей
- Голосования за треки
- История сессий
- Экспорт данных

### 12.3 Тестирование

**Архитектурные принципы обеспечивают тестируемость:**
- **Dependency Injection** позволяет легко мокировать зависимости
- **Интерфейсы** из Core позволяют создавать тестовые реализации
- **Разделение слоев** упрощает изолированное тестирование

**Типы тестов:**
- **Unit тесты** для бизнес-логики (Services в Core):
  - Мокирование репозиториев через интерфейсы
  - Тестирование одной ответственности
  - Высокое покрытие кода
- **Integration тесты** для API:
  - Тестирование полного потока запросов
  - Использование тестовой БД
  - Проверка валидации и маппинга
- **E2E тесты** для критических сценариев:
  - Полный цикл создания вечеринки
  - Трансляция состояния через SignalR
- **Нагрузочное тестирование SignalR:**
  - Тестирование под нагрузкой 1000+ подключений
  - Проверка производительности обновлений

## 13. Интеграция фасадного компонента PartyDisplay

### 13.1 Использование в CherryPlayWeb

CherryPlayWeb уже использует фасадный компонент `PartyDisplay`:

```typescript
// src/pages/PartyView.tsx
import { PartyDisplay, PartyDisplayData } from '@cherryplay/components';

// Формирование данных
const displayData: PartyDisplayData = {
  partyId: partyId || 'unknown',
  partyName: partyName || 'Плейлист вечеринки',
  themeId: themeId, // 'cyberpunk' | 'sakura' | 'art-deco'
  customizationSettings: customizationSettings,
  playlist: playlist || { items: [], totalDuration: 0, totalTracks: 0 },
  playbackState: playbackState || null,
  isSessionActive: isSessionActive,
};

// Использование
<PartyDisplay data={displayData} showPlayer={!isDemo} />
```

**Важно:** Необходимо импортировать CSS файлы тем в `src/App.tsx`:
```typescript
import '@cherryplay/components/themes/cyberpunk/index.css';
import '@cherryplay/components/themes/sakura/index.css';
import '@cherryplay/components/themes/art-deco/index.css';
```

### 13.2 Использование в CherryPlayList

CherryPlayList использует `PartyDisplay` для превью вечеринок:

```typescript
// src/workspaces/party/PartyPreview.tsx
import { PartyDisplay, PartyDisplayData } from '@cherryplay/components';

const displayData: PartyDisplayData = {
  partyId,
  partyName,
  themeId: styleId, // из настроек вечеринки
  customizationSettings,
  playlist,
  playbackState: playbackState || null,
  isSessionActive: playbackState !== null,
};

<PartyDisplay data={displayData} showPlayer={playbackState !== null} />
```

**Важно:** Необходимо импортировать CSS файлы тем в `src/index.tsx`:
```typescript
import '@cherryplay/components/themes/cyberpunk/index.css';
import '@cherryplay/components/themes/sakura/index.css';
import '@cherryplay/components/themes/art-deco/index.css';
```

### 13.3 Преимущества новой архитектуры

1. **Единая точка входа** - фронт использует только `PartyDisplay`, не зная о внутренней реализации тем
2. **Изоляция тем** - каждая тема может иметь уникальный дизайн всех компонентов (плейлист, треки, плеер)
3. **Простое добавление тем** - для добавления новой темы достаточно создать директорию в `themes/` и зарегистрировать в `THEME_REGISTRY`
4. **Обратная совместимость** - старые компоненты (`PlaylistView`, `CurrentTrackDisplay`) остаются доступными, но помечены как deprecated

### 13.4 Миграция существующего кода

Если в коде используются старые компоненты напрямую:
- `PlaylistView` → использовать `PartyDisplay` с `PartyDisplayData`
- `CurrentTrackDisplay` → использовать `PartyDisplay` с `PartyDisplayData`

Старые компоненты остаются доступными для кастомных композиций, но для стандартного использования рекомендуется `PartyDisplay`.

---

*Документация создана: 2024*
*Версия: 1.1 (обновлено: добавлена архитектура изолированных тем)*

