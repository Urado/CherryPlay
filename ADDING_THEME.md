# Инструкция по добавлению новой темы

## Краткая сводка

Для добавления новой темы нужно:
1. Создать CSS файлы в `CherryPlayComponents/src/themes/<theme-id>/`
2. Зарегистрировать тему в `CherryPlayComponents/src/themes/index.ts`
3. Добавить значение в C# enum `CherryPlayServer/Core/Enums/ThemeId.cs`
4. Обновить документацию

**Важно**: После добавления темы в библиотеку компонентов, она автоматически становится доступной во всех приложениях благодаря централизованной системе. Дополнительные изменения в CherryPlayWeb и CherryPlayList не требуются (кроме опциональных превью).

## Пошаговая инструкция

### Шаг 1: Создание CSS файлов темы

Создайте директорию `CherryPlayComponents/src/themes/<theme-id>/` и добавьте следующие файлы:

**`index.css`** - главный файл с CSS переменными:
- Импортируйте остальные CSS файлы темы
- Определите CSS переменные через `[data-theme="<theme-id>"]`
- Установите базовые стили для `.party-display`, `.party-display-title`, `.party-display-session-indicator`, `.party-display-session-dot`, `.party-playlist-view`, `.party-current-track-display`

**`playlist.css`** - стили плейлиста:
- Стили для `.party-playlist-view`, `.party-playlist-header`, `.party-playlist-stats`, `.party-playlist-stats-separator`, `.party-playlist-items`, `.party-playlist-empty`, `.party-playlist-group-items`

**`playlist-item.css`** - стили элементов плейлиста:
- Стили для `.party-playlist-item` (базовое состояние, hover, current, played, disabled)
- Стили для `.party-playlist-item-name` и `.party-playlist-item-duration`

**`player.css`** - стили плеера:
- Стили для `.party-current-track-display`, `.party-current-track-empty`, `.party-current-track-name`, `.party-current-track-meta`, `.party-current-track-status`, `.party-current-track-time`, `.party-current-track-progress`, `.party-current-track-progress-bar`

**Рекомендации:**
- Используйте стандартный набор CSS переменных для консистентности
- Смотрите примеры в существующих темах: `basic/`, `cyberpunk/`, `sakura/`, `art-deco/`
- Все селекторы должны начинаться с `[data-theme="<theme-id>"]`

### Шаг 2: Регистрация темы в CherryPlayComponents

**2.1. Обновите `CherryPlayComponents/src/themes/index.ts`:**

- Добавьте идентификатор темы в union type `ThemeId`
- Добавьте тему в объект `THEME_REGISTRY` используя функцию `createTheme()`
- Укажите: `id`, `name`, `description`, `cssPath`
- Если тема поддерживает кастомизацию, укажите `customizationOptions` (массив строк с названиями опций)

**2.2. Добавьте импорт CSS в `CherryPlayComponents/src/themes/index.css`:**

- Добавьте строку `@import './<theme-id>/index.css';` в конец файла

**2.3. Пересоберите библиотеку:**

- Выполните `npm run build` в директории `CherryPlayComponents`
- Убедитесь, что сборка прошла без ошибок

### Шаг 3: Обновление сервера (CherryPlayServer)

**3.1. Добавьте значение в enum `CherryPlayServer/Core/Enums/ThemeId.cs`:**

- Добавьте новое значение enum с PascalCase именем (например, `MyTheme`)
- Добавьте атрибут `[JsonStringEnumMemberName("<theme-id>")]` с идентификатором темы в нижнем регистре
- Значение должно соответствовать идентификатору темы из библиотеки компонентов

**3.2. (Опционально) Добавьте пример вечеринки в `CherryPlayServer/Infrastructure/Data/DataSeeder.cs`:**

- Создайте новый объект `Party` с `ThemeId` равным новому значению enum
- Заполните плейлист тестовыми данными
- Добавьте вызов `await _partyRepository.AddAsync(newThemeParty);` в метод `SeedAsync`

### Шаг 4: Обновление документации

**4.1. Обновите `THEMES.md`:**

- Добавьте описание темы в раздел "Доступные темы" с указанием цветовой схемы, шрифтов и эффектов
- Если тема поддерживает кастомизацию, добавьте таблицу в раздел "Настройки кастомизации" с описанием всех параметров

### Шаг 5: (Опционально) Добавление превью в CherryPlayList

Если хотите добавить превью для темы в приложении CherryPlayList:

