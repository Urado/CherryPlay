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

   Подробнее см. `build/README.md`

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
# Windows
npm run dist:win

# macOS
npm run dist:mac

# Linux
npm run dist:linux

# Все платформы
npm run dist:all
```

## Результат сборки

Готовые дистрибутивы будут находиться в папке `release/`:

### Windows

- `CherryPlayList-{version}-x64.exe` - NSIS установщик (64-bit)
- `CherryPlayList-{version}-ia32.exe` - NSIS установщик (32-bit)
- `CherryPlayList-{version}-x64-portable.exe` - Portable версия (64-bit)

**Примечание:** Portable версия создается автоматически при сборке для Windows. Команда `npm run dist:win` создает и NSIS установщик, и portable версию.

### macOS

- `CherryPlayList-{version}-x64.dmg` - DMG образ (Intel)
- `CherryPlayList-{version}-arm64.dmg` - DMG образ (Apple Silicon)
- `CherryPlayList-{version}-x64-mac.zip` - ZIP архив (Intel)
- `CherryPlayList-{version}-arm64-mac.zip` - ZIP архив (Apple Silicon)

### Linux

- `CherryPlayList-{version}-x64.AppImage` - AppImage (64-bit)
- `CherryPlayList-{version}-x64.deb` - Debian пакет (64-bit)

## Версионирование

Перед сборкой релиза обновите версию в `package.json`:

```json
{
  "version": "1.0.1"
}
```

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
- Параметры установщиков
- И многое другое

Подробнее: https://www.electron.build/
