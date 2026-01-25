# Скрипты для сборки

> **Примечание:** Для запуска сервера и веб-приложения используйте Docker Compose (см. [README.md](./README.md#docker)). Скрипты ниже предназначены только для сборки компонентов, которые используются в CherryPlayList.

## Сборка компонентов

### `build-components.bat` / `build-components.ps1`
Собирает библиотеку CherryPlayComponents, которая используется в CherryPlayList и CherryPlayWeb.

**Использование:**
```bash
# PowerShell
.\build-components.ps1

# CMD
build-components.bat
```

Скрипт автоматически:
- Проверяет наличие Node.js
- Устанавливает зависимости при необходимости
- Собирает компоненты в `CherryPlayComponents/dist/`

## Результаты сборки

После успешной сборки:
- **CherryPlayComponents**: `CherryPlayComponents/dist/`

## Требования

- **Node.js** - для сборки компонентов

## Примечания

- PowerShell скрипты более функциональны и предоставляют цветной вывод
- Batch скрипты (.bat) можно запускать двойным кликом
- При первом запуске скрипты автоматически установят зависимости

## Альтернатива: Ручная сборка

Если скрипты не нужны, можно собрать компоненты вручную:

```bash
cd CherryPlayComponents
npm install
npm run build
```

