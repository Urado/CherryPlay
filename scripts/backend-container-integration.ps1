param(
    [string]$ProjectName
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repositoryRoot

if ([string]::IsNullOrWhiteSpace($ProjectName)) {
    if ([string]::IsNullOrWhiteSpace($env:COMPOSE_PROJECT_NAME)) {
        $ProjectName = "cherryplay-it-local-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
    }
    else {
        $ProjectName = $env:COMPOSE_PROJECT_NAME
    }
}

$env:COMPOSE_PROJECT_NAME = $ProjectName
$artifactRelativePath = "./artifacts/backend-container-integration/$ProjectName"
$env:CHERRYPLAY_INTEGRATION_ARTIFACTS_DIR = $artifactRelativePath
$artifactDirectory = Join-Path $repositoryRoot "artifacts/backend-container-integration/$ProjectName"
$null = New-Item -ItemType Directory -Path $artifactDirectory -Force
$composeArguments = @("--project-name", $ProjectName, "--file", "docker-compose.integration-tests.yml")
$composeLogPath = Join-Path $artifactDirectory "compose-commands.log"
$exitCode = 0

function Invoke-Compose {
    param([string[]]$Arguments)

    & docker compose @script:composeArguments @Arguments 2>&1 | Tee-Object -FilePath $script:composeLogPath -Append
    $composeExitCode = $LASTEXITCODE
    if ($composeExitCode -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed with exit code $composeExitCode."
    }
}

function Invoke-TestCategory {
    param(
        [string]$Category,
        [string]$ArtifactName
    )

    $resultDirectory = "/artifacts/$ArtifactName"
    $logPath = Join-Path $script:artifactDirectory "$ArtifactName.log"
    $arguments = @(
        "run", "--rm", "integration-tests",
        "dotnet", "test", "CherryPlayServer.Tests/CherryPlayServer.Tests.csproj",
        "--configuration", "Release", "--no-restore", "--filter", "Category=$Category",
        "--results-directory", $resultDirectory,
        "--logger", "trx;LogFileName=$ArtifactName.trx",
        "--collect:XPlat Code Coverage"
    )
    & docker compose @script:composeArguments @arguments *> $logPath
    $testExitCode = $LASTEXITCODE
    Get-Content -Path $logPath -Tail 100
    if ($testExitCode -ne 0) {
        throw "Container test category $Category failed with exit code $testExitCode. See $logPath."
    }
}

function Invoke-FastTests {
    $projectPath = "CherryPlayServer.Tests/CherryPlayServer.Tests.csproj"
    $restoreLogPath = Join-Path $script:artifactDirectory "fast-restore.log"
    & dotnet restore $projectPath *> $restoreLogPath
    $restoreExitCode = $LASTEXITCODE
    if ($restoreExitCode -ne 0) {
        Get-Content -Path $restoreLogPath -Tail 100
        throw "Fast test restore failed with exit code $restoreExitCode. See $restoreLogPath."
    }

    $resultDirectory = Join-Path $script:artifactDirectory "fast"
    $null = New-Item -ItemType Directory -Path $resultDirectory -Force
    $testLogPath = Join-Path $script:artifactDirectory "fast-tests.log"
    $filter = "Category!=IntegrationDb&Category!=ContainerIntegration&Category!=ContainerRestartPrepare&Category!=ContainerRestartVerify&Category!=ContainerRestartFreezePrepare&Category!=ContainerRestartFreezeVerify&Category!=ContainerRetentionPrepare&Category!=ContainerRetentionVerify"
    $arguments = @(
        "test", $projectPath, "--configuration", "Release", "--no-restore",
        "--filter", $filter,
        "--results-directory", $resultDirectory,
        "--logger", "trx;LogFileName=fast-tests.trx",
        "--collect:XPlat Code Coverage"
    )
    & dotnet @arguments *> $testLogPath
    $testExitCode = $LASTEXITCODE
    Get-Content -Path $testLogPath -Tail 100
    if ($testExitCode -ne 0) {
        throw "Fast tests failed with exit code $testExitCode. See $testLogPath."
    }
}

function Invoke-DatabaseUnavailableCheck {
    $logPath = Join-Path $script:artifactDirectory "database-unavailable.log"
    $invalidConnectionString = "ConnectionStrings__DefaultConnection=Host=unavailable-db.invalid;Port=5432;Database=cherryplay_it_run;Username=postgres;Password=cherryplay_it_password"
    & docker compose @script:composeArguments run --rm --no-deps -e $invalidConnectionString backend *> $logPath
    $containerExitCode = $LASTEXITCODE
    Get-Content -Path $logPath -Tail 100
    if ($containerExitCode -eq 0) {
        throw "The backend unexpectedly started with an unavailable database host."
    }

    $logText = Get-Content -Path $logPath -Raw
    if ($logText -notmatch "Npgsql|PostgreSQL|Connection refused|name or service not known|Name or service not known|No such host") {
        throw "The database-unavailable check failed without an actionable PostgreSQL connection diagnostic. See $logPath."
    }
}

try {
    Invoke-FastTests
    Invoke-Compose @("build", "backend", "integration-tests")
    Invoke-Compose @("up", "--detach", "--wait", "--wait-timeout", "240", "postgres", "backend")
    Invoke-TestCategory "ContainerIntegration" "container-integration"
    Invoke-TestCategory "ContainerRestartPrepare" "restart-prepare"
    Invoke-TestCategory "ContainerRestartFreezePrepare" "restart-freeze-prepare"
    Invoke-TestCategory "ContainerRetentionPrepare" "retention-prepare"
    Invoke-Compose @("restart", "backend")
    Invoke-Compose @("up", "--detach", "--wait", "--wait-timeout", "240", "backend")
    Invoke-TestCategory "ContainerRestartVerify" "restart-verify"
    Invoke-TestCategory "ContainerRestartFreezeVerify" "restart-freeze-verify"
    Invoke-TestCategory "ContainerRetentionVerify" "retention-verify"
    Invoke-DatabaseUnavailableCheck
}
catch {
    $exitCode = 1
    Write-Error $_.Exception.Message -ErrorAction Continue
}
finally {
    $serviceLogPath = Join-Path $artifactDirectory "services.log"
    & docker compose @composeArguments logs --no-color *> $serviceLogPath
    try {
        Invoke-Compose @("down", "--volumes", "--remove-orphans")
    }
    catch {
        if ($exitCode -eq 0) {
            $exitCode = 1
        }
        Add-Content -Path $serviceLogPath -Value $_.Exception.Message
    }
    Pop-Location
}

exit $exitCode
