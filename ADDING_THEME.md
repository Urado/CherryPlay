# Инструкция по добавлению новой PartyTheme

**PartyTheme** — визуальный стиль контента вечеринки (плейлист, текущий трек, страница информации). Не путать с темой оболочки приложения (тёмная/светлая палитра интерфейса).

## Краткая сводка

Для добавления новой PartyTheme нужно:

1. Создать CSS файлы в `CherryPlayComponents/src/themes/<theme-id>/`
2. Зарегистрировать PartyTheme в `CherryPlayComponents/src/themes/index.ts`
3. Добавить значение в C# enum `CherryPlayServer/Core/Enums/PartyThemeId.cs`
4. Обновить документацию

**Важно**: После добавления PartyTheme в библиотеку компонентов она автоматически становится доступной во всех приложениях. Дополнительные изменения в CherryPlayWeb и CherryPlayList не требуются (кроме опциональных превью).

## Пошаговая инструкция

### Шаг 1: Создание CSS файлов PartyTheme

Создайте директорию `CherryPlayComponents/src/themes/<theme-id>/` и добавьте файлы: `index.css`, `playlist.css`, `playlist-item.css`, `player.css`. Базовые компоненты рендерят единую разметку; тема задаёт только стили. Общих CSS между темами нет — каждая изолирована через `[data-theme="<theme-id>"]`.

**Принцип:** на разных экранах тема должна вести себя одинаково (одинаковые отступы, читаемость, поведение блоков). Базовым вариантом в инструкции считается эталонная сетка отступов и размеров ниже; при необходимости её можно повторить, подставляя свои цвета и шрифты.

**Принцип одного источника отступов:** внутренние отступы (padding) контента должны задаваться в одном месте. Например, у элемента плейлиста внутренний отступ строки задаётся у `.party-playlist-item-row` (12px 24px); тема не должна добавлять ещё и padding самому `.party-playlist-item` — иначе получится двойной отступ. Для карточного вида используйте у элемента только `margin` и при необходимости `border-radius`, а внутренние отступы оставляйте строке.

Следование эталонной сетке ниже даёт тему с центрированным заголовком, отдельными скруглёнными блоками «Сейчас играет» и плейлиста, блоками «Предыдущий»/«Следующий» по правому краю (название + длительность в одной строке), иконками в кружках и кликабельным разворотом названия трека.

#### Эталонная сетка (базовый вариант)

Используйте эти значения, чтобы темы вели себя единообразно. Цвета и шрифты — на усмотрение темы. Базовые компоненты уже рендерят разметку с блоками «Предыдущий»/«Следующий», иконками в кружках и кнопкой разворота названия; тема только задаёт стили.

**Страница вечеринки (main):** основной контейнер — `padding: 32px 16px`, `gap: 24px`, `max-width: min(100%, 1200px)`, центрирование. Контейнер плеера и плейлиста — **gap 16px** между блоками, чтобы «Сейчас играет» и плейлист были визуально разделены. Заголовок страницы — **по центру**: `.party-display-header` с `justify-content: center`, `.party-display-header-text` с `align-items: center` и `text-align: center`. Заголовок — `font-size: clamp(22px, 5vw, 32px)`; подзаголовок — `clamp(14px, 3vw, 18px)`; индикатор сессии — `margin-top: 12px`, метка сессии **12px**, uppercase.

**Блок «Сейчас играет» и плейлист:** два отдельных блока, у каждого **border-radius 8px** со всех сторон (не общее скругление). Блок плеера (`.party-display-player`) и обёртка плейлиста (`.party-display-playlist-wrapper`) — по **8px**; контейнер (`.party-display-container`) — **gap: 16px**. При наличии постера в расширенной теме: блок постера **180×180px**, `border-radius: 20px`.

**Шапка плейлиста:** `padding: 20px 24px 16px`, между элементами `gap: 8px`. Иконка + подпись «Плейлист», справа блок статистики («Осталось треков: N» / «Последний трек» / «Вечеринка окончена»). Текст статистики **13px**. Нижняя граница 1px.

