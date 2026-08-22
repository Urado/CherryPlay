Temporary orchestration file; may be deleted after run.

# CP-065 — Desktop browser SSO — Technical Specification (Stage 1)

## Restatement of the ask

Unify CherryPlayList (Desktop) authentication through CherryPlayWeb: remove inline email/password login and registration from the desktop app; when the user clicks «Войти», open the web login page in the system browser (`/login?client=desktop`); after successful email/password or OAuth on the web, redirect back to the app via deep link with a **one-time code** (never a JWT); Desktop exchanges the code for JWT via a new server endpoint and completes auto-login. Legal consent for signup stays centralized on the web form (CP-038/CP-044), not duplicated in Desktop.

---

## Current state (validated against codebase)

### Already exists

| Area | What works today |
|------|------------------|
| **Server** | `POST /auth/login`, `POST /auth/register` (cookie + JWT in body); OAuth Desktop (`GET /auth/{provider}/start`, `POST /auth/exchange` with `{ code, provider }`); OAuth Web (`GET /auth/{provider}/web`, `GET /auth/{provider}/callback` → cookie → `/cabinet`); `PasswordResetToken` pattern (hash in DB, TTL, `UsedAt`, helper). |
| **Web** | `LoginPage` + shared `AuthForm` (email + OAuth); `RegisterPage` redirects to login with mode toggle. |
| **Desktop** | `AccountView` and `PartyEditorBlockedOverlay` render inline `AuthForm`; `authService.startOAuthFlow` opens `/auth/{provider}/start`; `authService.exchangeCode` → `POST /auth/exchange`; Electron deep link `cherryplaylist://` in `main.ts` + `electron/ipc/auth.ts`; forgot/change password panels remain in Desktop. |
| **Config** | Desktop API URL via `serverConfig.{development,production}.json` (`serverUrl` only). Server `PUBLIC_WEB_BASE_URL` for reset-password links (`http://localhost:3000` dev, `https://cherrypashkaparty.ru` prod). |

### Gaps (must be built)

- No `desktop_auth_codes` entity or `POST /auth/desktop/exchange`.
- Web login/register/OAuth callback have no `client=desktop` branch.
- Desktop has no web base URL config (only API `serverUrl`).
- Electron `handleOAuthCallback` **requires** both `code` and `provider` in the URL; new flow is code-only.
- Two IPC callback listeners (`AccountView`, `usePartyWorkspaceEffects`) share a single `oAuthCallbackPromise` — race/timeout risk.
- Dev deep link note in `authService.ts` references `http://localhost:5174/auth/callback` but no handler exists for that port; only `cherryplaylist://` is wired in Electron.

---

## Target architecture

### Happy-path sequence

```
Desktop                          Web (browser)                    Server
   |                                   |                              |
   |-- open /login?client=desktop ---->|                              |
   |                                   |-- POST /auth/login --------->|
   |                                   |<-- session established ------|
   |                                   |-- POST /auth/desktop/code -->|  (issue one-time code)
   |                                   |<-- { code } -----------------|
   |<-- redirect cherryplaylist://auth?code=RAW ----------------------|
   |-- POST /auth/desktop/exchange { code } ------------------------->|
   |<-- { accessToken } ----------------------------------------------|
   |-- save JWT, load organizer, auto-login                           |
```

OAuth via web form in desktop mode follows the same tail: after provider callback, server issues desktop code instead of httpOnly cookie + `/cabinet` redirect.

### Deep link contract

| Environment | Redirect target after web success |
|-------------|-----------------------------------|
| **Production / packaged Desktop** | `cherryplaylist://auth?code={rawCode}` |
| **Development (equivalent)** | Same protocol **or** in-app route `http://localhost:5173/auth/callback?code={rawCode}` handled by List renderer + forwarded to Electron IPC |

JWT must **never** appear in URL query parameters.

---

## Assumptions

