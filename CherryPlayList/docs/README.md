# Документация CherryPlayList

Оглавление документации десктопного приложения организатора.

---

## Входные документы

- **[TECHNICAL.md](../TECHNICAL.md)** — техническая документация: стек, архитектура, структура проекта, IPC, хранение данных, интеграция с сервером и вебом.
- **[README.md](../README.md)** — описание проекта, основные функции, установка и запуск.
- **[web-demo.md](web-demo.md)** — веб-демо в браузере: fixtures (`dev:web`, `dev:web:project`) и live (`dev:web:live` / `VITE_DEMO_LIVE`), Vite proxy, Online/сеть, ограничения режима.
- **[layout-edit-mode.md](layout-edit-mode.md)** — рабочие пространства (Premiere-style): pill + ✎, автосохранение layout, inline-переименование, нумерация «Без имени», добавление/удаление зон.
- **[android-capacitor-brief.md](android-capacitor-brief.md)** — план Android/Capacitor (этапы 0–6).

---

## Разделы документации

### Интеграция приложение — сервер — веб

Подсистемы, связывающие CherryPlayList с CherryPlayServer и CherryPlayWeb (авторизация, вечеринки, стриминг). Общая документация вынесена в корень репозитория.

- **[docs/integration/](../../docs/integration/)** — обзор подсистем (Accounts & Auth, Party Management, Streaming, Data and Contracts, **AIMP как источник стриминга**), роли, ссылки на CONTRACTS, DATABASE и README сервера/веба.

### Модули приложения

- **[modules/README.md](modules/README.md)** — список модулей: Workspaces (Playlist, Collections / **«Подборка»**, File Browser / **«Файлы»**, Player, Party, AIMP, Test Zone) и Systems (Drag and Drop, Undo/Redo, Layout / **Рабочие окна**, **Storage** — см. также [архитектура клиентского хранения](modules/systems/storage-architecture.md) и [что хранится в persist](modules/systems/persisted-client-state.md), Demo Player / **«Предпросмотр (только у вас)»**, Commands, Streaming); инфраструктура: **[Platform layer](modules/platform/README.md)** (capabilities, guards).
- Документация по каждому модулю — по ссылкам из modules/README.md (workspaces/_.md, systems/_.md, stores/_.md, services/_.md).

### Проверка и релиз

- **[AIMP E2E Verification](AIMP_E2E_VERIFICATION.md)** — чеклист сквозной проверки AIMP → приложение → сайт (релизный gate). См. также [AIMP Streaming (интеграция)](../../docs/integration/aimp-streaming.md) и [плагин AIMP](../../CherryPlayAimpPlugin/README.md).

---

## Документация в корне репозитория

- **[RELEASE_PLAN.md](../../RELEASE_PLAN.md)** — план релиза v1.
- **[CONTRACTS.md](../../CONTRACTS.md)** — REST API и SignalR контракты.
- **[docs/integration/streaming.md](../../docs/integration/streaming.md)** — стриминг (потоки, контракты, ссылки на CONTRACTS и модули).
- **[DEV_SETUP.md](../../DEV_SETUP.md)** — настройка окружения для разработки всего стека.
- **[GLOSSARY.md](../../GLOSSARY.md)** — глоссарий терминов.
