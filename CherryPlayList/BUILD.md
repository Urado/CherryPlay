# Инструкция по сборке релиза

## Подготовка

1. Убедитесь, что все зависимости установлены:

```bash
npm install
```

2. Иконки CherryPashka уже включены в репозиторий:
   - `build/icon.ico` - для Windows
   - `build/icon.icns` - для macOS
   - `build/icon.png` - для Linux

   `build/icon.png` — общий мастер 1024×1024: круглый знак с профилем черепашки в наушниках и вишнями на тёмной плитке. Внешние углы прозрачные. Размеры и форматы для desktop и сайта получены из этого мастера. Перегенерация описана в [build/README.md](build/README.md).

   Electron использует `build/icon.ico` (Windows) или `build/icon.png` (Linux/macOS) в разработке и копии из `resources/icons/` в дистрибутиве. macOS Dock получает ту же PNG-иконку, а пакет приложения — ICNS. Favicons и Apple touch icon находятся в `public/` обоих приложений.

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
# Windows (локально и в CI; нужен CherryPlayAimpPlugin/prebuilt/CherryPlayAimpBridge.dll)
npm run dist:win

# Windows CI-сборка (также включает AIMP bridge)
npm run dist:win:ci

# macOS
npm run dist:mac

# Linux
npm run dist:linux

