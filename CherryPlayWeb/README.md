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

По умолчанию приложение подключается к серверу на `http://localhost:5000`. Можно изменить через переменную окружения **`VITE_API_URL`** (например, в файле `.env` в корне проекта: `VITE_API_URL=http://localhost:5000`). Полный список переменных окружения см. в [ENV.md](ENV.md).

## Демо-режим

По умолчанию приложение работает в демо-режиме и показывает первый доступный плейлист с сервера.

## API Endpoints

Приложение использует следующие эндпоинты:

- `GET /api/parties/public/first` - получение первого плейлиста (демо)
- `GET /api/parties/public/{shortCode}/playlist` - получение плейлиста по коду
- `GET /api/parties/public/{shortCode}` - получение информации о вечеринке
- `GET /api/parties/public/{shortCode}/state` - получение состояния вечеринки

## Документация

- [ENV.md](ENV.md) — переменные окружения (VITE_API_URL и др.)
- [docs/pages.md](docs/pages.md) — страницы и маршрутизация, используемые API и SignalR

## Используемые библиотеки

- **React** — UI библиотека
- **TypeScript** — типизация
- **Vite** — сборщик
- **@cherryplay/components** — общие компоненты для плейлистов
- **@microsoft/signalr** — интеграция с SignalR Hub
