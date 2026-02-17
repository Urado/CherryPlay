# Страницы и маршрутизация CherryPlayWeb

Описание страниц веб-приложения для зрителей и используемых API/SignalR. Контракты см. в [CONTRACTS.md](../../CONTRACTS.md).

---

## Текущая реализация

Маршрутизация выполняется без React Router: по **query-параметру** `party` определяется, показывать ли страницу вечеринки или список.

| Условие | Страница | Компонент |
|---------|----------|-----------|
| Нет `?party=...` в URL | Список вечеринок (каталог / демо) | `PartyListPage` |
| Есть `?party={shortCode}` | Просмотр вечеринки (плейлист + состояние) | `PartyView` |

- **PartyListPage** (`src/pages/PartyListPage.tsx`): список вечеринок; при выборе вечеринки в URL подставляется `party=shortCode` через `history.pushState`.
- **PartyView** (`src/pages/PartyView.tsx`): отображение плейлиста и текущего состояния воспроизведения; кнопка «Назад» сбрасывает `party` и возвращает к списку.

---

## Целевые маршруты по плану v1

По [RELEASE_PLAN.md](../../RELEASE_PLAN.md) и [CONTRACTS.md](../../CONTRACTS.md):

| Путь | Описание |
|------|----------|
| `/` или аналог | Каталог вечеринок (список из GET `/api/parties/public/list`). |
| `party/<shortCode>` | Просмотр плейлиста и состояния сессии; данные по shortCode через REST и SignalR. |
| `party/<shortCode>/info` | Информация о вечеринке: описание, место, город, дата, расписание, ссылки (поля из PublicPartyDto и метаданных). |

Переход на path-based маршруты (`party/<shortCode>`, `party/<shortCode>/info`) планируется в рамках развития приложения; при этом контракты API остаются теми же (идентификатор — shortCode).

---

## Используемые API и SignalR

### PartyListPage

- **GET** `/api/parties/public/list` — список вечеринок каталога (`PublicPartyListItemDto[]`).
- Для демо-режима: **GET** `/api/parties/public/first` — первый доступный плейлист.

### PartyView (страница вечеринки по shortCode)

- **GET** `/api/parties/public/{shortCode}` — метаданные вечеринки (`PublicPartyDto`).
- **GET** `/api/parties/public/{shortCode}/playlist` — плейлист (`PartyPlaylistDto`).
- При наличии эндпоинта состояния: **GET** `/api/parties/public/{shortCode}/state` — сохранённое состояние (если реализовано на сервере).
- **SignalR** `partyHub`:
  - **invoke:** `JoinPartyAsViewer(shortCode)` или `JoinPartyAsViewerWithState(shortCode)` — подключение к группе и при необходимости получение полного состояния.
  - **on:** `OnSessionStarted`, `OnSessionEnded`, `OnFullStateUpdated`, `OnPlaybackPositionUpdated`, `OnStateChanged`, `OnPlaylistChanged`, `Error`.

При потере связи (freeze): блок «сейчас играет» скрывается; плейлист и пометки проигранных остаются (данные уже получены через API/SignalR).

---

## Структура файлов (кратко)

- `src/pages/PartyListPage.tsx` — каталог/список.
- `src/pages/PartyView.tsx` — просмотр вечеринки по shortCode.
- `src/services/partyApiService.ts` — вызовы REST API.
- `src/services/signalRService.ts` — подключение к Hub и обработка событий.
- `src/hooks/usePartyState.ts`, `useSignalR.ts` — состояние вечеринки и SignalR.
- `src/components/` — LoadingSpinner, ErrorMessage, ConnectionStatus и др.

Типы API (DTO) — в `src/types/api.ts`.