**5.1. Обновите `CherryPlayList/src/workspaces/party/components/PartyEditor.tsx`:**

- Добавьте превью в маппинг `THEME_PREVIEWS` с ключом идентификатора темы
- Превью будет автоматически использоваться, так как список тем формируется из библиотеки компонентов

**5.2. Если тема поддерживает кастомизацию:**

- Добавьте блок настроек в `PartyEditor.tsx` с условием `{themeId === '<theme-id>' && ...}`
- Добавьте поля для всех опций кастомизации из `customizationOptions`

**5.3. Обновите обработчик `handleThemeChange` в `CherryPlayList/src/workspaces/party/PartyView.tsx`:**

- Добавьте условие для установки значений по умолчанию для настроек кастомизации новой темы

## Важные замечания

1. **Идентификатор темы (`theme-id`)** должен быть в нижнем регистре, использовать дефисы для разделения слов (например, `art-deco`, `my-theme`). Не используйте пробелы или специальные символы.

2. **Примеры существующих тем**: Для справки используйте существующие темы как примеры:
   - `CherryPlayComponents/src/themes/basic/` - простая тема без кастомизации
   - `CherryPlayComponents/src/themes/cyberpunk/` - тема с настройками кастомизации
   - `CherryPlayComponents/src/themes/sakura/` - пример пастельной темы
   - `CherryPlayComponents/src/themes/art-deco/` - пример элегантной темы

3. **Автоматическое обновление**: После добавления темы в библиотеку компонентов, она автоматически становится доступной в:
   - CherryPlayWeb (через `isValidTheme()`)
   - CherryPlayList (через `themes` массив)
   - Всех местах, использующих `ThemeId` тип

4. **CSS переменные**: Используйте стандартный набор CSS переменных для консистентности:
   - `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`
   - `--text-primary`, `--text-secondary`, `--text-tertiary`
   - `--accent-primary`, `--accent-primary-light`
   - `--border-color`, `--selected-bg`, `--selected-border`
   - Смотрите примеры в существующих темах

5. **Тестирование**: После добавления темы:
   - Пересоберите `CherryPlayComponents`: `npm run build`
   - Проверьте отображение в CherryPlayWeb
   - Проверьте выбор темы в CherryPlayList
   - Проверьте создание вечеринки с новой темой на сервере
   - Убедитесь, что CSS переменные применяются правильно
   - Если есть настройки кастомизации, проверьте их работу

## Чеклист добавления новой темы

Используйте этот чеклист для проверки, что все шаги выполнены:

### CherryPlayComponents
- [ ] Создана директория `themes/<theme-id>/`
- [ ] Созданы файлы: `index.css`, `playlist.css`, `playlist-item.css`, `player.css`
- [ ] Все селекторы используют `[data-theme="<theme-id>"]`
- [ ] Добавлен `ThemeId` в union type в `themes/index.ts`
- [ ] Добавлена тема в `THEME_REGISTRY` в `themes/index.ts`
- [ ] Добавлен импорт CSS в `themes/index.css`
- [ ] Проект собирается без ошибок: `npm run build`

### CherryPlayServer
- [ ] Добавлено значение в enum `ThemeId.cs` с атрибутом `JsonStringEnumMemberName`
- [ ] Идентификатор в атрибуте соответствует идентификатору в библиотеке
- [ ] (Опционально) Добавлен пример вечеринки в `DataSeeder.cs`

### Документация
- [ ] Добавлено описание темы в `THEMES.md` (раздел "Доступные темы")
- [ ] Добавлена таблица настроек кастомизации в `THEMES.md` (если есть)
### CherryPlayList (опционально)
- [ ] Добавлено превью в `THEME_PREVIEWS` в `PartyEditor.tsx`
- [ ] Добавлен блок настроек кастомизации в `PartyEditor.tsx` (если есть)
- [ ] Обновлен обработчик `handleThemeChange` в `PartyView.tsx` (если есть настройки)

### Тестирование
- [ ] Тема отображается корректно в CherryPlayWeb
- [ ] Тема доступна для выбора в CherryPlayList
- [ ] Можно создать вечеринку с новой темой на сервере
- [ ] CSS переменные применяются правильно
- [ ] Настройки кастомизации работают (если есть)
- [ ] Все состояния элементов работают (hover, current, played, disabled)

## См. также

- [THEMES.md](./THEMES.md) - общая документация по темам
- [docs/integration/streaming.md](./docs/integration/streaming.md) — стриминг и контракты
- Примеры тем: `CherryPlayComponents/src/themes/`
