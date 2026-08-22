# CP-065 Subtask 02 — Backend: Desktop auth codes + exchange

## Type

**Backend**

## Project

CherryPlayServer (CherryPlay Server)

## Goal and scope

Introduce one-time desktop auth codes (hash-at-rest, TTL, single-use) and wire them into login, register, and OAuth callback flows when `client=desktop` is detected. Expose `POST /auth/desktop/exchange` for Desktop to obtain JWT. This subtask is the foundation for all client-side work.

## Dependencies

- **None** (first subtask in execution order)
- Blocks: subtasks 03, 04, 05

## Checklist

### A1 — Data model and persistence

- [ ] Add domain entity `DesktopAuthCode`: `Id`, `OrganizerId`, `TokenHash`, `ExpiresAt`, `UsedAt`, `CreatedAt`
- [ ] EF configuration, migration, repository interface + EF/InMemory implementations
- [ ] Reuse `PasswordResetTokenHelper` for generate/hash (or minimal shared helper if cleaner)
- [ ] Add TTL constant `AuthConstants.DesktopAuthCodeTtl` = **3 minutes**
- [ ] Register repository and related services in `Program.cs` DI

### A2 — Service layer

- [ ] Add `IDesktopAuthCodeService` with:
  - `IssueCodeAsync(organizerId)` → raw URL-safe code (32+ bytes entropy)
  - `ExchangeAsync(rawCode, deviceId?)` → JWT (reuse existing token/session generation like login)
- [ ] Exchange logic: hash incoming code, find valid unused non-expired row, set `UsedAt`, return token; else 401 with generic RU message
- [ ] Rate-limit exchange endpoint (reuse existing rate-limit patterns if available)

### A3 — HTTP endpoints

- [ ] `POST /auth/desktop/exchange` (no auth): body `{ code: string, deviceId?: string }` → `{ accessToken: string }` or 401
- [ ] **Do not** require separate authenticated `POST /auth/desktop/code` from browser JS for MVP — issue code inline on successful auth when desktop client detected

### A4 — Desktop-client detection on existing endpoints

- [ ] Accept `client=desktop` via query on `POST /auth/login`, `POST /auth/register` **or** header `X-CherryPlay-Client: desktop` on API calls from web
- [ ] When `client=desktop` on successful login/register: include `{ code }` in JSON response (preferred over cookie round-trip)
- [ ] Extend `OAuthStateService` state payload to carry `client=desktop`
- [ ] In `{provider}/callback`: if state indicates desktop → issue desktop code → redirect `cherryplaylist://auth?code={rawCode}` instead of cookie + `/cabinet`
- [ ] Keep web-only paths unchanged (no `client` → cookie + `/cabinet` as today)

### A5 — Tests

- [ ] Add **new** test file(s) for desktop code issue, exchange, TTL expiry, single-use, invalid code
- [ ] Do **not** edit pre-existing test files without user confirmation

## Files likely to change

| Area | Files |
|------|-------|
| Domain | New `DesktopAuthCode` entity |
| Persistence | EF config, migration, `IDesktopAuthCodeRepository`, EF/InMemory impl |
| Services | `IDesktopAuthCodeService`, implementation; possibly `AuthService.cs` |
| HTTP | `AuthController.cs` |
| OAuth | `OAuthStateService.cs`, OAuth callback handler in controller/service |
| Constants/DI | `AuthConstants.cs`, `Program.cs` |
| Tests | New `*DesktopAuthCode*Tests.cs` (new file only) |

## Acceptance criteria

- [ ] `DesktopAuthCodes` table exists with hash-at-rest, `ExpiresAt`, `UsedAt`
- [ ] `POST /auth/desktop/exchange` returns `{ accessToken }` for valid code; 401 for invalid/expired/used code
- [ ] TTL enforced at 3 minutes (within 2–5 min acceptance range)
- [ ] `POST /auth/login` and `POST /auth/register` with `client=desktop` return `{ code }` on success (alongside or instead of normal web redirect semantics)
- [ ] OAuth callback with desktop state redirects to `cherryplaylist://auth?code=...` (no JWT in URL)
- [ ] Web-only login/register/OAuth unchanged (regression-safe)
- [ ] New automated tests pass; no pre-existing test files modified

## Testing / smoke notes

- Use Swagger or curl: issue code via login with `X-CherryPlay-Client: desktop`, exchange once → 200; exchange again → 401
- Wait past TTL → exchange → 401
- Verify OAuth callback redirect URL format with mocked or dev provider flow (full E2E deferred to subtasks 03–05)
- Run server test suite; confirm only new test files added
