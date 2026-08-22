# CP-065 Subtask 04 — Desktop/Electron: deep link, IPC, webBaseUrl config

## Type

**Desktop/Electron**

## Project

CherryPlayList (Electron main process, IPC, config, dev callback route)

## Goal and scope

Configure Desktop with a web base URL for opening browser login; extend Electron deep link handling for code-only callbacks; consolidate OAuth/desktop auth callback registration to a single app-level listener; add dev-equivalent callback route on List renderer port.

## Dependencies

- **Subtask 02 (Backend)** — `POST /auth/desktop/exchange` must exist for callback handler to complete flow
- **Independent of Subtask 03** for IPC/config/deep-link work; E2E requires Subtask 03 for browser redirect
- Blocks: Subtask 05 (UI wires into services and callback established here)

## Checklist

### C1 — Web base URL config

- [ ] Add optional `webBaseUrl` to `serverConfig.development.json` and `serverConfig.production.json`
  - dev default: `http://localhost:3000`
  - prod default: `https://cherrypashkaparty.ru`
- [ ] Expose via existing `config:get*` IPC pattern (mirror `getServerUrl`)
- [ ] Renderer can read `webBaseUrl` for `startBrowserLogin()`

### C2 — Auth service (Electron-facing methods)

- [ ] `startBrowserLogin()`: open `{webBaseUrl}/login?client=desktop` via `auth:openExternal`
- [ ] `exchangeDesktopCode(code, deviceId?)`: `POST /auth/desktop/exchange`
- [ ] Keep `startOAuthFlow` / legacy `exchangeCode` for backward compatibility but mark unused by UI (Subtask 05 removes UI calls)

### C3 — Electron deep link handler

- [ ] Update `electron/ipc/auth.ts` (and `main.ts` if needed): accept URLs with **only** `code` param (`provider` optional/ignored)
- [ ] Callback payload type: `{ code: string; provider?: string }`
- [ ] Remove requirement that both `code` and `provider` must be present

### C4 — Dev callback equivalent

- [ ] Add List dev route `/auth/callback` (port 5173): when query contains `code`, forward to same IPC handler as `cherryplaylist://auth?code=...`
- [ ] Document that primary dev path remains `cherryplaylist://`; route satisfies «или эквивалент» without separate 5174 server
- [ ] Remove or update stale dev note in `authService.ts` referencing `localhost:5174` if present

### C5 — Single callback registration

- [ ] Move `auth:registerCallback` listener to **one** app-level place (bootstrap or dedicated auth module)
- [ ] On callback: `exchangeDesktopCode` → `setAuthSessionToken` → load organizer → notify UI/auth store
- [ ] Remove duplicate registration from `usePartyWorkspaceEffects.ts` (party workspace reacts to auth store changes instead)
- [ ] Remove duplicate registration from `AccountView.tsx` if present

## Files likely to change

| Area | Files |
|------|-------|
| Config | `CherryPlayList/serverConfig.development.json`, `serverConfig.production.json` |
| Electron | `CherryPlayList/electron/main.ts`, `electron/ipc/auth.ts` |
| Services | `CherryPlayList/src/shared/services/authService.ts` |
| IPC/preload | Preload typings if callback payload changes |
| Routing | App router — new `/auth/callback` route (dev equivalent) |
| Hooks | `CherryPlayList/src/workspaces/party/usePartyWorkspaceEffects.ts` (remove duplicate listener) |

## Acceptance criteria

- [ ] `webBaseUrl` readable from renderer; defaults correct for dev/prod configs
- [ ] `startBrowserLogin()` opens correct URL with `?client=desktop`
- [ ] `cherryplaylist://auth?code=RAW` triggers IPC callback with code-only URL
- [ ] Dev route `http://localhost:5173/auth/callback?code=RAW` invokes same exchange path
- [ ] Exactly one `auth:registerCallback` listener app-wide (no race between AccountView and party effects)
- [ ] Successful exchange saves JWT and loads organizer session
- [ ] Expired/invalid code shows user-friendly error in Desktop
- [ ] `npm run lint:fix` passes in CherryPlayList

## Testing / smoke notes

- Packaged or dev Electron: register `cherryplaylist://` handler, trigger test URL with fake code → verify exchange API called (mock server or real backend from Subtask 02)
- Dev: navigate renderer to `/auth/callback?code=...` → same behavior as protocol handler
- Confirm only one IPC registration (grep for `auth:registerCallback`)
- Demo/fixtures auth mode unchanged (no browser SSO in demo)
- Full browser-open → return flow requires Subtasks 03 + 05
