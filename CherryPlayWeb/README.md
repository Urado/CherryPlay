# CherryPlay Web

Веб-приложение для просмотра плейлистов вечеринок в реальном времени.

## Структура проекта

```
CherryPlayWeb/
├── src/
│   ├── pages/
│   │   └── PartyView.tsx          # Страница просмотра вечеринки
│   ├── components/
│   │   ├── LoadingSpinner.tsx      # Индикатор загрузки
│   │   └── ErrorMessage.tsx        # Компонент ошибки
│   ├── services/
│   │   └── partyApiService.ts      # Сервис для работы с API
│   ├── types/
│   │   └── api.ts                  # Типы для API запросов/ответов
│   ├── App.tsx                     # Главный компонент
│   └── main.tsx                    # Точка входа
```

## Установка

```bash
npm install
```

## Запуск

```bash
npm run dev
```

Приложение будет доступно по адресу http://localhost:3000

## Настройка

По умолчанию приложение подключается к серверу на `http://localhost:5000`. Можно изменить через переменную окружения **`VITE_API_URL`** в файле `.env` или `.env.development` в **корне репозитория** (Vite читает env из корня). Полный список переменных — в корневом [ENV.md](../ENV.md).

## CSS contract для `@cherryplay/components`

**Порядок импорта** в `src/main.tsx` (важен для каскада):

1. `@cherryplay/components/styles/primitives.css` — shell palette и стили примитивов
2. `./index.css` — локальные переопределения (`--accent-primary: #00ff88` и др.)

Пример:

```ts
import '@cherryplay/components/styles/primitives.css';
import './index.css';
```

- `primitives.css` подключает базовые токены и классы примитивов (`cp-button`, `cp-button--icon-only`, `cp-disclosure`, `cp-icon`) и shell palette из пакета компонентов.
- **Дефолтные кнопки shell:** `Button` / `ButtonLink` / `IconButton` из пакета уже стилизованы (пакетный primary `#667eea`; в Web переопределён на `#00ff88` через `index.css`). Варианты `primary`/`secondary`/`danger`/`ghost`. Кастомный CSS на каждую кнопку не нужен. Контент `PartyDisplay` в PartyTheme на этот контракт **не распространяется** — см. [CherryPlayComponents/README.md](../CherryPlayComponents/README.md#default-shell-buttons).
- Локальные стили приложения должны переопределять примитивы только **после** импорта `primitives.css`.
- Если импорт убрать, shared-кнопки и иконки рендерятся без ожидаемого внешнего вида и без корректных токенов палитры.

## Продакшен через Docker и Nginx

В продакшене веб-приложение собирается и упаковывается в Docker-образ `CherryPlayWeb`, который использует Nginx для раздачи статики и проксирования запросов:

- Конфиг Nginx внутри контейнера: `CherryPlayWeb/nginx.conf`.
- Этот Nginx:
  - отдаёт SPA по `location /` (`index.html` и статику);
  - проксирует `location /api` и `location /auth` на backend-сервис `server:8080`;
  - проксирует `location /partyHub` (SignalR Hub) на `server:8080`.

На боевом сервере перед контейнером `web` стоит ещё один Nginx на хосте (см. `.github/nginx-cherryplay-https.conf` и `.github/DEPLOYMENT.md`), который:

- принимает HTTP/HTTPS на 80/443;
- делает редирект HTTP → HTTPS;
- терминирует TLS и проксирует весь трафик на контейнер `web` (порт 8080).

Итого: браузер всегда ходит только на домен (например, `https://cherrypashkaparty.ru`), а маршрутизация к backend (`/api`, `/auth`, `/partyHub`) настроена в Nginx внутри `CherryPlayWeb` и в хостовом Nginx.

## Демо-режим

По умолчанию приложение работает в демо-режиме и показывает первый доступный плейлист с сервера.

## API Endpoints

Приложение использует следующие эндпоинты:

- `GET /api/parties/public/first` - получение первого плейлиста (демо)
- `GET /api/parties/public/{shortCode}/playlist` - получение плейлиста по коду
- `GET /api/parties/public/{shortCode}` - получение информации о вечеринке
- `GET /api/parties/public/{shortCode}/state` - получение состояния вечеринки

## Документация

- [ENV.md](../ENV.md) (в корне репозитория) — переменные окружения (VITE_API_URL и др.)
- [docs/pages.md](docs/pages.md) — страницы и маршрутизация, используемые API и SignalR

## Используемые библиотеки

- **React** — UI библиотека
- **TypeScript** — типизация
- **Vite** — сборщик
- **@cherryplay/components** — общие компоненты для плейлистов
- **@microsoft/signalr** — интеграция с SignalR Hub
