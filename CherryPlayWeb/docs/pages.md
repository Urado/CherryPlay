# Страницы и маршрутизация CherryPlayWeb

Описание страниц веб-приложения для зрителей и используемых API/SignalR. Контракты см. в [CONTRACTS.md](../../CONTRACTS.md).

---

## Текущая реализация

Маршрутизация выполняется через **React Router** с path-based маршрутами. Константы путей — в `src/constants/routes.ts`.

| Путь | Страница | Компонент |
|------|---------|-----------|
| `/` | Каталог вечеринок (или редирект с `?party=...`) | `PartyListPage` / `CatalogOrRedirect` |
| `/download` | Загрузка CherryPlay для Windows | `DownloadPage` |
| `/guide/first-run` | Первый запуск CherryPlayList | `FirstRunGuidePage` |
| `/first-run-guide.html` | Совместимый адрес инструкции | Перенаправление на `/guide/first-run`; при открытии локального HTML-файла сохраняется офлайн-страница |
| `/feedback` | Обратная связь, email поддержки и прямая ссылка на сообщения ВКонтакте | `FeedbackPage` |
| `/party/:shortCode` | Просмотр вечеринки (плейлист + состояние) | `PartyView` |
| `/party/:shortCode/info` | Информация о вечеринке | `PartyInfoPage` |
| `/party/:shortCode/qr` | QR-код для открытия вечеринки и скачивания PNG | `PartyQrPage` |
| `/login` | Вход | `LoginPage` |
| `/register` | Регистрация организатора (email + consents) | `RegisterPage` |
| `/oauth/complete` | Завершение входа через OAuth или desktop callback | `OAuthCompletePage` |
| `/forgot-password` | Запрос сброса пароля (письмо) | `ForgotPasswordPage` |
| `/reset-password` | Новый пароль по `?token=` из письма | `ResetPasswordPage` |
| `/cabinet` | Кабинет организатора (в т.ч. смена пароля) | `CabinetPage` |
| `/admin` | Корневой админ-маршрут (redirect) | `Navigate -> /admin/organizers` |
| `/admin/organizers` | Список организаторов (admin only) | `AdminOrganizersPage` |
| `/admin/organizers/:id` | Детальная карточка организатора (admin only) | `AdminOrganizerDetailPage` |
| `/privacy` | Политика ПДн | `LegalDocumentPage` (`privacy`) |
| `/privacy/v/:version` | Архив версии политики | `LegalDocumentPage` |
| `/consent` | Согласие на обработку ПДн | `LegalDocumentPage` (`consent`) |
| `/consent/v/:version` | Архив версии согласия | `LegalDocumentPage` |
| `/terms` | Пользовательское соглашение | `LegalDocumentPage` (`terms`) |
| `/terms/v/:version` | Архив версии terms | `LegalDocumentPage` |
| `/cookies` | Политика cookie | `LegalDocumentPage` (`cookies`) |
| `/cookies/v/:version` | Архив версии cookies | `LegalDocumentPage` |
| `/legal` | Реквизиты / оператор | `LegalOperatorPage` |

- **PartyListPage**: список вечеринок; при выборе вечеринки переход по `ROUTES.PARTY_VIEW(shortCode)`.
## Страница загрузки приложения

**DownloadPage**: ссылка «Скачать приложение» в каталоге открывает эту страницу. Она запрашивает публичный GitHub Releases API для `Urado/CherryPlay`, отбирает опубликованные prerelease с тегом строго в формате `player-vX.Y.Z` (три числовых компонента без prerelease-суффикса) и ZIP с точно совпадающим именем `CherryPlayList-X.Y.Z-x64.zip`. Среди подходящих релизов выбирается наибольшая SemVer-версия. Страница показывает версию из тега и ведёт непосредственно на проверенный `browser_download_url` GitHub asset, не на страницу релиза. Запрос, включая получение и разбор JSON, ограничен 10 секундами. При сетевой/HTTP-ошибке, неверном ответе GitHub или отсутствии подходящего релиза пользователю показывается ошибка. Desktop использует те же правила отбора и сравнения для мягкого уведомления. Поведение описано в [DEPLOYMENT.md](../../.github/DEPLOYMENT.md).

Каталог, download, first-run guide, feedback, вход, регистрация, OAuth callback, восстановление/сброс пароля, кабинет, admin и юридические страницы используют общий `SiteLayout` с `SiteHeader` и `SiteFooter`. Шапка показывает ссылку на вход или кабинет после проверки сессии; пункт администрирования в ней не отображается. `/admin` маршруты сохраняют `useRequireAdmin()` и серверную проверку роли. Скрытие ссылки в навигации не является границей безопасности. Общая оболочка задаёт viewport и фон shell; короткие страницы растягивают содержимое до футера, а длинные прокручиваются естественно. Маршруты просмотра вечеринки и информации о ней остаются вне `SiteLayout`, чтобы сохранить независимую оболочку PartyTheme.

