# Быстрый старт: Сборка релиза

## Минимальные шаги для сборки

1. **Соберите проект:**

   ```bash
   npm run build:electron
   ```

2. **Создайте дистрибутив:**
   ```bash
   npm run dist
   ```

Готово! Дистрибутив будет в папке `release/`

## Важно знать

- **Иконки опциональны**: Если иконок нет, electron-builder использует дефолтные
- **Для добавления иконок**: Поместите файлы в `build/`:
  - `icon.ico` (Windows)
  - `icon.icns` (macOS)
  - `icon.png` (Linux)

## Команды сборки

```bash
npm run dist          # Текущая платформа
npm run dist:win      # Windows
npm run dist:mac      # macOS
npm run dist:linux    # Linux
npm run dist:all      # Все платформы
```

Подробнее: см. `BUILD.md`
