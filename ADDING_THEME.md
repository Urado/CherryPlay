# Инструкция по добавлению новой PartyTheme

**PartyTheme** — визуальный стиль контента вечеринки (плейлист, текущий трек, страница info). Не путать с темой оболочки приложения (тёмная/светлая). См. [GLOSSARY.md](./GLOSSARY.md).

## Краткая сводка

Для добавления новой PartyTheme нужно:
1. Создать CSS файлы в `CherryPlayComponents/src/themes/<theme-id>/`
2. Зарегистрировать PartyTheme в `CherryPlayComponents/src/themes/index.ts`
3. Добавить значение в C# enum `CherryPlayServer/Core/Enums/ThemeId.cs`
4. Обновить документацию

**Важно**: После добавления PartyTheme в библиотеку компонентов она автоматически становится доступной во всех приложениях. Дополнительные изменения в CherryPlayWeb и CherryPlayList не требуются (кроме опциональных превью).

## Пошаговая инструкция

### Шаг 1: Создание CSS файлов PartyTheme

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
- Смотрите примеры в существующих PartyTheme: `basic/`, `cyberpunk/`, `sakura/`, `art-deco/`
- Все селекторы должны начинаться с `[data-theme="<theme-id>"]`

### Шаг 2: Регистрация PartyTheme в CherryPlayComponents

**2.1. Обновите `CherryPlayComponents/src/themes/index.ts`:**

- Добавьте идентификатор PartyTheme в union type `PartyThemeId`
- Добавьте PartyTheme в объект `PARTY_THEME_REGISTRY` используя функцию `createPartyTheme()`
- Укажите: `id`, `name`, `description`, `cssPath`
- Если PartyTheme поддерживает кастомизацию, укажите `customizationOptions` (массив строк с названиями опций)

**2.2. Добавьте импорт CSS в `CherryPlayComponents/src/themes/index.css`:**

- Добавьте строку `@import './<theme-id>/index.css';` в конец файла

**2.3. Пересоберите библиотеку:**

- Выполните `npm run build` в директории `CherryPlayComponents`
- Убедитесь, что сборка прошла без ошибок

### Шаг 3: Обновление сервера (CherryPlayServer)

**3.1. Добавьте значение в enum `CherryPlayServer/Core/Enums/PartyThemeId.cs`:**

- Добавьте новое значение enum с PascalCase именем (например, `MyTheme`)
- Добавьте атрибут `[JsonStringEnumMemberName("<theme-id>")]` с идентификатором PartyTheme в нижнем регистре
- Значение должно соответствовать идентификатору из библиотеки компонентов

**3.2. (Опционально) Добавьте пример вечеринки в `CherryPlayServer/Infrastructure/Data/DataSeeder.cs`:**

- Создайте новый объект `Party` с `PartyThemeId` равным новому значению enum
- Заполните плейлист тестовыми данными
- Добавьте вызов `await _partyRepository.AddAsync(newThemeParty);` в метод `SeedAsync`

### Шаг 4: Обновление документации

**4.1. Обновите `THEMES.md` (или аналог):**

- Добавьте описание PartyTheme в раздел "Доступные PartyTheme" с указанием цветовой схемы, шрифтов и эффектов
- Если PartyTheme поддерживает кастомизацию, добавьте таблицу в раздел "Настройки кастомизации" с описанием всех параметров

### Шаг 5: (Опционально) Добавление превью в CherryPlayList

Если хотите добавить превью для PartyTheme в приложении CherryPlayList:

**5.1. Обновите `CherryPlayList/src/workspaces/party/components/PartyEditor.tsx`:**

- Добавьте превью в маппинг `PARTY_THEME_PREVIEWS` с ключом идентификатора PartyTheme
- Превью будет автоматически использоваться, так как список PartyTheme формируется из библиотеки компонентов

**5.2. Если PartyTheme поддерживает кастомизацию:**

- Добавьте блок настроек в `PartyEditor.tsx` с условием `{themeId === '<theme-id>' && ...}`
- Добавьте поля для всех опций кастомизации из `customizationOptions`

**5.3. Обновите обработчик `handleThemeChange` в `CherryPlayList/src/workspaces/party/PartyView.tsx`:**