**Список треков:** контейнер списка — `padding: 8px 0`. Элемент списка (`.party-playlist-item`): для карточного вида только **margin** (например 6px 16px), **не задавайте padding** — внутренние отступы только у строки. Строка (`.party-playlist-item-row`): **padding 12px 24px**, **gap 12px** между кругом и текстом, левая граница-индикатор **3px** (цвет темы: current — `--selected-border`, played — `--border-color`). Круг состояния (`.party-playlist-item-circle`) — **28×28px**, в круге: current — иконка воспроизведения, played — галочка, disabled — крестик, upcoming — номер трека; текст в круге **12px**. В строке: название **14px**, кнопка разворота «…»/«×» (кликабельная, раскрывает полное название), **длительность в конце строки** **13px**, `margin-left: 12px`. Кнопка разворота: **padding 2px 4px**, **min-width 20px**, **border-radius 4px**. Второй строки (артист/path) в базовой разметке нет; при необходимости тему можно расширить.

**Плеер:** контейнер — `padding: 24px`, **border-radius 8px**. Пустое состояние — `padding: 32px 16px`. Блоки «Предыдущий» и «Следующий» — **выравнивание по правому краю** (`align-items: flex-end`, `text-align: right`); подпись **11px**; одна строка: **название трека + кнопка «…» + длительность в конце строки** (имя **14px**, длительность **12px**, `margin-left: 8px`); между блоками пред/след — `padding-top: 16px`. Текущий трек: имя **18px**, время и статус — **12px**. Прогресс-бар — высота **6px**; при желании ручка **12×12px** через `::after`.

**Адаптивность:** при **max-width: 480px** блок статистики в шапке плейлиста — `justify-content: center`; подпись «Осталось треков» — `max-width: 5.5em`, `word-break: keep-all`; число по центру. Остальные отступы и размеры сохраняются, чтобы поведение на узком и широком экране совпадало.

**Страница информации (если стилизуется темой):** внутренний контейнер карточки — `padding: 24px 24px 32px`; блоки мета (дата, место, город, расписание) — `margin: 8px 0`, текст **15px**; при мета сверху без границы — `margin-bottom: 20px`.

#### Файлы и что в них задавать

**`index.css`** — импорт остальных CSS темы; переменные `[data-theme="<theme-id>"]` (фон, текст, акценты, границы, при необходимости `--canceled-track`, `--canceled-track-text`); стили для `.party-display`, заголовка по центру (`.party-display-header`, `.party-display-header-text`, `.party-display-title`), `.party-display-session-indicator`, `.party-display-session-dot`, `.party-playlist-view`, `.party-current-track-display`; скругления блоков плеера и плейлиста (по 8px), gap между ними — в общем CSS или в теме.

**`playlist.css`** — контейнер плейлиста (border-radius 8px), шапка (иконка, «Плейлист», статистика), список и пустое состояние, вложенные группы. Медиа-запрос для ширины ≤480px по шапке — как в эталоне выше.

**`playlist-item.css`** — строка элемента (базово, hover, current, played, disabled), круг с иконкой/номером (`data-state`), обёртка имени с кликабельной кнопкой разворота и длительностью в конце строки, тултип «Трек отменён». Отступы и размеры — по эталонной сетке. Левая граница-индикатор — цвет для current/played.

**`player.css`** — контейнер плеера (border-radius 8px), пустое состояние; блоки «Предыдущий»/«Следующий» (выравнивание по правому краю, подпись + строка «название + … + длительность»); текущий трек (имя с разворотом, статус, время, прогресс-бар). Отступы и размеры — по эталонной сетке.

**Рекомендации:** все селекторы с префиксом `[data-theme="<theme-id>"]`; используйте стандартный набор CSS переменных (см. раздел ниже). Для единообразного поведения на экранах придерживайтесь эталонной сетки.

#### Справочник классов разметки (базовые компоненты)

Разметку рендерят базовые компоненты в `themes/base/`. Тема стилизует уже существующие классы; не полагайтесь на классы, которых нет в этом списке.

