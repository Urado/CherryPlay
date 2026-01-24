@echo off
REM Скрипт для сборки CherryPlayWeb

echo === Сборка CherryPlayWeb ===
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Ошибка: Node.js не найден. Установите Node.js.
    exit /b 1
)

cd CherryPlayWeb

if not exist "node_modules" (
    echo Установка зависимостей...
    call npm install
)

echo Сборка веб-приложения...
call npm run build

if %errorlevel% equ 0 (
    echo.
    echo Веб-приложение успешно собрано в dist/
) else (
    echo.
    echo Ошибка сборки веб-приложения
    cd ..
    exit /b 1
)

cd ..

