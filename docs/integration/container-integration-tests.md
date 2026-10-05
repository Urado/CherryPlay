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

`dotnet test` не применяет скрытый фильтр категорий: обычный запуск выполняет все тесты, а `--filter` выбирает ровно указанные категории. Например, `dotnet test CherryPlayServer.Tests/CherryPlayServer.Tests.csproj --filter "Category=IntegrationDb"` запускает PostgreSQL integration tests; при стандартной конфигурации им нужен доступный Docker Engine. Fast suite в CI и в контейнерном сценарии задаёт исключения категорий явно, поэтому локальный выбор `--filter` не конфликтует с ним. Файл `CherryPlayServer.Tests.runsettings` применяется только при явном `-p:CherryPlayUseDefaultTestFilter=true`.

## Два вида PostgreSQL-интеграционных тестов

`IntegrationDb` — тесты persistence и сервисов, которые запускают приложение внутри тестового процесса. `PostgresContainerFixture` по умолчанию поднимает PostgreSQL 16 через Testcontainers и создаёт изолированные базы. Нужен работающий Docker Engine; вручную задавать `CHERRYPLAY_*` переменные не требуется. При необходимости `CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING` переопределяет контейнер и указывает на существующий PostgreSQL admin endpoint; удалённый хост по умолчанию запрещён, для явного разрешения используется `CHERRYPLAY_INTEGRATION_DB_ALLOW_REMOTE_ADMIN=true`.

`ContainerIntegration` — смешанная категория. DB-only тесты через `ContainerIntegrationDatabase` создают и удаляют изолированные базы, поэтому при прямом запуске им достаточно `CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING`, указывающей на уже работающий PostgreSQL admin endpoint. HTTP/SignalR тесты используют `ContainerIntegrationTestContext`: помимо подключения к БД им нужны `CHERRYPLAY_API_BASE_URL` для уже работающего backend и `CHERRYPLAY_INTEGRATION_JWT_SECRET_KEY` для выпуска принимаемых им JWT. Сам `dotnet test` не запускает эти сервисы.

Для обычного локального прогона используйте приведённый выше `scripts/backend-container-integration.ps1`: Docker Compose поднимает PostgreSQL и backend, передаёт необходимые значения контейнеру тестов и выполняет все тестовые поднаборы и restart-проверки. Поэтому вручную задавать эти переменные при штатном запуске скрипта не нужно.