- **Страница вечеринки:** `.party-display`, `.party-display-main`, `.party-display-header`, `.party-display-header-text`, `.party-display-title`, `.party-display-subtitle`, `.party-display-session-indicator`, `.party-display-session-dot`, `.party-display-session-label`, `.party-display-container`, `.party-display-player`, `.party-display-playlist-wrapper`, `.party-display-playlist`.
- **Плейлист:** `.party-playlist-view`, `.party-playlist-header`, `.party-playlist-header-title`, `.party-playlist-header-icon`, `.party-playlist-header-label`, `.party-playlist-stats`, `.party-playlist-stats-remaining-label`, `.party-playlist-stats-not-yet-played`, `.party-playlist-items`, `.party-playlist-empty`, `.party-playlist-group-items`.
- **Элемент списка:** `.party-playlist-item`, `.party-playlist-item-row`, `.party-playlist-item-state`, `.party-playlist-item-circle` (атрибут `data-state`: `current` | `played` | `upcoming` | `disabled`; в круге — иконка или номер), `.party-playlist-item-info`, `.party-playlist-item-name-wrap`, `.party-playlist-item-name`, `.party-playlist-item-name--expanded`, `.party-playlist-item-expand` (кнопка «…»/«×»), `.party-playlist-item-duration`; модификаторы: `.party-playlist-item--track`, `.party-playlist-item--group`, `.party-playlist-item--current`, `.party-playlist-item--played`, `.party-playlist-item--disabled`. Классы `.party-playlist-item-artist` / `.party-playlist-item-path` есть в разметке для расширенных тем.
- **Плеер:** `.party-current-track-display`, `.party-current-track-empty`, `.party-current-track-prev`, `.party-current-track-next`, `.party-current-track-adjacent-label`, `.party-current-track-adjacent-name-wrapper`, `.party-current-track-adjacent-name`, `.party-current-track-adjacent-time`, `.party-current-track-expand-btn`, `.party-current-track-current`, `.party-current-track-info`, `.party-current-track-name-wrapper`, `.party-current-track-name`, `.party-current-track-meta`, `.party-current-track-status`, `.party-current-track-time`, `.party-current-track-progress`, `.party-current-track-progress-bar`.
- **Страница информации:** `.party-info-display`, `.party-info-display-container`, `.party-info-display-inner`, `.party-info-display-title`, `.party-info-display-section`, `.party-info-display-description`, `.party-info-display-meta`, `.party-info-display-meta--top` (когда мета идёт сразу после заголовка).

#### Типичные ошибки и как их избежать

1. **Двойной отступ у элемента плейлиста.** Не задавайте `padding` у `.party-playlist-item`, если уже задаёте отступы у `.party-playlist-item-row`. Внутренние отступы контента — только у строки (12px 24px по эталону). У элемента при необходимости задавайте только `margin` и `border-radius`.
2. **Разный padding у шапки плейлиста.** Используйте все три значения: `20px 24px 16px` (верх, стороны, низ). Пропуск нижнего 16px приводит к визуальному дисбалансу.
3. **Заголовок страницы не по эталону.** Для `.party-display-title` используйте `font-size: clamp(22px, 5vw, 32px)`, а не фиксированный rem/px — иначе на больших экранах заголовок может выглядеть слишком крупно.
4. **Невидимая левая граница у элемента списка.** Базовая разметка задаёт `border-left: 3px solid transparent`. Тема должна задать цвет для состояний, например: `.party-playlist-item--current { border-left-color: var(--selected-border); }`, `.party-playlist-item--played { border-left-color: var(--border-color); }`.
5. **Лишний padding у шапки или контейнера страницы.** Отступы страницы вечеринки задаются у `.party-display-main` (32px 16px). Не добавляйте дополнительный padding у `.party-display-header` или `.party-display-container` — иначе контент отдалится от краёв сильнее, чем в эталоне.
6. **Пустое состояние плеера или списка.** Не задавайте только `height` у пустого блока — используйте `min-height` и при необходимости `padding`, чтобы текст не прилипал к краям при переносе.
7. **Блок плеера и плейлист как один блок.** По эталону это два отдельных блока: у контейнера `gap: 16px`, у плеера и обёртки плейлиста у каждого свой `border-radius: 8px` со всех сторон. Не делайте общее скругление «сверху у плеера, снизу у плейлиста» — так без блока пред/след выглядит неаккуратно.
8. **Заголовок не по центру.** Для единого вида заголовок страницы вечеринки выровнен по центру (`.party-display-header` — `justify-content: center`, `.party-display-header-text` — `align-items: center`, `text-align: center`).

#### Особенности расширенной темы (опционально)

Тема может выходить за рамки «только CSS» и задавать собственный layout, декор и переопределять компоненты. Ниже перечислено, что при этом может использоваться — чтобы такая тема была воспроизводима только по инструкции.

