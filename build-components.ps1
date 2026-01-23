# Скрипт для сборки CherryPlayComponents

Write-Host "=== Сборка CherryPlayComponents ===" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Stop"

# Проверка наличия Node.js
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Host "Ошибка: Node.js не найден. Установите Node.js." -ForegroundColor Red
    exit 1
}

Set-Location CherryPlayComponents

if (-not (Test-Path "node_modules")) {
    Write-Host "Установка зависимостей..." -ForegroundColor Yellow
    npm install
}

Write-Host "Сборка компонентов..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Компоненты успешно собраны в dist/" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "✗ Ошибка сборки компонентов" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

