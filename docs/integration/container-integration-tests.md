# Контейнерные интеграционные тесты backend

Сценарий сначала запускает быстрые unit tests с локальным .NET SDK, затем поднимает PostgreSQL, production backend и .NET integration test runner в отдельных контейнерах. HTTP и SignalR тесты обращаются к серверу по имени `server`; backend и эти тесты используют общую базу `cherryplay_it_run`. PostgreSQL repository tests могут создавать дочерние изолированные базы в том же контейнере PostgreSQL. Compose project и его именованный volume изолированы от других запусков.

Для локального запуска нужен Docker Engine и Docker Compose:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend-container-integration.ps1
```

Сценарий собирает образы, ждёт готовности PostgreSQL и `GET /api/health`, запускает контейнерные HTTP, SignalR и PostgreSQL тесты, записывает активное и завершённое состояние вечеринки, добавляет старые и действующие reset-token записи, перезапускает только backend и проверяет восстановление сессий и очистку старых токенов. Затем он проверяет поведение запуска при недоступной базе. TRX, coverage и логи сохраняются в `artifacts/backend-container-integration/<project-name>/`. Временные контейнеры, сеть и volume удаляются только для созданного Compose project.

Workflow `.github/workflows/backend-container-integration.yml` запускает тот же PowerShell сценарий для pull request в `main` и `develop`, push в `main` и вручную через `workflow_dispatch`. Он прикладывает результаты и логи как GitHub Actions artifact.

Стабильное имя обязательной GitHub Actions проверки — `Container Integration Tests`. Настройка branch protection или repository ruleset остаётся в GitHub: добавьте этот check как required status check для `main` после первого успешного запуска workflow.

Fast tests исключают категории `IntegrationDb` и контейнерные категории; PostgreSQL suite остаётся отдельным check в workflow `Server Tests`.
