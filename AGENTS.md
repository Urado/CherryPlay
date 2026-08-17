# AGENTS.md

## Cursor Cloud specific instructions

### Overview

CherryPlay is a monorepo with 5 sub-projects. For typical development, 3 services matter: **CherryPlayServer** (.NET 9), **CherryPlayWeb** (React/Vite), and **CherryPlayComponents** (shared React library). **CherryPlayList** (Electron desktop app) and **CherryPlayAimpPlugin** (C++ AIMP bridge, Windows-only) are optional.

### Prerequisites

- **Node.js** (LTS) and **npm** — already available via nvm
- **.NET 9.0 SDK** — install with: `sudo /tmp/dotnet-install.sh --channel 9.0 --install-dir /usr/share/dotnet && sudo ln -sf /usr/share/dotnet/dotnet /usr/local/bin/dotnet` (the install script is downloaded once; if missing: `wget -q https://dot.net/v1/dotnet-install.sh -O /tmp/dotnet-install.sh && chmod +x /tmp/dotnet-install.sh`)

### Starting services

**Build order:** CherryPlayComponents must be built (`cd CherryPlayComponents && npm run build`) **before** CherryPlayWeb or CherryPlayList, since both depend on `@cherryplay/components` via `file:../CherryPlayComponents`.

**CherryPlayServer (backend, port 5000):**
```bash
cd CherryPlayServer
UseInMemoryStorage=true ASPNETCORE_ENVIRONMENT=Development dotnet run --urls "http://0.0.0.0:5000"
```
- `UseInMemoryStorage=true` is critical in the cloud VM — it avoids requiring PostgreSQL. The server seeds demo data (parties, playlists) automatically in this mode.
- Without this flag, the server tries to connect to PostgreSQL on port 5433 and will crash.

**CherryPlayWeb (frontend, port 3000):**
```bash
cd CherryPlayWeb
npm run dev
```

**CherryPlayList (Electron, port 5173):**
```bash
cd CherryPlayList
npm run dev
```
Note: Electron GUI won't render in headless environments; Vite dev server still works for the renderer process.

### Lint / Test / Build commands

Standard commands are in each project's `package.json` scripts — see `README.md` and `DEV_SETUP.md` for the full list. Key commands:

| Project | Lint | Test | Build |
|---------|------|------|-------|
| CherryPlayComponents | `npm run lint` | — | `npm run build` (tsc) |
| CherryPlayWeb | `npm run lint` | — | `npm run build` (tsc + vite) |
| CherryPlayList | `npm run lint` | `npm test` (jest) | `npm run build` (vite) |
| CherryPlayServer | `dotnet build` | — | `dotnet build` |

### Gotchas

- **CherryPlayList lint** uses `--max-warnings=0` and the repo currently has ~9 pre-existing warnings. Exit code 1 from lint is expected unless those warnings are resolved.
- **CherryPlayList jest tests** have 13 failing test suites (out of 21) due to pre-existing module path alias resolution issues (`@shared/...` paths not mapped in `jest.config.ts`). The 8 passing suites (61 tests) work fine.
- The `.env.example` at the repo root documents all environment variables. For local dev without Docker, the only essential override is `UseInMemoryStorage=true` on the server.
- **CORS** is pre-configured in `appsettings.Development.json` for `localhost:3000` and `localhost:5173`.
