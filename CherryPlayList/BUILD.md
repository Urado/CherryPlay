# Инструкция по сборке релиза

## Подготовка

1. Убедитесь, что все зависимости установлены:

```bash
npm install
```

2. Добавьте иконки в папку `build/`:
   - `build/icon.ico` - для Windows
   - `build/icon.icns` - для macOS
   - `build/icon.png` - для Linux

   Иконки опциональны: при их отсутствии electron-builder использует стандартные.

## Сборка проекта

### 1. Сборка для разработки

```bash
npm run build:electron
```

Это скомпилирует Electron код и соберет React приложение в `dist/` и `dist-electron/`.

### 2. Создание дистрибутива

#### Для текущей платформы:

```bash
npm run dist
```

#### Для конкретной платформы:

```bash
# Windows (локально, со staging AIMP-плагина — нужен собранный DLL)
npm run dist:win

# Windows без AIMP staging (тот же путь, что CI)
npm run dist:win:ci

# macOS
npm run dist:mac

# Linux
npm run dist:linux

# Все платформы
npm run dist:all
```

**Windows scripts:**

| Script | Что делает | AIMP bridge |
| --- | --- | --- |
| `dist:win` | `build:electron` → `stage:aimp-plugin` → `electron-builder --win --x64` | Staging обязателен (без DLL скрипт падает) |
| `dist:win:ci` | `build:electron` → `electron-builder --win --x64` | Не стейджится; для GitHub Release |

Целевой артефакт Windows в `package.json` (`build.win`): **zip** x64 (`CherryPlayList-{version}-x64.zip`), не NSIS и не portable exe. Блок `"nsis"` в `package.json` есть, но **неактивен** (win target — только zip).

## Результат сборки

Готовые дистрибутивы будут находиться в папке `release/`:

### Windows

- `CherryPlayList-{version}-x64.zip` — zip-дистрибутив (64-bit)

Опубликованные GitHub Release builds используют `dist:win:ci` и **пока без** нативного AIMP bridge (отложено). Локальный `dist:win` — для мейнтейнеров с собранным плагином.

Скачать последний стабильный zip: см. [.github/DEPLOYMENT.md](../.github/DEPLOYMENT.md) (раздел «Скачать Windows desktop»).

### macOS

- `CherryPlayList-{version}-x64.dmg` - DMG образ (Intel)
- `CherryPlayList-{version}-arm64.dmg` - DMG образ (Apple Silicon)
- `CherryPlayList-{version}-x64-mac.zip` - ZIP архив (Intel)
- `CherryPlayList-{version}-arm64-mac.zip` - ZIP архив (Apple Silicon)

### Linux

- `CherryPlayList-{version}-x64.AppImage` - AppImage (64-bit)
- `CherryPlayList-{version}-x64.deb` - Debian пакет (64-bit)

## Версионирование

Для локальной сборки обновите версию в `package.json` перед `dist:*`:

```json
{
  "version": "1.0.1"
}
```

Имя zip берётся из `${version}` electron-builder. В CI (`release-desktop-windows.yml`) версия **синхронизируется с тегом** GitHub Release (ведущий `v` снимается: тег `v1.2.3` → `1.2.3`), чтобы имя asset совпадало с `CherryPlayList-{version}-x64.zip` и URL `…/releases/latest/download/…`.

## Проверка сборки

После сборки можно протестировать приложение:

1. Запустите собранное приложение из папки `release/`
2. Или запустите из собранных файлов:

```bash
npm run build:electron
electron .
```

## Устранение проблем

### Ошибка "icon not found"

- Убедитесь, что иконки находятся в папке `build/`
- Проверьте правильность имен файлов: `icon.ico`, `icon.icns`, `icon.png`

### Ошибка при сборке для другой платформы

- Для сборки macOS приложения нужна macOS система
- Для сборки Windows приложения нужна Windows система
- Linux приложения можно собирать на любой платформе

### Большой размер дистрибутива

- Это нормально для Electron приложений (обычно 100-200 MB)
- Размер можно уменьшить, исключив ненужные зависимости

## Дополнительные настройки

Конфигурация сборки находится в секции `"build"` файла `package.json`.

Можно настроить:

- Имя приложения
- Идентификатор приложения
- Включаемые/исключаемые файлы
- Параметры упаковки (targets: zip, dmg, AppImage и т.д.)
- И многое другое

Подробнее: https://www.electron.build/
