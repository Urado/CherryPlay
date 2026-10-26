# Локальная Grafana и pgAdmin через SSH-туннель

Production Compose оставляет Prometheus, Loki, Alloy, PostgreSQL, exporters и их данные на VPS. Grafana и pgAdmin запускаются локально через Docker Desktop; их обращения к серверным сервисам проходят через SSH-туннель. Интерфейсы опубликованы только на `127.0.0.1` локального компьютера.

## Подготовить доступ

1. Установите Docker Desktop с Docker Compose и проверьте, что в PowerShell доступна команда `ssh`.
2. Откройте `local-admin-tools/start-local-admin-tools.ps1` и замените `YOUR_SITE_HOSTNAME`, `YOUR_SSH_USERNAME` и `YOUR_SSH_KEY` на hostname сервера, SSH-пользователя и путь к закрытому ключу. Не помещайте ключ в репозиторий.
3. Убедитесь, что в `%USERPROFILE%\.ssh\known_hosts` есть проверенная запись для сервера. Сверьте fingerprint ключа сервера по доверенному каналу; не отключайте проверку host key.
4. Скопируйте `local-admin-tools/.env.example` в `local-admin-tools/.env`. Установите отдельные локальные пароли Grafana и pgAdmin и email для входа в pgAdmin. Не используйте пароль PostgreSQL как пароль входа в UI.

## Запустить интерфейсы

В PowerShell из корня репозитория выполните:

```powershell
& .\local-admin-tools\start-local-admin-tools.ps1
```

Скрипт сначала собирает и запускает SSH-tunnel service. Grafana и pgAdmin стартуют после того, как туннель проверил доступность Prometheus, Loki и PostgreSQL. Откройте:

- Grafana: [http://localhost:3001](http://localhost:3001). Используйте локальный пароль из `GRAFANA_ADMIN_PASSWORD`; папка **CherryPlay** содержит dashboard **Обзор CherryPlay**.
- pgAdmin: [http://localhost:5051](http://localhost:5051). Войдите с `PGADMIN_DEFAULT_EMAIL` и `PGADMIN_DEFAULT_PASSWORD` из локального `.env`. Сервер **CherryPlay PostgreSQL** настроен на `ssh-tunnel:5433`; при первом подключении введите пароль `POSTGRES_PASSWORD`, полученный отдельно у владельца базы.

Не закрывайте окно PowerShell, пока нужны UI и туннели. Нажмите Enter в окне скрипта, чтобы остановить контейнеры. Если закрыть процесс принудительно, из корня `local-admin-tools` выполните `docker compose --env-file .env -f compose.yml down`.

## Серверные порты

На VPS Prometheus слушает `127.0.0.1:19090`, Loki — `127.0.0.1:13100`, PostgreSQL — `127.0.0.1:5433`. Они не должны публиковаться на внешнем интерфейсе. SSH-туннель пересылает эти loopback-порты только во внутреннюю сеть локального Compose; локальные UI доступны только на loopback компьютера.

После production deploy проверьте на VPS `docker compose -f docker-compose.prod.yml ps` и `docker compose -f docker-compose.prod.yml logs --tail=100 prometheus loki alloy postgres`. Затем запустите локальный скрипт и проверьте:

- Grafana datasource Prometheus и Loki показывают **Healthy**.
- В dashboard доступны HTTP-метрики и текущие подключения PartyHub; в Explore Loki возвращает свежие серверные логи.
- pgAdmin открывает сервер PostgreSQL и выполняет read-only запрос, например `SELECT current_database(), now();`.
- На VPS Prometheus, Loki, Alloy, exporters и PostgreSQL остаются запущены, сайт и health endpoints работают. Команда `ss -lntp` показывает `127.0.0.1:19090`, `127.0.0.1:13100` и `127.0.0.1:5433`; проверьте, что эти порты не опубликованы на публичном интерфейсе и не разрешены в firewall.

Только после успешных проверок остановите старые UI-контейнеры, которые могли остаться от предыдущего production Compose:

```bash
docker rm -f cherryplay-grafana cherryplay-pgadmin
```

Команда удаляет только два контейнера и не удаляет Docker volumes. Текущие compose definitions сохраняют `grafana_data` и `pgadmin_data`; проверьте соответствие имён volumes в `docker volume ls` перед любыми операциями с данными. Не используйте `docker compose down -v`.

## Откат

Если локальные интерфейсы или туннель недоступны, остановите локальный compose. Сбор метрик и логов, работа PostgreSQL и приложения на VPS продолжаются. Для временного возврата серверных UI восстановите предыдущую версию `docker-compose.prod.yml` с определениями Grafana и pgAdmin и выполните обычный deploy; сохранённые `grafana_data` и `pgadmin_data` остаются доступными в том же Compose project. После повторной проверки удалите восстановленные UI только согласованным отдельным действием.
