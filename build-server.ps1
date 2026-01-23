# Скрипт для сборки CherryPlayServer

Write-Host "=== Сборка CherryPlayServer ===" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Stop"

# Проверка наличия .NET SDK
$dotnetInstalled = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetInstalled) {
    Write-Host "Ошибка: .NET SDK не найден. Установите .NET SDK." -ForegroundColor Red
    exit 1
}

Set-Location CherryPlayServer

Write-Host "Сборка сервера..." -ForegroundColor Cyan
dotnet build --configuration Release

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Сервер успешно собран в bin/Release/" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "✗ Ошибка сборки сервера" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

