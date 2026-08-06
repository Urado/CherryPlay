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
| `/forgot-password` | Запрос сброса пароля (письмо) | `ForgotPasswordPage` |
| `/reset-password` | Новый пароль по `?token=` из письма | `ResetPasswordPage` |
| `/cabinet` | Кабинет организатора (в т.ч. смена пароля) | `CabinetPage` |
| `/admin` | Корневой админ-маршрут (redirect) | `Navigate -> /admin/organizers` |
| `/admin/organizers` | Список организаторов (admin only) | `AdminOrganizersPage` |
| `/admin/organizers/:id` | Детальная карточка организатора (admin only) | `AdminOrganizerDetailPage` |

- **PartyListPage**: список вечеринок; при выборе вечеринки переход по `ROUTES.PARTY_VIEW(shortCode)`.
- **PartyView**: отображение плейлиста и состояния воспроизведения; кнопка «Назад» — `navigate(ROUTES.HOME)`.
- **PartyInfoPage**: описание, место, дата; ссылки на плейлист и каталог через `ROUTES`. Отображение страницы и ссылок на неё можно отключить конфигом сервера: `Features:PartyInfoPageEnabled` (значение в ответе `GET /api/config` — поле `partyInfoPageEnabled`); при `false` страница и пункты «Информация»/«Подробнее» скрыты, переход по `/party/:shortCode/info` редиректит на просмотр вечеринки. Подробнее: [CONTRACTS.md](../../CONTRACTS.md) §2.2, [CherryPlayServer/OPS.md](../../CherryPlayServer/OPS.md).
- **Admin страницы**: используют `useRequireAdmin()`; неавторизованный пользователь редиректится на `/login`, не-admin — на `/cabinet` с сообщением об ошибке доступа.
- **ForgotPasswordPage / ResetPasswordPage**: self-service сброс пароля (письмо → токен); контракты и политика почты — [accounts-and-auth.md](../../docs/integration/accounts-and-auth.md), [CONTRACTS.md](../../CONTRACTS.md) §3.2.0a. После успешного reset — редирект на `/login`. Смена пароля (старый + новый) — в кабинете (`CabinetPage`, аккордеон «Аккаунт»), не отдельный маршрут; после успеха клиент разлогинивает и открывает `/login` с notice (см. ниже).

---

## Используемые API и SignalR

### PartyListPage

- **GET** `/api/parties/public/list` — список вечеринок каталога (`PublicPartyListItemDto[]`).
- Карточка вечеринки отображает 6 полей по порядку: название, краткое описание, город, дата/время, теги танцев, внешняя ссылка. Тема, количество треков, длительность, shortCode, кнопка «Подробнее» и бейдж «В эфире» на карточке не показываются.
- Отображение даты/времени на карточке — одной комбинированной строкой на основе `eventDateTime`/`eventEndDateTime` и `timeZone` из `PublicPartyListItemDto`.
- Заголовок страницы каталога «Вечеринки» оформлен однотонным белым цветом из палитры темы (тот же базовый цвет текста, что и на карточках); градиенты и альтернативные цвета для этого заголовка не используются, чтобы сохранить читаемость и визуальное единство списка.
- Для демо-режима: **GET** `/api/parties/public/first` — первый доступный плейлист.

### PartyView (страница вечеринки по shortCode)

- **GET** `/api/parties/public/{shortCode}` — метаданные вечеринки (`PublicPartyDto`).
- **GET** `/api/parties/public/{shortCode}/playlist` — плейлист (`PartyPlaylistDto`).
- При наличии эндпоинта состояния: **GET** `/api/parties/public/{shortCode}/state` — сохранённое состояние (если реализовано на сервере).
- **SignalR** `partyHub`:
  - **invoke:** `JoinPartyAsViewer(shortCode)` или `JoinPartyAsViewerWithState(shortCode)` — подключение к группе и при необходимости получение полного состояния.
  - **on:** `OnSessionStarted`, `OnSessionEnded`, `OnFullStateUpdated`, `OnPlaybackPositionUpdated`, `OnStateChanged`, `OnPlaylistChanged`, `Error`.

При потере связи (freeze): блок «сейчас играет» скрывается; плейлист и пометки проигранных остаются (данные уже получены через API/SignalR).

### CabinetPage / CabinetPartyForm

