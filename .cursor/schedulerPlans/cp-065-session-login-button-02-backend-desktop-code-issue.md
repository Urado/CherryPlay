# CP-065 Session Login Button Subtask 02 — Backend: authenticated desktop code issue

## Type

**Backend**

## Project

CherryPlayServer (CherryPlay Server)

## Worker

**worker-dotnet**

## Goal and scope

Add cookie-authenticated `POST /auth/desktop/code` that issues a one-time desktop auth code for the current organizer session by reusing `IDesktopAuthCodeService.IssueCodeAsync`. No new persistence model, TTL, or exchange semantics — only a missing controller entry point so Web can continue an existing session into Desktop without re-entering password/OAuth.

## Dependencies

- **None** (first subtask in execution order)
- **Blocks:** subtask 03 (Frontend Web), and documentation of the new issuance path in subtask 04
- **Prerequisite from parent CP-065:** `DesktopAuthCode` persistence, `IssueCodeAsync` / `ExchangeAsync`, `POST /auth/desktop/exchange`, `DesktopAuthCodeResponse` already exist

## Checklist

### A1 — HTTP endpoint

- [ ] Add `POST /auth/desktop/code` on `AuthController` (path as agreed in tech spec / contracts)
- [ ] Protect with existing organizer cookie auth (`[AuthorizeOrganizer]`), same pattern as `POST /auth/logout` / change-password
- [ ] Request body: none or empty `{}` (optional `deviceId` unused for issue — do not invent unused fields unless contracts already require them)
- [ ] Resolve current organizer from authenticated session → call `IssueCodeAsync(organizerId)`
- [ ] Success: `200` with `{ code: string }` using existing `DesktopAuthCodeResponse` (or equivalent)
- [ ] Unauthenticated / invalid session: `401`
- [ ] Do **not** change issuance semantics: TTL 3 min, one-time, hash-only storage (reuse existing service)

### A2 — Wiring and DI

- [ ] Ensure controller uses existing `IDesktopAuthCodeService` (no duplicate issue logic)
- [ ] No new repository/migration unless something is actually missing (expected: none)

### A3 — Tests

- [ ] Add **new** test file(s) covering: authenticated issue → `{ code }`; unauthenticated → 401; issued code exchanges via existing `POST /auth/desktop/exchange`
- [ ] Do **not** edit pre-existing test files without user confirmation

## Files likely to change

| Area | Files |
|------|-------|
| HTTP | `CherryPlayServer/Controllers/AuthController.cs` |
| Models | Existing `DesktopAuthCodeResponse.cs` (reuse; add only if response type missing) |
| DI / interfaces | Only if registration gap found (unlikely) |
| Tests | New `*DesktopAuth*Code*Tests.cs` or similar (new file only) |

## Acceptance criteria

- [ ] Authenticated organizer can `POST /auth/desktop/code` and receive `{ code }`
- [ ] Unauthenticated call returns `401`
- [ ] Issued code works with existing `POST /auth/desktop/exchange` (same TTL / one-time / hash semantics)
- [ ] Login/register/OAuth desktop issuance paths unchanged (regression-safe)
- [ ] New automated tests pass; no pre-existing test files modified

## Testing / smoke notes

- Cookie session: login via web → `POST /auth/desktop/code` with credentials → 200 `{ code }`
- Without cookie → 401
- Exchange once with returned code → 200 `{ accessToken }`; exchange again → 401
- Run new server tests only (or full suite without editing old test sources)
