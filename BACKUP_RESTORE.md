# Backup и Restore PostgreSQL (Prod + Local)

Пошаговая инструкция для CherryPlay:

1. Как сделать backup базы в проде.
2. Как восстановить базу из backup на сервере.
3. Как восстановить backup локально для просмотра данных.

Инструкция рассчитана на текущий стек проекта:

- PostgreSQL в контейнере `cherryplay-postgres`
- pgAdmin в контейнере `cherryplay-pgadmin`
- локальный restore-стенд через `docker-compose.restore-local.yml`

---

## 0) Подготовка

Перед началом убедитесь, что:

- backup-файл создается в формате **Custom** (`pg_dump/pg_restore`);
- у вас есть SSH-доступ к серверу по ключу;
- на сервере и локально доступен Docker.

Рекомендуемый шаблон имени backup:

- `cherryplay_YYYY-MM-DD.dump`

---

## 1) Как сделать backup базы в проде

### Вариант A (через pgAdmin + SSH-туннель)

1. Поднимите SSH-туннель к pgAdmin:

```powershell
ssh -i "C:\path\to\your_key" -L 5050:127.0.0.1:5050 USER@SERVER
```

2. Откройте `http://localhost:5050` и войдите в pgAdmin.
3. Выберите продовую БД и запустите **Backup...**:
   - `Format`: `Custom`
   - `Filename`: `/tmp/cherryplay_YYYY-MM-DD.dump`

Важно: если не указать расширение в `Filename`, pgAdmin может создать файл без `.dump`.

4. Проверьте, что job завершился без ошибок.

### Как достать backup-файл из контейнера pgAdmin

На сервере:

```bash
docker exec -it cherryplay-pgadmin sh -lc 'ls -lah /tmp'
docker cp cherryplay-pgadmin:/tmp/cherryplay_YYYY-MM-DD.dump /tmp/cherryplay_YYYY-MM-DD.dump
ls -lah /tmp/cherryplay_YYYY-MM-DD.dump
```

Скачать на локальный ПК:

```powershell
scp -i "C:\path\to\your_key" USER@SERVER:/tmp/cherryplay_YYYY-MM-DD.dump "D:\Backups\cherryplay_YYYY-MM-DD.dump"
```

### Быстрая валидация backup после скачивания

```powershell
pg_restore -l "D:\Backups\cherryplay_YYYY-MM-DD.dump"
```

---

## 2) Как восстановить backup на сервере

Восстановление в боевую БД выполняйте только в согласованное окно работ.
Для безопасной проверки сначала используйте отдельную тестовую БД.

### 2.1 Restore в тестовую БД внутри продового контейнера PostgreSQL

1. Скопируйте backup внутрь контейнера БД:

```bash
docker cp /tmp/cherryplay_YYYY-MM-DD.dump cherryplay-postgres:/tmp/cherryplay_YYYY-MM-DD.dump
```

2. Создайте тестовую БД:

```bash
docker exec -e PGPASSWORD='<POSTGRES_PASSWORD>' -it cherryplay-postgres \
  psql -U cherryplay -d postgres -c "DROP DATABASE IF EXISTS cherryplay_restore_test;"
docker exec -e PGPASSWORD='<POSTGRES_PASSWORD>' -it cherryplay-postgres \
  psql -U cherryplay -d postgres -c "CREATE DATABASE cherryplay_restore_test;"
```

3. Восстановите backup:

```bash
docker exec -e PGPASSWORD='<POSTGRES_PASSWORD>' -it cherryplay-postgres \
  pg_restore -U cherryplay -d cherryplay_restore_test --clean --if-exists /tmp/cherryplay_YYYY-MM-DD.dump
```

4. Проверьте, что таблицы восстановились:

```bash
docker exec -e PGPASSWORD='<POSTGRES_PASSWORD>' -it cherryplay-postgres \
  psql -U cherryplay -d cherryplay_restore_test -c "\dt"
```

### 2.2 Restore в боевую БД (только при необходимости)

Если нужно восстановить именно `cherryplay`, команда будет аналогичной, но с целевой БД `cherryplay`:

```bash
docker exec -e PGPASSWORD='<POSTGRES_PASSWORD>' -it cherryplay-postgres \
  pg_restore -U cherryplay -d cherryplay --clean --if-exists /tmp/cherryplay_YYYY-MM-DD.dump
```

После restore проверьте:

- доступность API (`/api/health`);
- основные бизнес-сценарии (логин, список вечеринок, карточка вечеринки, админ-страницы).

---

## 3) Как восстановить backup локально

В проекте есть отдельный compose-файл: `docker-compose.restore-local.yml`.
Он поднимает:

- `restore-db` (PostgreSQL) на `127.0.0.1:55432`
- `restore-pgadmin` на `http://localhost:5051`

### 3.1 Подготовить backup

Положите dump в папку `backups/` в корне проекта, например:

- `backups/cherryplay_YYYY-MM-DD.dump`

### 3.2 Поднять локальный restore-стенд

```bash
docker compose -f docker-compose.restore-local.yml up -d
```

### 3.3 Выполнить restore в локальную БД

```bash
docker exec -e PGPASSWORD=cherryplay_restore_password -it cherryplay-restore-db \
  pg_restore -U cherryplay -d cherryplay_restore_preview --clean --if-exists /backups/cherryplay_YYYY-MM-DD.dump
```

### 3.4 Открыть и посмотреть данные через pgAdmin

1. Откройте `http://localhost:5051`
2. Вход в pgAdmin (по умолчанию):
   - `Email`: `restore@local.dev`
   - `Password`: `restore_pgadmin_password`
3. Добавьте сервер:
   - `Host`: `restore-db`
   - `Port`: `5432`
   - `Username`: `cherryplay`
   - `Password`: `cherryplay_restore_password`

### 3.5 Остановить и очистить локальный стенд

```bash
docker compose -f docker-compose.restore-local.yml down -v
```

---

## Рекомендации по безопасности

- Не храните реальные пароли БД и pgAdmin в репозитории.
- После любого риска утечки ротируйте пароли (`POSTGRES_PASSWORD`, `PGADMIN_PASSWORD`).
- Минимум раз в месяц делайте тестовый restore и фиксируйте результат в операционном журнале.