На download-странице инструкция открывается по React-маршруту `/guide/first-run`. Адрес `/first-run-guide.html` оставлен для исторических ссылок: браузер перенаправляется на React-маршрут, а локальный HTML-файл в Windows ZIP остаётся доступен офлайн. `FirstRunGuidePage` содержит инструкцию из этого файла; исходная инструкция не содержит изображений.

Для CP-087 ZIP собирается CI без AIMP bridge; его наличие не является условием для отображения загрузки.

- **PartyView**: отображение плейлиста и состояния воспроизведения; «Назад» ведёт на `ROUTES.HOME` обычной ссылкой. Кнопка «QR-код» рядом с «Назад» открывает `/party/:shortCode/qr`.
- **PartyQrPage**: загружает публичные данные вечеринки, применяет её PartyTheme и показывает QR-код, ведущий на страницу этой вечеринки. Рендер и скачивание PNG выполняет `qr-code-styling`; quiet margin задан как 64 пикселя изображения, уровень коррекции ошибок — H. В центре QR-кода темы «Весенний кросс-степ» используется её постер; у остальных тем центр заполнен цветом фона QR. Во время генерации индикатор загрузки накладывается поверх квадратной области предпросмотра; область сразу занимает размеры готового предпросмотра и не схлопывается при ожидании QR-кода. Библиотека скрывает точки QR-кода под центральным изображением.
- **PartyInfoPage**: описание, место, дата; ссылки на плейлист и каталог через `ROUTES`. Отображение страницы и ссылок на неё можно отключить конфигом сервера: `Features:PartyInfoPageEnabled` (значение в ответе `GET /api/config` — поле `partyInfoPageEnabled`); при `false` страница и пункты «Информация»/«Подробнее» скрыты, переход по `/party/:shortCode/info` редиректит на просмотр вечеринки. Подробнее: [CONTRACTS.md](../../CONTRACTS.md) §2.2, [CherryPlayServer/OPS.md](../../CherryPlayServer/OPS.md).
- **Admin страницы**: используют `useRequireAdmin()`; неавторизованный пользователь редиректится на `/login`, не-admin — на `/cabinet` с сообщением об ошибке доступа.
- **RegisterPage:** `EmailAuthForm` mode `register` + legal checkboxes; API — `POST /api/organizers` (+ consents) → `POST /auth/login` ([accounts-and-auth.md](../../docs/integration/accounts-and-auth.md), [CONTRACTS.md](../../CONTRACTS.md) §3.2.3). При `?client=desktop` — **replace-redirect** на `/login?client=desktop` (сохраняет `return_to` / `next`); отдельной desktop-регистрации на `/register` нет.
- **LoginPage / ConsentGate:** после auth (и до desktop deep-link) — `ensureConsents()`; при missing grants — глобальная модалка `ConsentGateProvider` (`LegalConsentBlock` → `POST /api/consent-events`). Session-continue (`client=desktop`) остаётся вариантом LoginPage; общий header/footer предоставляет `SiteLayout`. Cookie-notice скрыт, пока gate open. Контракт: [CONTRACTS.md](../../CONTRACTS.md) §3.2.3.
- **LegalDocumentPage / LegalOperatorPage:** тексты из `src/content/legal/` (folder `v1.0`, label `documentVersion` `1.0`); архивы `/…/v/:version`. Ссылки из footer / consent UI. Deploy-time id+hash для API — в Components; серверный seed — см. GLOSSARY / CONTRACTS §3.2.3.
- **ForgotPasswordPage / ResetPasswordPage**: self-service сброс пароля (письмо → токен); контракты и политика почты — [accounts-and-auth.md](../../docs/integration/accounts-and-auth.md), [CONTRACTS.md](../../CONTRACTS.md) §3.2.0a. После успешного reset — редирект на `/login`. Смена пароля (старый + новый) — в кабинете (`CabinetPage`, аккордеон «Аккаунт»), не отдельный маршрут; после успеха клиент разлогинивает и открывает `/login` с notice (см. ниже).

---

## Используемые API и SignalR

### PartyListPage

- **GET** `/api/parties/public/list` — список вечеринок каталога (`PublicPartyListItemDto[]`).
- Карточка вечеринки отображает 6 полей по порядку: название, краткое описание, город, дата/время, теги танцев, внешняя ссылка. Тема, количество треков, длительность, shortCode, кнопка «Подробнее» и бейдж «В эфире» на карточке не показываются.
- Переход по карточке — ссылка на `ROUTES.PARTY_VIEW(shortCode)`, поэтому её можно открыть в новой вкладке стандартным действием браузера; внешняя ссылка карточки остаётся отдельной.
- Отображение даты/времени на карточке — одной комбинированной строкой на основе `eventDateTime`/`eventEndDateTime` и `timeZone` из `PublicPartyListItemDto`.
- Заголовок страницы каталога «Вечеринки» оформлен однотонным белым цветом из палитры темы (тот же базовый цвет текста, что и на карточках); градиенты и альтернативные цвета для этого заголовка не используются, чтобы сохранить читаемость и визуальное единство списка.
- Для демо-режима: **GET** `/api/parties/public/first` — первый доступный плейлист.

