# Скрипт для сборки всех проектов

Write-Host "=== Сборка всех проектов CherryPlay ===" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Stop"

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

$buildErrors = @()

# 1. Сборка компонентов
Write-Host "[1/4] Сборка CherryPlayComponents..." -ForegroundColor Cyan
Set-Location CherryPlayComponents
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Установка зависимостей..." -ForegroundColor Yellow
        npm install
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка сборки компонентов"
    }
    Write-Host "  ✓ Компоненты собраны" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка сборки компонентов" -ForegroundColor Red
    $buildErrors += "CherryPlayComponents"
}
Set-Location ..

# 2. Сборка сервера
Write-Host "[2/4] Сборка CherryPlayServer..." -ForegroundColor Cyan
Set-Location CherryPlayServer
try {
    dotnet build --configuration Release
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка сборки сервера"
    }
    Write-Host "  ✓ Сервер собран" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка сборки сервера" -ForegroundColor Red
    $buildErrors += "CherryPlayServer"
}
Set-Location ..

# 3. Сборка веб-приложения
Write-Host "[3/4] Сборка CherryPlayWeb..." -ForegroundColor Cyan
Set-Location CherryPlayWeb
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Установка зависимостей..." -ForegroundColor Yellow
        npm install
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка сборки веб-приложения"
    }
    Write-Host "  ✓ Веб-приложение собрано" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка сборки веб-приложения" -ForegroundColor Red
    $buildErrors += "CherryPlayWeb"
}
Set-Location ..

# 4. Сборка десктопного приложения
Write-Host "[4/4] Сборка CherryPlayList..." -ForegroundColor Cyan
Set-Location CherryPlayList
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Установка зависимостей..." -ForegroundColor Yellow
        npm install
    }
    npm run build:electron
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка сборки десктопного приложения"
    }
    Write-Host "  ✓ Десктопное приложение собрано" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка сборки десктопного приложения" -ForegroundColor Red
    $buildErrors += "CherryPlayList"
}
Set-Location ..

Write-Host ""
if ($buildErrors.Count -eq 0) {
    Write-Host "=== Все проекты успешно собраны ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Результаты сборки:" -ForegroundColor Yellow
    Write-Host "  - CherryPlayComponents: dist/" -ForegroundColor Gray
    Write-Host "  - CherryPlayServer: bin/Release/" -ForegroundColor Gray
    Write-Host "  - CherryPlayWeb: dist/" -ForegroundColor Gray
    Write-Host "  - CherryPlayList: dist/ и dist-electron/" -ForegroundColor Gray
} else {
    Write-Host "=== Сборка завершена с ошибками ===" -ForegroundColor Red
    Write-Host "Ошибки в проектах: $($buildErrors -join ', ')" -ForegroundColor Red
    exit 1
}

