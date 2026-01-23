@echo off
REM Скрипт для сборки CherryPlayComponents

echo === Сборка CherryPlayComponents ===
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Ошибка: Node.js не найден. Установите Node.js.
    pause
    exit /b 1
)

cd CherryPlayComponents

if not exist "node_modules" (
    echo Установка зависимостей...
    call npm install
)

echo Сборка компонентов...
call npm run build

if %errorlevel% equ 0 (
    echo.
    echo Компоненты успешно собраны в dist/
) else (
    echo.
    echo Ошибка сборки компонентов
    cd ..
    pause
    exit /b 1
)

cd ..
pause