### PartyView (страница вечеринки по shortCode)

- **GET** `/api/parties/public/{shortCode}` — метаданные вечеринки (`PublicPartyDto`).
- **GET** `/api/parties/public/{shortCode}/playlist` — плейлист (`PartyPlaylistDto`).
- При наличии эндпоинта состояния: **GET** `/api/parties/public/{shortCode}/state` — сохранённое состояние (если реализовано на сервере).
- **SignalR** `partyHub`:
  - **invoke:** `JoinPartyAsViewer(shortCode)` или `JoinPartyAsViewerWithState(shortCode)` — подключение к группе и при необходимости получение полного состояния; при restore — `RequestFullState`.
  - **on:** `OnSessionStarted`, `OnSessionEnded`, `OnConnectionStatusChanged`, `OnFullStateUpdated`, `OnPlaybackPositionUpdated`, `OnStateChanged`, `OnPlaylistChanged`, `Error`.

**Freeze / now-playing** (CONTRACTS §4, [streaming.md](../../docs/integration/streaming.md), `src/utils/partyViewReconnect.ts`):

- **Обрыв организатора** (`OnConnectionStatusChanged(false)` / grace → `organizer_offline`): now-playing **удерживается ~60 с** (`DISCONNECT_FREEZE_MS`), затем скрывается; плейлист и пометки проигранных остаются.
- **`server_unreachable`** (зритель потерял API/hub): блок «сейчас играет» **скрывается сразу** (даже если organizer-offline freeze ещё активен); плейлист и пометки остаются.
- **Restore:** `OnConnectionStatusChanged(true)` сбрасывает freeze-таймер и запрашивает full state; также сброс при `OnSessionStarted` / `RequestFullState`. Плейлист из full state — только из **`PartyStateDto`** (`RequestFullState` / `JoinPartyAsViewerWithState`); `OnFullStateUpdated` несёт `PlaybackStateDto` (playback, без playlist).

### CabinetPage / CabinetPartyForm

- Структура: общая шапка сайта → профиль → два управляемых блока. «Мои вечеринки» остаётся нативным `<details>`; «Аккаунт» использует общий `Disclosure`.
- **Мои вечеринки** — открыт по умолчанию (`partiesOpen`, React-controlled через `open` + `onToggle`). CTA «Создать вечеринку» в summary: `preventDefault` / `stopPropagation` + `setPartiesOpen(true)`, чтобы не закрывать панель и при необходимости открыть её.
- **Аккаунт** — controlled `Disclosure` (`accountOpen`); свёрнут по умолчанию. Hash `#account` открывает панель и скроллит к ней (`location.hash === '#account'`). В теле — `ChangePasswordForm` (`layout="embedded"`) и блок **Конфиденциальность**.
- **Конфиденциальность:** ссылка на реквизиты + `PRIVACY_CONTACT_EMAIL` (`VITE_PRIVACY_CONTACT` или default из legal/operator). Список последних решений по required consents (`GET /api/consent-events`); кнопка «Отозвать активные согласия» → `POST /api/consent-events` (withdraw). При недоступном журнале — muted hint (отзыв через privacy-канал).
- **Удаление аккаунта:** двухшаговое подтверждение → `deleteOrganizerAccount()` (`DELETE /api/organizer/account`) → `clearThemeAccessCache()` → `authService.logout()` → `navigate(/login, { replace: true, state: { accountDeleted: true } })`. `LoginPage` показывает «Аккаунт удалён. Вход с прежними данными больше невозможен.» и сбрасывает `state` из history. Cookie сам DELETE не чистит.
- **API смена пароля:** `POST /auth/change-password` → **204** (без тела); затем клиент обязан повторно войти (все сессии инвалидированы). Контракт: [CONTRACTS.md](../../CONTRACTS.md) §3.2.0a. Удаление аккаунта: [CONTRACTS.md](../../CONTRACTS.md) §3.3.
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
- `src/pages/LegalDocumentPage.tsx`, `LegalOperatorPage.tsx` — legal routes; контент — `src/content/legal/`.
- `src/pages/CabinetPage.tsx`, `CabinetPartyForm.tsx`, `CabinetPartyList.tsx` — кабинет организатора с переключаемыми разделами «Вечеринки» / «Аккаунт»; смена пароля, privacy/withdraw и удаление аккаунта находятся в `#account`.
- `src/services/accountApiService.ts` — `deleteOrganizerAccount` (`DELETE /api/organizer/account`).
- `src/constants/legalContacts.ts` — `PRIVACY_CONTACT_EMAIL` / `SUPPORT_CONTACT_EMAIL` (`VITE_PRIVACY_CONTACT`, `VITE_SUPPORT_CONTACT`).
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
