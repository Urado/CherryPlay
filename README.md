# CherryPlay

Монорепозиторий для проекта CherryPlay - системы управления плейлистами и синхронизации воспроизведения.

## Проекты

- **CherryPlayList** - Desktop приложение на Electron для создания и управления плейлистами
- **CherryPlayComponents** - React компоненты и темы для отображения плейлистов
- **CherryPlayServer** - Backend сервер на .NET для синхронизации воспроизведения
- **CherryPlayWeb** - Web приложение для просмотра плейлистов

## Быстрый старт

### Запуск всех сервисов

```bash
# PowerShell
.\start-all.ps1

# CMD
start-all.bat
```

Скрипт автоматически запустит:
- CherryPlayServer (http://localhost:5000)
- CherryPlayWeb (http://localhost:3000)

### Сборка всех проектов

```bash
# PowerShell
.\build-all.ps1

# CMD
build-all.bat
```

Подробнее см. `QUICK_START.md` и `SCRIPTS.md`

## Структура

```
CherryPlay/
├── CherryPlayList/        # Desktop приложение (Electron + React)
├── CherryPlayComponents/  # React компоненты библиотека
├── CherryPlayServer/     # Backend сервер (.NET)
├── CherryPlayWeb/        # Web приложение (React)
├── build-all.ps1         # Скрипты сборки
├── start-all.ps1         # Скрипты запуска
└── README.md             # Этот файл
```

## Требования

- **Node.js** - для сборки и запуска веб-приложений и компонентов
- **.NET 8.0 SDK** - для сборки и запуска сервера

## Разработка

Каждый проект имеет свой собственный `package.json` и может быть запущен независимо. Для разработки в монорепозитории используйте локальные пути и TypeScript path mapping.

Подробная документация по каждому проекту находится в соответствующих папках:
- `CherryPlayList/README.md` - документация Desktop приложения
- `CherryPlayComponents/README.md` - документация компонентов
- `CherryPlayServer/README.md` - документация сервера
- `CherryPlayWeb/README.md` - документация веб-приложения

