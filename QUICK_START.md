# Быстрый старт

## Быстрый запуск всех сервисов

Используйте скрипты для автоматического запуска всех сервисов:

```bash
# PowerShell
.\start-all.ps1

# CMD
start-all.bat
```

Скрипт автоматически:
- Проверяет наличие необходимых инструментов (.NET SDK, Node.js)
- Устанавливает зависимости при необходимости
- Запускает сервер и веб-приложение в отдельных окнах

**Результат:**
- Сервер: http://localhost:5000
- Веб-приложение: http://localhost:3000

## Ручной запуск

### Запуск сервера (CherryPlayServer)

1. Перейдите в папку `CherryPlayServer`
2. Установите зависимости (если нужно):
   ```bash
   dotnet restore
   ```
3. Запустите сервер:
   ```bash
   dotnet run
   ```

Сервер будет доступен по адресу: http://localhost:5000

## Запуск веб-приложения (CherryPlayWeb)

1. Перейдите в папку `CherryPlayWeb`
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Запустите приложение:
   ```bash
   npm run dev
   ```

Веб-приложение будет доступно по адресу: http://localhost:3000

## Что делает приложение

- **Сервер** предоставляет REST API для получения плейлистов и SignalR Hub для трансляции состояния
- **Веб-приложение** отображает первый доступный плейлист на главной странице

## API Endpoints

- `GET /api/parties/public/first` - получить первый плейлист
- `GET /api/parties/public/{shortCode}/playlist` - получить плейлист по shortCode

## SignalR Hub

- Endpoint: `/partyHub`
- Методы и события описаны в `CherryPlayServer/README.md`

## Сборка проектов

Для сборки всех проектов используйте:

```bash
# PowerShell
.\build-all.ps1

# CMD
build-all.bat
```

Для сборки отдельных проектов:
- `build-components.bat` / `build-components.ps1` - только компоненты
- `build-server.bat` / `build-server.ps1` - только сервер
- `build-web.bat` / `build-web.ps1` - только веб-приложение

Подробнее см. `SCRIPTS.md`

