# Скрипт для запуска всех сервисов
# Запускает сервер и веб-приложение параллельно

Write-Host "=== Запуск всех сервисов CherryPlay ===" -ForegroundColor Green
Write-Host ""

# Проверка наличия .NET SDK
$dotnetInstalled = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetInstalled) {
    Write-Host "Ошибка: .NET SDK не найден. Установите .NET SDK." -ForegroundColor Red
    exit 1
}

# Проверка наличия Node.js
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Host "Ошибка: Node.js не найден. Установите Node.js." -ForegroundColor Red
    exit 1
}

# Проверка установки зависимостей веб-приложения
if (-not (Test-Path "CherryPlayWeb\node_modules")) {
    Write-Host "Установка зависимостей веб-приложения..." -ForegroundColor Yellow
    Set-Location CherryPlayWeb
    npm install
    Set-Location ..
}

# Проверка установки зависимостей компонентов
if (-not (Test-Path "CherryPlayComponents\node_modules")) {
    Write-Host "Установка зависимостей компонентов..." -ForegroundColor Yellow
    Set-Location CherryPlayComponents
    npm install
    Set-Location ..
}

Write-Host "Запуск сервера (CherryPlayServer)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\CherryPlayServer'; dotnet run" -WindowStyle Normal

# Небольшая задержка для запуска сервера
Start-Sleep -Seconds 3

Write-Host "Запуск веб-приложения (CherryPlayWeb)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\CherryPlayWeb'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "=== Сервисы запущены ===" -ForegroundColor Green
Write-Host "Сервер: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Веб-приложение: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Сервисы запущены в отдельных окнах." -ForegroundColor Gray
Write-Host "Закройте окна сервисов для их остановки." -ForegroundColor Gray

