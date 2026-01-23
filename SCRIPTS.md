# Скрипты для запуска и сборки

## Скрипты запуска

### `start-all.bat` / `start-all.ps1`
Запускает все сервисы параллельно:
- CherryPlayServer (http://localhost:5000)
- CherryPlayWeb (http://localhost:3000)

**Использование:**
```bash
# PowerShell
.\start-all.ps1

# CMD
start-all.bat
```

Скрипт автоматически:
- Проверяет наличие .NET SDK и Node.js
- Устанавливает зависимости при необходимости
- Запускает сервер и веб-приложение в отдельных окнах

## Скрипты сборки

### `build-all.bat` / `build-all.ps1`
Собирает все проекты по порядку:
1. CherryPlayComponents
2. CherryPlayServer
3. CherryPlayWeb

**Использование:**
```bash
# PowerShell
.\build-all.ps1

# CMD
build-all.bat
```

### Отдельные скрипты сборки

- `build-components.bat` / `build-components.ps1` - сборка только компонентов
- `build-server.bat` / `build-server.ps1` - сборка только сервера
- `build-web.bat` / `build-web.ps1` - сборка только веб-приложения

**Использование:**
```bash
# PowerShell
.\build-components.ps1
.\build-server.ps1
.\build-web.ps1

# CMD
build-components.bat
build-server.bat
build-web.bat
```

## Результаты сборки

После успешной сборки:
- **CherryPlayComponents**: `CherryPlayComponents/dist/`
- **CherryPlayServer**: `CherryPlayServer/bin/Release/`
- **CherryPlayWeb**: `CherryPlayWeb/dist/`

## Требования

- **.NET 8.0 SDK** - для сборки и запуска сервера
- **Node.js** - для сборки и запуска веб-приложения и компонентов

## Примечания

- PowerShell скрипты более функциональны и предоставляют цветной вывод
- Batch скрипты (.bat) можно запускать двойным кликом
- При первом запуске скрипты автоматически установят зависимости