1. CherryPlayWeb and CherryPlayServer are reachable from the user's machine when Desktop opens the browser (same as today's OAuth start flow).
2. `PUBLIC_WEB_BASE_URL` on the server matches the URL Desktop should open for login (dev: `http://localhost:3000`; prod: `https://cherrypashkaparty.ru`).
3. Custom URL scheme `cherryplaylist://` remains registered on Windows/macOS for packaged and dev Electron builds.
4. CP-038 (signup consent checkboxes) may **not** be shipped yet; desktop-mode register on web uses the **same** validation as normal web register until CP-038 lands.
5. Existing `POST /auth/exchange` (OAuth provider code) remains for backward compatibility during rollout but Desktop UI stops calling `/auth/{provider}/start` directly.
6. Demo/fixtures auth mode in Desktop is unchanged (no browser SSO in demo).
7. Forgot-password and change-password flows stay as today (forgot from Desktop → email → web reset; change in Desktop when logged in).

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Dual OAuth callback listeners** (`AccountView` + `usePartyWorkspaceEffects`) | Lost or duplicated exchange; timeout errors | Consolidate to **one** app-level auth callback registration (e.g. bootstrap or dedicated auth module); remove duplicate `auth:registerCallback` calls. |
| **Missing web URL on Desktop** | Opens wrong host or 404 | Add `webBaseUrl` to Desktop config with sensible defaults; optional server-driven discovery out of scope. |
| **OAuth state must carry `client=desktop`** | Web OAuth falls back to cookie/cabinet | Extend `IOAuthStateService` payload (or parallel cache key) to store client mode; validate in `{provider}/callback`. |
| **Code interception via browser history/logs** | Account takeover | Short TTL (2–5 min), one-time use, store **hash only** in DB; rate-limit exchange endpoint. |
| **Register link loses `client=desktop`** | User registers on web but lands in cabinet, not app | Propagate `client=desktop` through login ↔ register navigation and OAuth start links. |
| **PartyEditorBlockedOverlay still shows inline AuthForm** | Acceptance criterion missed | Replace with same «Войти через браузер» CTA as AccountView. |
| **Pre-existing server tests** | Workers may need test updates | Do **not** edit pre-existing test files without user confirmation; add **new** test file(s) for desktop exchange. |
| **Legal consent gap (CP-038)** | Register via desktop-browser path without PD checkboxes | Document dependency; when CP-038 ships, web form already hosts consent — no Desktop duplication needed. |

---

## Minimal implementation path

Ordered steps with dependencies. Each step should be shippable behind the previous.

### Phase A — Backend foundation (blocks B, C, D)

**A1. Data model & persistence**

- Add domain entity `DesktopAuthCode` mirroring `PasswordResetToken` pattern:
  - `Id`, `OrganizerId`, `TokenHash`, `ExpiresAt`, `UsedAt`, `CreatedAt`
  - Optional: `Source` enum (`EmailLogin`, `EmailRegister`, `OAuth`) for audit — not required for MVP.
- EF configuration, migration, repository interface + EF/InMemory implementations.
- Reuse `PasswordResetTokenHelper` for generate/hash (or extract shared `OneTimeTokenHelper` if cleaner — keep scope minimal).
- TTL constant: **3 minutes** (`AuthConstants.DesktopAuthCodeTtl`).
- Register in DI (`Program.cs`).

**A2. Service layer**

- `IDesktopAuthCodeService`:
  - `IssueCodeAsync(organizerId)` → raw code (URL-safe, 32+ bytes entropy).
  - `ExchangeAsync(rawCode, deviceId?)` → JWT (reuse `GenerateTokenAsync` + session creation like login).
- Exchange: hash incoming code, find valid unused non-expired row, set `UsedAt`, return token; else 401 with generic RU message.

