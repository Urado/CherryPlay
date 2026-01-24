@echo off
REM Скрипт для сборки всех проектов

echo === Сборка всех проектов CherryPlay ===
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

set BUILD_ERRORS=0

REM 1. Сборка компонентов
echo [1/3] Сборка CherryPlayComponents...
cd CherryPlayComponents
if not exist "node_modules" (
    echo   Установка зависимостей...
    call npm install
)
call npm run build
if %errorlevel% neq 0 (
    echo   Ошибка сборки компонентов
    set /a BUILD_ERRORS+=1
) else (
    echo   Компоненты собраны
)
cd ..

REM 2. Сборка сервера
echo [2/3] Сборка CherryPlayServer...
cd CherryPlayServer
dotnet build --configuration Release
if %errorlevel% neq 0 (
    echo   Ошибка сборки сервера
    set /a BUILD_ERRORS+=1
) else (
    echo   Сервер собран
)
cd ..

REM 3. Сборка веб-приложения
echo [3/3] Сборка CherryPlayWeb...
cd CherryPlayWeb
if not exist "node_modules" (
    echo   Установка зависимостей...
    call npm install
)
call npm run build
if %errorlevel% neq 0 (
    echo   Ошибка сборки веб-приложения
    set /a BUILD_ERRORS+=1
) else (
    echo   Веб-приложение собрано
)
cd ..

echo.
if %BUILD_ERRORS% equ 0 (
    echo === Все проекты успешно собраны ===
    echo.
    echo Результаты сборки:
    echo   - CherryPlayComponents: dist/
    echo   - CherryPlayServer: bin/Release/
    echo   - CherryPlayWeb: dist/
) else (
    echo === Сборка завершена с ошибками ===
    exit /b 1
)

