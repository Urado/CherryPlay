# Документация CherryPlayList

Оглавление документации десктопного приложения организатора.

---

## Входные документы

- **[TECHNICAL.md](../TECHNICAL.md)** — техническая документация: стек, архитектура, структура проекта, IPC, хранение данных, интеграция с сервером и вебом.
- **[README.md](../README.md)** — описание проекта, основные функции, установка и запуск.

---

## Разделы документации

### Интеграция приложение — сервер — веб

Подсистемы, связывающие CherryPlayList с CherryPlayServer и CherryPlayWeb (авторизация, вечеринки, стриминг). Общая документация вынесена в корень репозитория.

- **[docs/integration/](../../docs/integration/)** — обзор подсистем (Accounts & Auth, Party Management, Streaming, Data and Contracts), роли, ссылки на CONTRACTS, DATABASE и README сервера/веба.

### Модули приложения

- **[modules/README.md](modules/README.md)** — список модулей: Workspaces (Playlist, Collections, File Browser, Player, Party, Test Zone) и Systems (Drag and Drop, Undo/Redo, Layout, Storage, Demo Player, Commands, Streaming).
- Документация по каждому модулю — по ссылкам из modules/README.md (workspaces/*.md, systems/*.md, stores/*.md, services/*.md).

---

## Документация в корне репозитория

- **[RELEASE_PLAN.md](../../RELEASE_PLAN.md)** — план релиза v1.
- **[CONTRACTS.md](../../CONTRACTS.md)** — REST API и SignalR контракты.
- **[docs/integration/streaming.md](../../docs/integration/streaming.md)** — стриминг (потоки, контракты, ссылки на CONTRACTS и модули).
- **[DEV_SETUP.md](../../DEV_SETUP.md)** — настройка окружения для разработки всего стека.
- **[GLOSSARY.md](../../GLOSSARY.md)** — глоссарий терминов.
