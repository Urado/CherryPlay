$ErrorActionPreference = "Stop"

$SiteHostName = "YOUR_SITE_HOSTNAME"
$SshUserName = "YOUR_SSH_USERNAME"
$SshPrivateKeyPath = Join-Path $env:USERPROFILE ".ssh\YOUR_SSH_KEY"
$SshKnownHostsPath = Join-Path $env:USERPROFILE ".ssh\known_hosts"
$ComposeFile = Join-Path $PSScriptRoot "compose.yml"
$EnvironmentFile = Join-Path $PSScriptRoot ".env"

if ($SiteHostName -eq "YOUR_SITE_HOSTNAME" -or $SshUserName -eq "YOUR_SSH_USERNAME" -or $SshPrivateKeyPath.Contains("YOUR_SSH_KEY")) {
    throw "Set the SSH hostname, username, and key path in this script."
}

if (-not (Test-Path -LiteralPath $SshPrivateKeyPath -PathType Leaf)) {
    throw "SSH key file not found: $SshPrivateKeyPath"
}

if (-not (Test-Path -LiteralPath $SshKnownHostsPath -PathType Leaf)) {
    throw "SSH known_hosts file not found: $SshKnownHostsPath"
}

if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
    throw "Copy .env.example to .env and set local Grafana and pgAdmin passwords."
}

$env:SSH_HOST = $SiteHostName
$env:SSH_USER = $SshUserName
$env:SSH_PRIVATE_KEY_PATH = (Resolve-Path -LiteralPath $SshPrivateKeyPath).Path.Replace("\", "/")
$env:SSH_KNOWN_HOSTS_PATH = (Resolve-Path -LiteralPath $SshKnownHostsPath).Path.Replace("\", "/")

Push-Location $PSScriptRoot

try {
    & docker compose --env-file $EnvironmentFile -f $ComposeFile up --detach --build --wait ssh-tunnel
    if ($LASTEXITCODE -ne 0) {
        throw "SSH tunnels did not become ready."
    }

    & docker compose --env-file $EnvironmentFile -f $ComposeFile up --detach grafana pgadmin
    if ($LASTEXITCODE -ne 0) {
        throw "Local Grafana and pgAdmin did not start."
    }

    Write-Host "Grafana: http://localhost:3001"
    Write-Host "pgAdmin: http://localhost:5051"
    [void](Read-Host "Press Enter to stop local Grafana, pgAdmin, and SSH tunnels")
}
finally {
    & docker compose --env-file $EnvironmentFile -f $ComposeFile down
    Pop-Location
}
