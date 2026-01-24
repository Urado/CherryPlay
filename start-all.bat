@echo off
REM Скрипт для запуска всех сервисов
REM Запускает сервер и веб-приложение параллельно

echo === Запуск всех сервисов CherryPlay ===
echo.

REM Проверка наличия .NET SDK
where dotnet >nul 2>&1
if %errorlevel% neq 0 (
    echo Ошибка: .NET SDK не найден. Установите .NET SDK.
    exit /b 1
)

REM Проверка наличия Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Ошибка: Node.js не найден. Установите Node.js.
    exit /b 1
)

REM Проверка установки зависимостей веб-приложения
if not exist "CherryPlayWeb\node_modules" (
    echo Установка зависимостей веб-приложения...
    cd CherryPlayWeb
    call npm install
    cd ..
)

REM Проверка установки зависимостей компонентов
if not exist "CherryPlayComponents\node_modules" (
    echo Установка зависимостей компонентов...
    cd CherryPlayComponents
    call npm install
    cd ..
)

echo Запуск сервера (CherryPlayServer)...
start "CherryPlay Server" cmd /k "cd /d %~dp0CherryPlayServer && dotnet run"

REM Небольшая задержка для запуска сервера
timeout /t 3 /nobreak >nul

echo Запуск веб-приложения (CherryPlayWeb)...
start "CherryPlay Web" cmd /k "cd /d %~dp0CherryPlayWeb && npm run dev"

echo.
echo === Сервисы запущены ===
echo Сервер: http://localhost:5000
echo Веб-приложение: http://localhost:3000
echo.
echo Закройте окна сервисов для их остановки.