- Добавьте условие для установки значений по умолчанию для настроек кастомизации новой PartyTheme

## Важные замечания

1. **Идентификатор PartyTheme (`theme-id`)** должен быть в нижнем регистре, использовать дефисы для разделения слов (например, `art-deco`, `my-theme`). Не используйте пробелы или специальные символы.

## Чеклист добавления новой PartyTheme

3. **Автоматическое обновление**: После добавления PartyTheme в библиотеку компонентов она автоматически становится доступной в:
   - CherryPlayWeb (через `isValidPartyTheme()`)
   - CherryPlayList (через массив тем)
   - Всех местах, использующих тип `PartyThemeId` (в API/коде поле `partyThemeId`)

4. **CSS переменные**: Используйте стандартный набор CSS переменных для консистентности:
   - `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`
   - `--text-primary`, `--text-secondary`, `--text-tertiary`
   - `--accent-primary`, `--accent-primary-light`
   - `--border-color`, `--selected-bg`, `--selected-border`
   - Смотрите примеры в существующих PartyTheme

5. **Тестирование**: После добавления PartyTheme:
   - Пересоберите `CherryPlayComponents`: `npm run build`
   - Проверьте отображение в CherryPlayWeb
   - Проверьте выбор PartyTheme в CherryPlayList
   - Проверьте создание вечеринки с новой PartyTheme на сервере
   - Убедитесь, что CSS переменные применяются правильно
   - Если есть настройки кастомизации, проверьте их работу

2. **Примеры существующих PartyTheme**: Для справки используйте существующие темы как примеры:
   - `CherryPlayComponents/src/themes/basic/` - простая тема без кастомизации
   - `CherryPlayComponents/src/themes/cyberpunk/` - тема с настройками кастомизации
   - `CherryPlayComponents/src/themes/sakura/` - пример пастельной темы
   - `CherryPlayComponents/src/themes/art-deco/` - пример элегантной темы

Используйте этот чеклист для проверки, что все шаги выполнены:

### CherryPlayComponents
- [ ] Создана директория `themes/<theme-id>/`
- [ ] Созданы файлы: `index.css`, `playlist.css`, `playlist-item.css`, `player.css`
- [ ] Все селекторы используют `[data-theme="<theme-id>"]`
- [ ] Добавлен `PartyThemeId` в union type в `themes/index.ts`
- [ ] Добавлена PartyTheme в `PARTY_THEME_REGISTRY` в `themes/index.ts`
- [ ] Добавлен импорт CSS в `themes/index.css`
- [ ] Проект собирается без ошибок: `npm run build`

### CherryPlayServer
- [ ] Добавлено значение в enum `PartyThemeId.cs` с атрибутом `JsonStringEnumMemberName`
- [ ] Идентификатор в атрибуте соответствует идентификатору в библиотеке
- [ ] (Опционально) Добавлен пример вечеринки в `DataSeeder.cs`

### Документация
- [ ] Добавлено описание PartyTheme в `THEMES.md` (раздел "Доступные PartyTheme")
- [ ] Добавлена таблица настроек кастомизации в `THEMES.md` (если есть)
### CherryPlayList (опционально)
- [ ] Добавлено превью в `PARTY_THEME_PREVIEWS` в `PartyEditor.tsx`
- [ ] Добавлен блок настроек кастомизации в `PartyEditor.tsx` (если есть)
- [ ] Обновлен обработчик `handleThemeChange` в `PartyView.tsx` (если есть настройки)

### Тестирование
- [ ] PartyTheme отображается корректно в CherryPlayWeb
- [ ] PartyTheme доступна для выбора в CherryPlayList
- [ ] Можно создать вечеринку с новой PartyTheme на сервере
- [ ] CSS переменные применяются правильно
- [ ] Настройки кастомизации работают (если есть)
- [ ] Все состояния элементов работают (hover, current, played, disabled)

## См. также

- [GLOSSARY.md](./GLOSSARY.md) — термин **PartyTheme**
- [THEME_REFACTORING.md](./THEME_REFACTORING.md) — палитра оболочки vs PartyTheme
- [docs/integration/streaming.md](./docs/integration/streaming.md) — стриминг и контракты
- Примеры PartyTheme: `CherryPlayComponents/src/themes/`
