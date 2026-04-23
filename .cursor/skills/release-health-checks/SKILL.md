---
name: release-health-checks
description: Runs build verification, lint, format checks, and optional Docker builds for CherryPlay release pipeline. Use when the user asks to verify the build, run health checks, validate release readiness, or check that all projects build and pass checks before release or CI.
---

# Release & Build Health Checks

## Purpose

Use this skill to run deterministic release-health validation for CherryPlay and report pass/fail status in a consistent format.

## When to not apply

- Do not use for feature implementation tasks.
- Do not use when the user asks only conceptual questions without running checks.

## Script (recommended)

From repo root, run all checks (Server + Server tests + Components + Web):

```bash
node .cursor/skills/release-health-checks/scripts/run-health-checks.mjs
```

Options:

- `--docker` — also build Docker images (server and web), same as `.github/workflows/build-images.yml` and `release-and-deploy.yml`.
- `--skip-ci` — skip the Components install step (use when you want to rely on existing `node_modules` and not run `npm ci` / `npm install`).
- `--integration-db` — run backend containerized integration tests (`Category=IntegrationDb`). Requires Docker.

**Note:** The script tries `npm ci` in CherryPlayComponents first; if it fails (e.g. EPERM on Windows when files are locked), it automatically falls back to `npm install` so the full check can complete.

Example with Docker (full CI parity):

```bash
node .cursor/skills/release-health-checks/scripts/run-health-checks.mjs --docker
```

Example including IntegrationDb tests:

```bash
node .cursor/skills/release-health-checks/scripts/run-health-checks.mjs --integration-db
```

**CI alignment:** The script runs the same steps and order as in CI. Native steps mirror `CherryPlayServer/Dockerfile` and `CherryPlayWeb/Dockerfile`; with `--docker` it runs the same `docker build` commands as in `.github/workflows/build-images.yml` and `release-and-deploy.yml`.

The script resolves the repo root from its own path, so it can be run from any working directory. It prints a summary table at the end and exits with code 1 if any check fails.

---

## When to Apply

Use this skill when the user asks to:

- Verify the build (all projects or release configuration)
- Run health checks
- Validate release readiness
- Check that code passes lint/format and builds before release or push

## Scope

CherryPlay release builds **CherryPlayServer** (.NET) and **CherryPlayWeb** (which depends on **CherryPlayComponents**). CI builds only Docker images (`.github/workflows/build-images.yml` on push/PR; `release-and-deploy.yml` on release). The script runs the same restore/lint/format/build steps as inside those Dockerfiles so local checks match what CI runs.

## Artifacts

- Optional terminal output from health-check commands.
- Optional Docker build output when `--docker` is used.
- Final status table in the response (required).

**Shell note:** On Windows PowerShell use `;` to chain commands. Use `&&` in Bash (e.g. GitHub Actions, Linux Docker).

---

## Health Check Workflow

Either run the script above or run the following steps manually in this order (matches Dockerfiles and CI).

### 1. CherryPlayServer (.NET)

Order as in `CherryPlayServer/Dockerfile`: restore → format → build.  
Then run server tests split by category: fast tests always, IntegrationDb optionally.

From repo root:

```bash
dotnet restore CherryPlayServer/CherryPlayServer.csproj
dotnet format CherryPlayServer/CherryPlayServer.csproj --verify-no-changes --verbosity minimal
dotnet build CherryPlayServer/CherryPlayServer.csproj -c Release --no-restore
dotnet test CherryPlayServer.Tests/CherryPlayServer.Tests.csproj --filter "Category!=IntegrationDb" --no-build
```

To fix format issues run `dotnet format` (no `--verify-no-changes`) in `CherryPlayServer/`.

IntegrationDb (requires Docker):

```bash
dotnet test CherryPlayServer.Tests/CherryPlayServer.Tests.csproj --filter "Category=IntegrationDb" --no-build
```

### 2. CherryPlayComponents (Node)

Order as in `CherryPlayWeb/Dockerfile` first stage: npm ci → lint → build.

From repo root:

```bash
cd CherryPlayComponents; npm ci; npm run lint; npm run build
```

- **Lint:** ESLint with `--max-warnings=0`.
- **Build:** `tsc`.

### 3. CherryPlayWeb (Node + Vite)

Order as in `CherryPlayWeb/Dockerfile`: lint:fix → lint → build.

From repo root:

```bash
cd CherryPlayWeb; npm run lint:fix; npm run lint; npm run build
```

- **Lint:** ESLint via wrapper, `--max-warnings=10`.

### 4. Optional — Docker builds (release images)

Only run if the user asks for full release/Docker verification. These require Docker and network (NuGet/npm).

- **Server image** (same as in `build-images.yml` and `release-and-deploy.yml`): context `./CherryPlayServer`, file `./CherryPlayServer/Dockerfile`.
  ```bash
  docker build -f CherryPlayServer/Dockerfile -t cherryplay-server:test ./CherryPlayServer
  ```
- **Web image** (same as CI): context `.`, file `./CherryPlayWeb/Dockerfile`.
  ```bash
  docker build -f CherryPlayWeb/Dockerfile -t cherryplay-web:test .
  ```

Local Docker builds may fail with network errors (e.g. NuGet in server image on Windows); CI usually succeeds.

---

## Summary Format

After running the requested checks, report:

```text
## Health check results

| Check                    | Status |
|--------------------------|--------|
| Server: restore           | ✅ / ❌ |
| Server: format            | ✅ / ❌ |
| Server: build (Release)   | ✅ / ❌ |
| Server: tests (fast)      | ✅ / ❌ |
| Server: tests (IntegrationDb) | ✅ / ❌ / skipped |
| Components: npm ci       | ✅ / ❌ / skipped |
| Components: lint         | ✅ / ❌ |
| Components: build        | ✅ / ❌ |
| Web: lint:fix            | ✅ / ❌ |
| Web: lint                | ✅ / ❌ |
| Web: build               | ✅ / ❌ |
| (Optional) Docker server | ✅ / ❌ / skipped |
| (Optional) Docker web    | ✅ / ❌ / skipped |

[If any ❌: list failed step and first relevant error or fix hint.]
```

Keep the table to the checks you actually ran (e.g. omit Docker if not requested).

---

## Quick Reference

| Project    | Lint/format                         | Build                                     |
| ---------- | ----------------------------------- | ----------------------------------------- |
| Server     | `dotnet format --verify-no-changes` | `dotnet build -c Release` + `dotnet test` |
| Components | `npm run lint` (max-warnings=0)     | `npm run build` (tsc)                     |
| Web        | `npm run lint` (max-warnings=10)    | `npm run build` (tsc + vite)              |

Fix hints:

- **Server format:** Run `dotnet format` in `CherryPlayServer/` and commit the changes (e.g. line endings CRLF→LF).
- **Components/Web lint:** Fix reported files; use `npm run lint:fix` where available; for unused vars use `_` prefix or remove.
- **EPERM on Windows (npm ci):** If `npm ci` fails with EPERM when unlocking files in `node_modules` (e.g. `.resolver-binding-win32-x64-msvc` or `.rollup-win32-x64-msvc`), the script falls back to `npm install`. To make `npm ci` work: close IDE/terminals using the project, then remove `node_modules` and run `npm ci` again; or add the project folder to antivirus exclusions. Alternatively run health checks with `--skip-ci` to skip the install step and use existing `node_modules`.

## Return of control

- After checks finish, return a concise summary table and list only failed steps with actionable hints.
- Do not continue with unrelated implementation tasks unless explicitly requested.
