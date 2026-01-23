@echo off
REM Скрипт для сборки CherryPlayServer

echo === Сборка CherryPlayServer ===
echo.

where dotnet >nul 2>&1
if %errorlevel% neq 0 (
    echo Ошибка: .NET SDK не найден. Установите .NET SDK.
    pause
    exit /b 1
)

cd CherryPlayServer

echo Сборка сервера...
dotnet build --configuration Release

if %errorlevel% equ 0 (
    echo.
    echo Сервер успешно собран в bin/Release/
) else (
    echo.
    echo Ошибка сборки сервера
    cd ..
    pause
    exit /b 1
)

cd ..
pause