**Собственный layout страницы вечеринки**

- Отдельный файл `layout.css`, подключаемый из `index.css`.
- Классы с суффиксом `--<theme-id>` для изоляции: `.party-display-main--<theme-id>`, `.party-display-header--<theme-id>`, `.party-display-title--<theme-id>`, `.party-display-player--<theme-id>`, `.party-display-playlist-wrapper--<theme-id>`.
- Блок постера: `.party-display-poster`, `.party-display-poster-placeholder` (если изображение не загрузилось), `.party-display-poster-img`. Размеры и скругление задаются в теме (например 180×180px, border-radius 20px).
- Подзаголовок и индикатор сессии: `.party-display-header-text`, `.party-display-subtitle`, `.party-display-session-indicator`, `.party-display-session-dot`, `.party-display-session-label`. Текст метки: «Вечеринка идёт» / «Скоро начнём» в зависимости от состояния сессии.
- Анимация точки сессии: keyframes (например pulse по opacity и scale), применяемая к `.party-display-session-dot`.

**Декоративный фон (например падающие элементы)**

- Контейнер с классом вроде `.party-display-floating-petals`: `position: absolute`, `inset: 0`, `overflow: hidden`, `pointer-events: none`, `z-index` ниже контента. Опционально `mask-image` с вертикальным градиентом для затухания внизу.
- Внутри — абсолютно позиционированные элементы (например `.spring-petal`), каждый с своей позицией `left` (в %), анимацией падения/качания и, при необходимости, CSS-переменными: `--petal-sway-amplitude`, `--petal-sway-direction`, `--petal-rotation-turns` для keyframes.
- Keyframes задаются в теме (например падение по вертикали с горизонтальным смещением и вращением). Рендер самих декоративных элементов (SVG, количество, задержки) остаётся в переопределённом компоненте темы.

**Переопределение компонентов**

- В `createPartyTheme()` передаётся `overrides` с полями: `PartyDisplay`, `PlaylistView`, `CurrentTrackDisplay`, `PartyInfoDisplay` (и при необходимости другими). Так тема может рендерить свою разметку: постер (фиксированный URL изображения, например `/images/<theme-id>-poster.jpg`), декоративный слой, layout с классами `--<theme-id>`.
- Переопределённый `PartyDisplay` обычно включает декоративный контейнер, `main` с классами `party-display-main--<theme-id>`, `header` с постером и индикатором сессии, затем плеер и обёртку плейлиста.
- **Обязательно:** при рендере элементов плейлиста (в своём или базовом `PlaylistView`) каждый элемент в `.map()` должен иметь стабильный `key`. Ключ задаётся в формате `` `${item.id}-${level}-${index}` `` на обёртке элемента (например `<React.Fragment key={…}>`), чтобы React корректно сопоставлял элементы при изменении порядка и вложенных групп.

**Страница информации в стиле вечеринки**

- Переопределённый `PartyInfoDisplay` может повторять структуру страницы вечеринки: тот же декоративный фон, header с постером и заголовком, контент в карточке.
- Классы карточки: `.party-info-display-container--<theme-id>`, внутри `.party-info-display-inner`. Мета-блок (дата, место, город, расписание) может быть без верхней границы — класс `.party-info-display-meta--top`.

**Дополнительные CSS-переменные и анимации**

- Для декора и отменённых треков тема может вводить свои переменные (например `--flower-white`, `--leaf-green`, `--canceled-track`, `--canceled-track-text`).
- Анимации (keyframes) объявляются в CSS темы и используются только её селекторами; имена keyframes выбираются темой.

### Шаг 2: Регистрация PartyTheme в CherryPlayComponents

**2.1. Обновите `CherryPlayComponents/src/themes/index.ts`:**

- Добавьте идентификатор PartyTheme в union type `PartyThemeId`
- Добавьте PartyTheme в объект `PARTY_THEME_REGISTRY` используя функцию `createPartyTheme()`
- Укажите: `id`, `name`, `description`, `cssPath`
- Если PartyTheme поддерживает кастомизацию, укажите `customizationOptions` (массив ключей опций) и добавьте `CustomizationEditor` в папку темы
- Если тема использует собственный layout или декор, передайте в `createPartyTheme()` параметр `overrides` с переопределёнными компонентами: `PartyDisplay`, `PlaylistView`, `CurrentTrackDisplay`, `PartyInfoDisplay` (только нужные)

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

