Temporary orchestration file; may be deleted after run.

# CP-065 — Desktop browser SSO — chat summary

## User request

Run large-task orchestration for **CP-065: SSO через web — единый browser-login для Desktop (email, OAuth, возврат в app)**.

Task card: `D:/CherryPlayKanban/tasks/CP-065-desktop-browser-sso.md`

Epic: EPIC-02 (accounts and auth). Status: backlog. Priority: high.

## Problem statement

Today CherryPlayList (Desktop) supports OAuth via system browser (`/auth/{provider}/start` → `cherryplaylist://auth?code=...` → `POST /auth/exchange`), but **email/password login and registration happen inside the app** via shared `AuthForm`. CherryPlayWeb already has a unified login/register + OAuth form.

Goal: unify Desktop auth like Cursor — Desktop opens **web login in browser** (email + password + OAuth); after success user returns to app with a **one-time code** (not JWT in URL); Desktop exchanges code for JWT and auto-logs in.

Side effect: legal consent / re-consent can be centralized on web form (CP-038, CP-044) without duplicating UI in Desktop.

## Target flow

```
Desktop → browser /login?client=desktop
Web     → email/password or OAuth + consent
Web     → cherryplaylist://auth?code=ONE_TIME_CODE
Desktop → POST /auth/desktop/exchange → JWT → auto-login
```

## Acceptance criteria (from task card)

- Desktop no longer has local email/password login/register forms; "Sign in" opens browser on web login.
- Web `/login` and `/register` support `client=desktop` mode: after success redirect to `cherryplaylist://auth?code=...`, not `/cabinet`.
- OAuth from web form in desktop mode also returns to app via same one-time code mechanism.
- Server: `desktop_auth_codes` table + `POST /auth/desktop/exchange` (or equivalent) → `{ accessToken }`.
- Code is one-time, TTL 2–5 min; JWT never in URL/deep link.
- Desktop: deep link `cherryplaylist://auth?code=...` → exchange → save JWT → auto-login.
- Dev flow preserved: `http://127.0.0.1:5174/auth/callback` or equivalent.
- Contracts updated: `CONTRACTS.md`, `docs/integration/accounts-and-auth.md`.

## Codebase research findings (prior session)

### Already exists

- **Server**: OAuth desktop (`GET /auth/{provider}/start`, `POST /auth/exchange`); email login/register (`POST /auth/login`, `POST /auth/register`); web OAuth callback with cookie.
- **Desktop**: `AccountView` uses shared `AuthForm` (inline email + OAuth); `authService.startOAuthFlow` / `exchangeCode`; Electron deep link `cherryplaylist://` in `main.ts` + `electron/ipc/auth.ts`.
- **Web**: `LoginPage` with `AuthForm`; `RegisterPage` redirects to login.
- **Pattern to reuse**: `PasswordResetToken` (hash in DB, TTL, UsedAt, helper).

### Gaps

- No `desktop_auth_codes` entity or `POST /auth/desktop/exchange`.
- No `client=desktop` on Web login/register/OAuth callback.
- Desktop has no web base URL config (API: `serverConfig.*.json`; Web: `PUBLIC_WEB_BASE_URL` e.g. localhost:3000 dev, cherrypashkaparty.ru prod).
- Deep link handler expects OAuth `code` + `provider`; new flow needs code-only + desktop exchange.
- Two OAuth callback listeners (`AccountView`, `usePartyWorkspaceEffects`) share single IPC promise — race risk.
- Consent checkboxes (CP-038) not in code yet; out of scope for minimal path unless required for register in desktop mode.

### Key files (from task card)

- `CherryPlayServer/Controllers/AuthController.cs`
- `CherryPlayServer/Infrastructure/Persistence`
- `CherryPlayWeb/src/pages/LoginPage.tsx`
- `CherryPlayWeb/src/pages/RegisterPage.tsx`
- `CherryPlayList/src/shared/services/authService.ts`
- `CherryPlayComponents/src/components/Auth`

## Constraints

- Follow project rules: no code comments in application code; lint after TS changes; do not edit pre-existing tests without user confirmation.
- Do not commit unless user asks.
- Related legal tasks CP-038/CP-044 — coordinate consent on web form when implementing register in desktop mode if CP-038 is not shipped yet.

## User intent for this message

Start **large-task-orchestration** workflow (analysis → plan → implement → review → docs). Implementation not yet requested explicitly in this message — orchestration skill covers full pipeline including execution in Stage 3.
