# Страницы и маршрутизация CherryPlayWeb

Описание страниц веб-приложения для зрителей и используемых API/SignalR. Контракты см. в [CONTRACTS.md](../../CONTRACTS.md).

---

## Текущая реализация

Маршрутизация выполняется через **React Router** с path-based маршрутами. Константы путей — в `src/constants/routes.ts`.

| Путь | Страница | Компонент |
|------|---------|-----------|
| `/` | Каталог вечеринок (или редирект с `?party=...`) | `PartyListPage` / `CatalogOrRedirect` |
| `/party/:shortCode` | Просмотр вечеринки (плейлист + состояние) | `PartyView` |
| `/party/:shortCode/info` | Информация о вечеринке | `PartyInfoPage` |
| `/login` | Вход | `LoginPage` |
| `/register` | Регистрация | `RegisterPage` |
| `/cabinet` | Кабинет организатора | `CabinetPage` |

- **PartyListPage**: список вечеринок; при выборе вечеринки переход по `ROUTES.PARTY_VIEW(shortCode)`.
- **PartyView**: отображение плейлиста и состояния воспроизведения; кнопка «Назад» — `navigate(ROUTES.HOME)`.
- **PartyInfoPage**: описание, место, дата; ссылки на плейлист и каталог через `ROUTES`. Отображение страницы и ссылок на неё можно отключить конфигом сервера: `Features:PartyInfoPageEnabled` (значение в ответе `GET /api/config` — поле `partyInfoPageEnabled`); при `false` страница и пункты «Информация»/«Подробнее» скрыты, переход по `/party/:shortCode/info` редиректит на просмотр вечеринки. Подробнее: [CONTRACTS.md](../../CONTRACTS.md) §2.2, [CherryPlayServer/OPS.md](../../CherryPlayServer/OPS.md).

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

- `src/constants/routes.ts` — константы маршрутов.
- `src/constants/themes.ts` — список PartyTheme из CherryPlayComponents (для каталога и кабинета). См. [GLOSSARY.md](../../GLOSSARY.md).
- `src/pages/PartyListPage.tsx` — каталог/список.
- `src/pages/PartyView.tsx` — просмотр вечеринки по shortCode.
- `src/pages/PartyInfoPage.tsx` — информация о вечеринке.
- `src/pages/CabinetPage.tsx`, `CabinetPartyForm.tsx`, `CabinetPartyList.tsx` — кабинет организатора.
- `src/services/partyApiService.ts` — вызовы REST API.
- `src/services/signalRService.ts` — подключение к Hub и обработка событий.
- `src/hooks/usePartyState.ts`, `useSignalR.ts` — состояние вечеринки и SignalR.
- `src/utils/playbackState.ts` — мерж позиции воспроизведения (requestFullState / OnFullStateUpdated).
- `src/utils/logger.ts` — логи только в DEV (`devLog`, `devWarn`).
- `src/components/` — LoadingSpinner, ErrorMessage, ConnectionStatus и др.

Типы API (DTO) — в `src/types/api.ts`.