- Реализуйте `CustomizationEditor.tsx` внутри `CherryPlayComponents/src/themes/<theme-id>/`
- Подключите компонент через `overrides.CustomizationEditor` в `PARTY_THEME_REGISTRY`
- В `CherryPlayList/src/workspaces/party/components/PartyEditor.tsx` правки не нужны: он рендерит `theme.components.CustomizationEditor` из контракта темы

**5.3. Обновите обработчик `handleThemeChange` в `CherryPlayList/src/workspaces/party/PartyView.tsx`:**

- Добавьте условие для установки значений по умолчанию для настроек кастомизации новой PartyTheme

## Важные замечания

1. **Идентификатор PartyTheme (`theme-id`)** должен быть в нижнем регистре, использовать дефисы для разделения слов (например, `art-deco`, `my-theme`). Не используйте пробелы или специальные символы.

## Чеклист добавления новой PartyTheme

1. **Автоматическое обновление**: После добавления PartyTheme в библиотеку компонентов она автоматически становится доступной в:
   - CherryPlayWeb (через `isValidPartyTheme()`)
   - CherryPlayList (через массив тем)
   - Всех местах, использующих тип `PartyThemeId` (в API/коде поле `partyThemeId`)

2. **CSS переменные**: Используйте стандартный набор CSS переменных для консистентности:
   - `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`
   - `--text-primary`, `--text-secondary`, `--text-tertiary`
   - `--accent-primary`, `--accent-primary-light`
   - `--border-color`, `--selected-bg`, `--selected-border`

3. **Тестирование**: После добавления PartyTheme:
   - Пересоберите `CherryPlayComponents`: `npm run build`
   - Проверьте отображение в CherryPlayWeb
   - Проверьте выбор PartyTheme в CherryPlayList
   - Проверьте создание вечеринки с новой PartyTheme на сервере
   - Убедитесь, что CSS переменные применяются правильно
   - Если есть настройки кастомизации, проверьте их работу

Используйте этот чеклист для проверки, что все шаги выполнены:

### CherryPlayComponents

- [ ] Создана директория `themes/<theme-id>/`
- [ ] Созданы файлы: `index.css`, `playlist.css`, `playlist-item.css`, `player.css` (при расширенной теме — также `layout.css`, `party-info.css`, при необходимости переопределённые React-компоненты и `overrides` в регистрации)
- [ ] Все селекторы используют `[data-theme="<theme-id>"]`
- [ ] Отступы и размеры соответствуют эталонной сетке (шаг 1); на узком (≤480px) и широком экране поведение одинаковое; при необходимости добавлен медиа-запрос для шапки плейлиста
- [ ] Нет типичных ошибок (раздел «Типичные ошибки и как их избежать»): один источник отступов у элемента плейлиста, видимая левая граница у current/played, заголовок по эталону (clamp) и по центру, padding шапки плейлиста 20px 24px 16px, блоки плеера и плейлиста разделены (gap 16px, у каждого border-radius 8px)
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
- [ ] Добавлен `CustomizationEditor.tsx` в папку темы (если есть кастомизация)
- [ ] Подключён `overrides.CustomizationEditor` в `themes/index.ts` (если есть кастомизация)
- [ ] Обновлен обработчик `handleThemeChange` в `PartyView.tsx` (если есть настройки)

### Тестирование

- [ ] PartyTheme отображается корректно в CherryPlayWeb
- [ ] PartyTheme доступна для выбора в CherryPlayList
- [ ] Можно создать вечеринку с новой PartyTheme на сервере
- [ ] CSS переменные применяются правильно
- [ ] Настройки кастомизации работают (если есть)
- [ ] Все состояния элементов работают (hover, current, played, disabled)

## Уточнения

- **PartyTheme** — визуальный стиль контента вечеринки: плейлист, текущий трек, страница информации. Идентификатор в API и БД — поле `partyThemeId`. Не путать с темой оболочки приложения (тёмная/светлая палитра интерфейса кабинета, списков, логина): PartyTheme задаёт только вид страницы вечеринки для зрителей и в превью.
- Добавление или смена PartyTheme не меняет контракты стриминга и API: плейлист и состояние воспроизведения передаются как обычно; тема влияет только на отображение на стороне клиента.