**A3. HTTP endpoints** (`AuthController`)

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/auth/desktop/code` | JWT or fresh login context | — | `{ code: string }` |
| POST | `/auth/desktop/exchange` | none | `{ code: string, deviceId?: string }` | `{ accessToken: string }` or 401 |

**Code issuance options (pick one — see defaults):**

- **Recommended:** After successful `login`/`register`/`OAuth callback`, when `client=desktop` is detected, server issues code internally and returns/redirects with code — **no separate authenticated call from browser JS**.
- Alternative: Web calls `POST /auth/desktop/code` with cookie after login — adds cookie timing complexity; avoid unless needed.

**A4. Desktop-client detection on existing endpoints**

- Accept `client=desktop` via query on `POST /auth/login`, `POST /auth/register` **or** request header `X-CherryPlay-Client: desktop` (header avoids logging query in proxies).
- OAuth: embed `client=desktop` in OAuth state (extend state payload JSON in `OAuthStateService`).
- `{provider}/callback`: if state indicates desktop → issue desktop code → redirect `cherryplaylist://auth?code=...` instead of cookie + `/cabinet`.

**Dependency:** A1 → A2 → A3 → A4.

---

### Phase B — Web frontend (depends on A3/A4)

**B1. Detect desktop mode**

- `LoginPage`: read `client=desktop` from `useSearchParams()`.
- Persist flag in session for register toggle and OAuth button links.

**B2. Email login/register success path**

- When `client=desktop`:
  - After successful login/register API call, server response includes `{ code }` **or** follow redirect URL from server.
  - Client-side: `window.location.href = 'cherryplaylist://auth?code=' + encodeURIComponent(code)`.
  - Show short «Возвращаемся в приложение…» message; do **not** navigate to `/cabinet`.

**B3. OAuth buttons in desktop mode**

- OAuth start links must propagate desktop client in state (server-side change in A4).
- Callback handled entirely server-side (redirect to deep link).

**B4. Register redirect**

- `RegisterPage` redirect to login preserves `?client=desktop`.

**B5. Error handling**

- On auth failure, stay on web login with error; deep link only on success.

**Dependency:** A4 complete → B1–B5.

---

### Phase C — Desktop Electron + renderer (depends on A3)

**C1. Web base URL config**

- Add optional `webBaseUrl` to `serverConfig.development.json` / `serverConfig.production.json`:
  - dev default: `http://localhost:3000`
  - prod default: `https://cherrypashkaparty.ru`
- Expose via existing `config:get*` IPC pattern (mirror `getServerUrl`).

**C2. Auth service**

- `startBrowserLogin()`: open `{webBaseUrl}/login?client=desktop` via `auth:openExternal`.
- `exchangeDesktopCode(code, deviceId?)`: `POST /auth/desktop/exchange`.
- Deprecate direct use of `startOAuthFlow` / inline `login`/`register` from Desktop UI (methods may remain for demo/tests).

**C3. Electron deep link handler** (`electron/ipc/auth.ts`)

- Accept URLs with **only** `code` param (provider optional/ignored).
- Callback payload type: `{ code: string; provider?: string }`.
- Dev equivalent: optional renderer route `/auth/callback` that invokes same IPC handler when query contains `code`.

**C4. Single callback registration**

- Move `auth:registerCallback` listener to one place (app init).
- On callback: `exchangeDesktopCode` → `setAuthSessionToken` → load organizer → notify UI.
- Remove duplicate registration from `usePartyWorkspaceEffects` (keep party workspace react to auth store changes instead).

**C5. UI replacements**

- `AccountView`: remove `AuthForm` for unauthenticated state; show primary button «Войти» → `startBrowserLogin()`; keep `ForgotPasswordForm` link/button opening web forgot-password or inline forgot (current behavior acceptable per task — forgot is not login/register form).
- `PartyEditorBlockedOverlay`: replace `AuthForm` with same browser-login CTA.
- Loading/error states while waiting for deep link return (reuse OAuth waiting pattern).

**Dependency:** A3 + B2 (for end-to-end test) → C1–C5. C3/C4 can start after A3.

---

### Phase D — Documentation & contracts (depends on A–C)

- `CONTRACTS.md`: new §3.2.x «Desktop browser SSO» — code issuance, exchange, TTL, deep link format; note that Desktop no longer uses inline email auth.
- `docs/integration/accounts-and-auth.md`: update «Логин в CherryPlayList» section to browser SSO flow.
- `CherryPlayServer/DATABASE.md`: document `DesktopAuthCodes` table.
- `ENV.md` / Desktop BUILD docs: document `webBaseUrl` config if added.

