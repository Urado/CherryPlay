$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue

if (-not $gitCommand) {
  throw 'Git for Windows is required to provide Bash.'
}

if (-not $nodeCommand) {
  throw 'Node.js is required to validate monitoring configuration.'
}

if (-not $dockerCommand) {
  throw 'Docker Desktop with the Compose plugin is required to validate Compose configuration.'
}

$gitRoot = Split-Path (Split-Path $gitCommand.Source -Parent) -Parent
$bashPath = Join-Path $gitRoot 'bin\bash.exe'

if (-not (Test-Path $bashPath)) {
  throw "Git Bash was not found at $bashPath."
}

$validationDependencies = Join-Path $PSScriptRoot 'monitoring-validation\node_modules\yaml'
$desktopDependencies = Join-Path $repositoryRoot 'CherryPlayList\node_modules\yaml'
if (-not (Test-Path $validationDependencies) -and -not (Test-Path $desktopDependencies)) {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) {
    throw 'npm is required to install the locked monitoring validator dependency.'
  }

  $npmCache = Join-Path $env:TEMP 'cherryplay-monitoring-validation-npm-cache'
  & $npmCommand.Source ci --prefix (Join-Path $PSScriptRoot 'monitoring-validation') --cache $npmCache
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Push-Location $repositoryRoot
try {
  & $bashPath -lc './scripts/validate-monitoring-config.sh'
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