- Структура: шапка → профиль → два аккордеона на общих классах `.cabinet-accordion` / `.cabinet-accordion-summary` / `.cabinet-accordion-body` (`<details>`).
- **Мои вечеринки** — открыт по умолчанию (`partiesOpen`, React-controlled через `open` + `onToggle`). CTA «Создать вечеринку» в summary: `preventDefault` / `stopPropagation` + `setPartiesOpen(true)`, чтобы не закрывать панель и при необходимости открыть её.
- **Аккаунт** — неконтролируемый `<details>`, свёрнут по умолчанию. В теле — `ChangePasswordForm` с `layout="embedded"` (без вложенного details).
- **API:** `POST /auth/change-password` → **204** (без тела); затем клиент обязан повторно войти (все сессии инвалидированы). Контракт: [CONTRACTS.md](../../CONTRACTS.md) §3.2.0a.
- Смена пароля: shared-форма вызывает эндпоинт выше. После успеха: `clearThemeAccessCache()` → `authService.logout()` → `navigate(/login, { replace: true, state: { passwordChanged: true } })`. `LoginPage` показывает «Пароль успешно изменён. Войдите с новым паролем.» и сбрасывает `state` из history.
- **GET** `/api/organizer/me/theme-access` — получение доступных тем, locked-плиток и `contactUrl`.
- При выборе темы в форме:
  - доступные темы выбираются напрямую;
  - locked-темы (`visibleLockedThemes`) показываются с замком и CTA к `contactUrl`;
  - приватные недоступные темы не отображаются.

### AdminOrganizersPage

- **GET** `/api/admin/organizers?query=&page=&pageSize=` — список организаторов, поиск, пагинация.
- Переход на `/admin/organizers/:id` выполняется по ссылке в имени организатора (не по клику по всей строке).

### AdminOrganizerDetailPage

- **GET** `/api/admin/organizers/{id}` — профиль, OAuth-аккаунты, история entitlements.
- **GET** `/api/admin/theme-packages` — список пакетов для формы grant.
- **POST** `/api/admin/organizers/{id}/entitlements` — выдача пакета.
- **DELETE** `/api/admin/organizers/{id}/entitlements/{entitlementId}` — отзыв выдачи.
- Ошибки grant/revoke обрабатываются как структурированные API-ошибки (`{ code, message/detail/error }`) с маппингом кодов (`entitlement_already_active`, `entitlement_already_revoked`, `package_is_auto_granted`, `organizer_not_found`, `package_not_found`, `entitlement_not_found`) в пользовательские сообщения без падения UI.

---

## Структура файлов (кратко)

- `src/constants/routes.ts` — константы маршрутов.
- `src/constants/themes.ts` — список PartyTheme из CherryPlayComponents (для каталога и кабинета). См. [GLOSSARY.md](../../GLOSSARY.md).
- `src/pages/PartyListPage.tsx` — каталог/список.
- `src/pages/PartyView.tsx` — просмотр вечеринки по shortCode.
- `src/pages/PartyInfoPage.tsx` — информация о вечеринке.
- `src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx` — auth-страницы организатора.
- `src/pages/CabinetPage.tsx`, `CabinetPartyForm.tsx`, `CabinetPartyList.tsx` — кабинет организатора (аккордеоны «Мои вечеринки» / «Аккаунт»; смена пароля — в «Аккаунт»).
- `src/pages/admin/AdminOrganizersPage.tsx`, `src/pages/admin/AdminOrganizerDetailPage.tsx` — админ-раздел.
- `src/services/partyApiService.ts` — вызовы REST API.
- `src/services/adminApiService.ts`, `src/services/themeAccessService.ts` — admin и theme-access API.
- `src/hooks/useRequireAdmin.ts`, `src/hooks/useThemeAccess.ts` — role guard и загрузка theme-access.
- `src/services/signalRService.ts` — подключение к Hub и обработка событий.
- `src/hooks/usePartyState.ts`, `useSignalR.ts` — состояние вечеринки и SignalR.
- `src/utils/playbackState.ts` — мерж позиции воспроизведения (requestFullState / OnFullStateUpdated).
- `src/utils/logger.ts` — логи только в DEV (`devLog`, `devWarn`).
- `src/components/` — LoadingSpinner, ErrorMessage, ConnectionStatus и др.

Типы API (DTO) — в `src/types/api.ts`.