# Все платформы
npm run dist:all
```

**Windows scripts:**

| Script        | Что делает                                                                             | AIMP bridge                                |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| `dist:win`    | `build:electron` → `stage:aimp-plugin` → `clean:pack` → `electron-builder --win --x64` | Использует `CHERRYPLAY_AIMP_DLL` override, иначе ищет локальную DLL (Release/Debug), затем fallback в `prebuilt/` |
| `dist:win:ci` | `build:electron` → `stage:aimp-plugin:prebuilt` → `clean:pack` → `electron-builder --win --x64` | Берёт только DLL из `prebuilt/`; при отсутствии сборка завершается ошибкой |

Локально соберите AIMP bridge по инструкции в [CherryPlayAimpPlugin/README.md](../CherryPlayAimpPlugin/README.md) и скопируйте Release x64 DLL в `CherryPlayAimpPlugin/prebuilt/CherryPlayAimpBridge.dll`. Коммитьте DLL вместе с изменениями исходников плагина. GitHub Actions использует эту закоммиченную DLL: CI не скачивает AIMP SDK и не компилирует нативный плагин. В Windows ZIP staging помещает bridge и manifest в каталог плагинов CherryPlayList.

Целевой артефакт Windows в `package.json` (`build.win`): **zip** x64 (`CherryPashkaParty-{version}-x64.zip`), не NSIS и не portable exe. После распаковки пользователь запускает `CherryPashkaParty.exe`. Блок `"nsis"` в `package.json` есть, но **неактивен** (win target — только zip).

### Packaging hygiene

- Перед `electron-builder` скрипты `dist*` вызывают `npm run clean:pack` (`scripts/clean-pack.mjs`): идемпотентно удаляет типичные outputs electron-builder под `release/` для текущей версии (`win-unpacked` / `linux-unpacked` / `mac*`, zip/dmg/AppImage/deb и т.п.), чтобы не было гонок rename/`ENOENT` на полуудалённом дереве. Весь `release/` целиком не чистится.
- Запускайте **один** electron-builder за раз; параллельные сборки дают `ENOENT rename electron.exe → CherryPashkaParty.exe` и сбои `7za`.
- Для `file:../CherryPlayComponents` electron-builder **не** опирается на npm `"files"` linked-пакета при сборке asar: обрезку дают явные исключения в `CherryPlayList` `build.files` (`src`, nested `node_modules`, scripts, конфиги, тесты). Поле `"files": ["dist"]` в `CherryPlayComponents/package.json` остаётся полезным для `npm pack` / publish, но само по себе Windows pack не сужает.

## Результат сборки

Готовые дистрибутивы будут находиться в папке `release/`:

### Windows

- `CherryPashkaParty-{version}-x64.zip` — zip-дистрибутив (64-bit); внутри находится `CherryPashkaParty.exe`

Опубликованные GitHub Release builds и PR verification запускают `dist:win:ci`: staging использует только committed DLL из `CherryPlayAimpPlugin/prebuilt/CherryPlayAimpBridge.dll`, затем electron-builder собирает ZIP. При отсутствии DLL workflow завершается ошибкой. После сборки оба workflow проверяют, что архив содержит `CherryPlayAimpBridge/CherryPlayAimpBridge.dll` и `CherryPlayAimpBridge/manifest.json`. PR verify запускается при изменениях в `CherryPlayList/**`, `CherryPlayComponents/**`, `CherryPlayAimpPlugin/**`, `eslint-config-cherryplay/**` или самом workflow. Для prerelease-тега `player-vX.Y.Z` workflow записывает версию в package-файлы и сверяет имя ZIP `CherryPashkaParty-X.Y.Z-x64.zip`. PR в `main`/`develop` получает ZIP как Actions artifact `CherryPashkaParty-{base}-pr-{PR}-x64`; его скачивает автор PR.

Скачать последний стабильный zip: см. [.github/DEPLOYMENT.md](../.github/DEPLOYMENT.md) (раздел «Скачать Windows desktop»).

### macOS

- `CherryPlayList-{version}-x64.dmg` - DMG образ (Intel)
- `CherryPlayList-{version}-arm64.dmg` - DMG образ (Apple Silicon)
- `CherryPashkaParty-{version}-x64-mac.zip` - ZIP архив (Intel)
- `CherryPashkaParty-{version}-arm64-mac.zip` - ZIP архив (Apple Silicon)

### Linux

- `CherryPlayList-{version}-x64.AppImage` - AppImage (64-bit)
- `CherryPlayList-{version}-x64.deb` - Debian пакет (64-bit)

## Версионирование

Для локальной сборки задайте версию в `package.json` перед `dist:*`:

```json
{
  "version": "1.0.1"
}
```

Для бета-версии источником истины служит опубликованный prerelease-тег строго в формате `player-vX.Y.Z` (три числовых компонента без prerelease-суффикса). Workflow `release-desktop-windows.yml` извлекает `X.Y.Z`, записывает версию в `package.json` и `package-lock.json`, собирает ZIP и проверяет его имя перед загрузкой в релиз с этим тегом. Desktop уведомление и `/download` используют только опубликованные prerelease с тегом этого формата и соответствующим Windows ZIP; уведомление предлагает вручную скачать ZIP со страницы `/download` и не устанавливает его автоматически. Подробности выпуска: [.github/DEPLOYMENT.md](../.github/DEPLOYMENT.md).

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
- Если в логе electron-builder много `duplicate dependency references` по `@cherryplay/components` (eslint/vite/react из sibling package на диске) — для asar важны исключения в `CherryPlayList` `build.files`; `"files": ["dist"]` в Components влияет на npm pack/publish, не на обход `file:` junction builder’ом

### Гонки / ENOENT при Windows pack

- Не запускайте два `electron-builder` параллельно
- `dist:*` сами чистят stale outputs через `clean:pack` (win/mac/linux артефакты текущей версии под `release/`)
- Если остались зависшие `7za` / `app-builder` — завершите их и перезапустите `dist:win:ci`
- `ENOENT … entry-*.css` обычно значит, что упаковывали устаревший `dist/` без свежего `build:electron` — используйте `dist:*` скрипты, а не голый electron-builder после старой сборки

## Дополнительные настройки

Конфигурация сборки находится в секции `"build"` файла `package.json`.

Можно настроить:

- Имя приложения
- Идентификатор приложения
- Включаемые/исключаемые файлы
- Параметры упаковки (targets: zip, dmg, AppImage и т.д.)
- И многое другое

Подробнее: https://www.electron.build/