**Dependency:** A–C functionally complete → D.

---

### Phase E — Smoke verification (manual; no pre-existing test edits)

- Email login → return to app → auto-login.
- Email register → return to app.
- OAuth VK and Mail.ru from web form in desktop mode.
- Repeat login (code single-use).
- Expired code → 401, user-friendly error in Desktop.
- Dev: deep link or `/auth/callback` equivalent.
- Web-only login (`client` absent) still goes to `/cabinet` (regression).

---

## Acceptance criteria (mapped to task card)

| Task card checkbox | How verified |
|--------------------|--------------|
| Desktop no local email/password login/register; «Войти» opens browser | `AccountView` + `PartyEditorBlockedOverlay` use browser CTA only; no `EmailAuthForm` in Desktop. |
| Web `/login` and `/register` support `client=desktop`; redirect to deep link not `/cabinet` | Login/register/OAuth success with flag → `cherryplaylist://auth?code=...`. |
| OAuth from web form in desktop mode uses same code mechanism | OAuth callback branch issues desktop code. |
| Server: `desktop_auth_codes` + `POST /auth/desktop/exchange` → `{ accessToken }` | Entity + endpoint live; contract documented. |
| Code one-time, TTL 2–5 min; JWT not in URL | Hash-at-rest, `UsedAt`, TTL enforced; code-only deep link. |
| Desktop deep link → exchange → JWT → auto-login | Electron handler + unified callback + session load. |
| Dev-flow preserved | `cherryplaylist://` and/or `http://127.0.0.1:5173/auth/callback` equivalent documented and working. |
| Contracts updated | `CONTRACTS.md`, `accounts-and-auth.md` (+ `DATABASE.md`). |

---

## Constraints

### In scope

- Browser SSO for Desktop login and registration (email + OAuth via web).
- New server table and exchange endpoint.
- Web `client=desktop` mode.
- Desktop UI, Electron IPC, config for web URL.
- Contract/documentation updates.
- Consolidating OAuth callback registration.

### Out of scope (explicit)

- CP-038/CP-044 implementation (consent UI) — only ensure web form is the single place when those tasks land.
- Refresh tokens, session refresh, Telegram OAuth.
- Removing `POST /auth/exchange` or `/auth/{provider}/start` from server (legacy Desktop OAuth API may remain unused).
- Email verification at registration.
- Changing forgot/reset password flows.
- Editing **pre-existing** automated tests without user confirmation.
- Code comments in application source (project rule: strip on edit).

### Project rules to enforce

- Run `npm run lint:fix` in CherryPlayList, CherryPlayWeb, CherryPlayComponents after TS changes.
- No commits unless user asks.
- Read linked docs; treat CONTRACTS as source of truth for API shapes.

---

## Recommended subtask breakdown for scheduler

Five coherent subtasks (suggested worker assignment):

| # | Subtask | Worker | Key deliverables |
|---|---------|--------|------------------|
| **1** | **Backend: desktop auth codes** | worker-dotnet | Entity, migration, repository, service, `POST /auth/desktop/exchange`, code issuance hook, login/register/OAuth callback desktop branch, new tests in **new** test file(s) |
| **2** | **Web: client=desktop mode** | worker-frontend | `LoginPage`, register redirect, OAuth state propagation, deep link redirect, error UX |
| **3** | **Desktop: Electron deep link + config** | worker-electron | `webBaseUrl` config, `electron/ipc/auth.ts` code-only handler, dev callback route, single callback registration |
| **4** | **Desktop: UI + authService** | worker-frontend (CherryPlayList) | Remove inline `AuthForm`, browser login CTA, `exchangeDesktopCode`, party overlay update |
| **5** | **Documentation** | worker-documentation | `CONTRACTS.md` §3.2.x, `accounts-and-auth.md`, `DATABASE.md`, config notes |

