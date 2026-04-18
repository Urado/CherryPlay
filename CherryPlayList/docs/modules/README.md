# Модули CherryPlayList

Краткая документация по основным модулям проекта.

## Интеграция приложение — сервер — веб

Подсистемы, связывающие CherryPlayList, CherryPlayServer и CherryPlayWeb (авторизация, управление вечеринками, стриминг, контракты), описаны в отдельном разделе и согласованы с [планом релиза v1](../../../RELEASE_PLAN.md):

- **[Интеграция (обзор)](../../../docs/integration/README.md)** — обзор подсистем, роли, ссылки на CONTRACTS, DATABASE и модули (Party, Streaming, Player). Документация в корне репозитория.

Под **модулями** в этом разделе понимаются **только**:

- **Workspaces** — самостоятельные рабочие области приложения.
- **Systems** — крупные инфраструктурные подсистемы (drag-and-drop, undo/redo, streaming, demo player и т.п.).

Stores, сервисы, хуки и утилиты считаются поддерживающей инфраструктурой и описаны отдельно.

## Список модулей

### Workspaces (модули)

- [Playlist](./workspaces/playlist.md) - Модуль основного плейлиста
- [Collections](./workspaces/collections.md) - Коллекции (облегчённые плейлисты)
- [File Browser](./workspaces/file-browser.md) - Обозреватель файлов
- [Player](./workspaces/player.md) - Модуль плеера для автоматического воспроизведения и сессий
- [Party](./workspaces/party.md) - Модуль вечеринки с трансляцией
- [AIMP](./workspaces/aimp.md) - Панель AIMP: мониторинг плейлиста/воспроизведения и стриминг на сайт (Windows x64, источник AIMP)
- [Test Zone](./workspaces/test-zone.md) - Тестовый модуль для проверки layout и реестра workspace

### Systems (модули)

- [Drag and Drop](./systems/drag-and-drop.md) - Система перетаскивания треков и групп между workspace
- [Undo/Redo](./systems/undo-redo.md) - Система отмены и повтора действий на базе Command Pattern
- [Layout System](./systems/layout-system.md) - Система управления layout интерфейса
- [Storage](./systems/storage.md) — обзор клиентского persist; подробнее: [архитектура](./systems/storage-architecture.md), [что храним](./systems/persisted-client-state.md)
- [Demo Player](./systems/demo-player.md) - Глобальная система предпрослушивания треков без очереди
- [Commands System](./systems/commands-system.md) - Командная система, лежащая в основе undo/redo
- [Streaming](./systems/streaming.md) - Система трансляции состояния плейлиста для вечеринок
- [Save / Load](./systems/save-load.md) - Система сохранения и загрузки проектов (.cherry формат, портативный режим)

## Supporting infrastructure (не модули в строгом смысле)

Эти части системы не считаются модулями, но являются важной инфраструктурой, которую используют модули.

### Stores

- [Project Store](./stores/project-store.md) - Главный store проекта с треками, группами и сессией
- [UI Store](./stores/ui-store.md) - Глобальный store UI состояния и layout
- [Settings Store](./stores/settings-store.md) - Store настроек приложения

### Сервисы

- [Export](./services/export.md) - Сервис экспорта плейлистов
- [IPC Service](./services/ipc-service.md) - Сервис IPC коммуникации с Electron
- [Project Service](./services/project-service.md) - Сервис работы с файлами проектов

### Hooks & Utils

- [Keyboard Shortcuts](./hooks-utils/keyboard-shortcuts.md) - Hook для клавиатурных сокращений