**Suggested order:** 1 → (2 ∥ 3) → 4 → 5. Subtask 4 depends on 1+3; subtask 2 depends on 1.

---

## Open questions — recommended defaults

| Question | Recommended default |
|----------|---------------------|
| Endpoint name: `/auth/desktop/exchange` vs reuse `/auth/exchange`? | **`POST /auth/desktop/exchange`** — distinct from OAuth provider exchange; body `{ code }` only. |
| Code TTL? | **3 minutes** (within 2–5 min acceptance range). |
| How does web obtain code after email login? | **Server returns `{ code }` in login/register response when `client=desktop`** (or 302 redirect to deep link from server). Avoid extra round-trip with cookie. |
| Pass `client=desktop` as query vs header? | **Query `?client=desktop` on web URLs** for discoverability; **header `X-CherryPlay-Client: desktop`** on API POST bodies from web JS. OAuth via **state payload**. |
| Desktop `webBaseUrl` source? | **New field in `serverConfig.*.json`**, defaulting to `http://localhost:3000` (dev) / `https://cherrypashkaparty.ru` (prod). Do not derive from API `serverUrl` alone (same host in prod but different path semantics). |
| Dev deep link: `127.0.0.1:5174` vs protocol? | **Primary: `cherryplaylist://auth?code=...`** (already registered). **Equivalent:** add List dev route `/auth/callback?code=` on port 5173 that forwards to IPC — satisfies «или эквивалент» without running a separate 5174 server. |
| Keep inline forgot-password on Desktop? | **Yes** — task targets login/register forms only; forgot already delegates to web via email link. |
| Remove `authService.login/register` from Desktop entirely? | **Remove from UI**; keep service methods temporarily for demo/web-demo platform stubs unless dead-code lint complains. |
| Consent checkboxes (CP-038) in desktop register path? | **No Desktop UI**; web register in `client=desktop` mode uses current web validation until CP-038 adds checkboxes to `AuthForm`. |
| Optional `consent metadata` column on `desktop_auth_codes`? | **Defer** — not needed for MVP; consent recorded via normal register flow when CP-038 ships. |

---

## Key files to touch (reference for workers)

| Layer | Files |
|-------|-------|
| Server | `AuthController.cs`, `AuthService.cs`, new entity/repo/service, `AuthConstants.cs`, `OAuthStateService.cs`, migration, `Program.cs`, `DATABASE.md` |
| Web | `LoginPage.tsx`, `RegisterPage.tsx`, `authService.ts`, OAuth link components in `CherryPlayComponents` if shared |
| Desktop | `authService.ts`, `AccountView.tsx`, `PartyEditorBlockedOverlay.tsx`, `usePartyWorkspaceEffects.ts`, `electron/ipc/auth.ts`, `serverConfig.*.json`, optional app router for `/auth/callback` |
| Shared | `CherryPlayComponents/src/types/auth.ts` — optional `DesktopAuthExchangeRequest` type |
| Docs | `CONTRACTS.md`, `docs/integration/accounts-and-auth.md` |

---

## Summary (orchestrator handoff)

**Ask:** Replace Desktop inline auth with unified browser SSO through CherryPlayWeb, using one-time codes and `POST /auth/desktop/exchange`, so email/OAuth/consent live on the web.

**Key decisions:** New `DesktopAuthCodes` table (hash-at-rest, 3 min TTL); `POST /auth/desktop/exchange`; server issues code on login/register/OAuth when `client=desktop`; deep link `cherryplaylist://auth?code=...`; Desktop gets `webBaseUrl` config; single Electron callback registration; keep forgot/change password as-is; defer CP-038 consent to web form.

**Minimal path:** Backend (A) → Web desktop mode (B) + Electron (C) in parallel → Desktop UI (C5) → Docs (D) → Smoke (E).

**Follow-ups:** CP-038 consent on web register; optional cleanup of unused `/auth/{provider}/start` from Desktop; consider server endpoint for Desktop to fetch `PUBLIC_WEB_BASE_URL` dynamically; pre-existing test updates only with user approval.
