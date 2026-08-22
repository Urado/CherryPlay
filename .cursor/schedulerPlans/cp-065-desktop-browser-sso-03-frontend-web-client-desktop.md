# CP-065 Subtask 03 — Web: client=desktop mode

## Type

**Frontend**

## Project

CherryPlayWeb (+ shared CherryPlayComponents where auth UI/types live)

## Goal and scope

Detect `client=desktop` on web login/register/OAuth flows; after successful auth, redirect to `cherryplaylist://auth?code=...` instead of `/cabinet`. Propagate desktop flag through register navigation and OAuth start links so users never lose desktop mode mid-flow.

## Dependencies

- **Subtask 02 (Backend)** — server must return `{ code }` on login/register and handle OAuth callback desktop branch before E2E works; API contract must be stable for integration
- Can start UI scaffolding in parallel once response shape is agreed from spec; full verification requires Step 1 complete

## Checklist

### B1 — Detect desktop mode

- [ ] `LoginPage`: read `client=desktop` from `useSearchParams()`
- [ ] Persist desktop flag in session (sessionStorage or equivalent) for register toggle and OAuth button links
- [ ] `RegisterPage` redirect to login preserves `?client=desktop`

### B2 — Email login/register success path

- [ ] When desktop mode: send `X-CherryPlay-Client: desktop` header on `POST /auth/login` and `POST /auth/register` (or query param per server implementation)
- [ ] On success, read `{ code }` from server response
- [ ] Redirect: `window.location.href = 'cherryplaylist://auth?code=' + encodeURIComponent(code)`
- [ ] Show short «Возвращаемся в приложение…» message; do **not** navigate to `/cabinet`
- [ ] On auth failure: stay on web login with error; no deep link

### B3 — OAuth in desktop mode

- [ ] OAuth start links propagate `client=desktop` via server state (backend A4); ensure web UI passes flag when building OAuth URLs
- [ ] Callback handled server-side (redirect to deep link); web client does not intercept OAuth callback for desktop mode

### B4 — Register flow

- [ ] Register ↔ login navigation keeps `client=desktop` query param
- [ ] Register success uses same deep-link redirect as login

### B5 — Regression and UX

- [ ] Without `client=desktop`: existing behavior unchanged (cookie session → `/cabinet`)
- [ ] Optional: shared type `DesktopAuthExchangeRequest` in CherryPlayComponents if useful for consistency (minimal scope)

## Files likely to change

| Area | Files |
|------|-------|
| Web pages | `CherryPlayWeb/src/pages/LoginPage.tsx`, `RegisterPage.tsx` |
| Web auth | `CherryPlayWeb/src/services/authService.ts` (or equivalent) |
| Shared auth | `CherryPlayComponents/src/components/Auth/*` (OAuth links, `AuthForm` success handling if shared) |
| Types | `CherryPlayComponents/src/types/auth.ts` (optional) |

## Acceptance criteria

- [ ] `/login?client=desktop` and register path with same flag complete auth and redirect to `cherryplaylist://auth?code=...`
- [ ] OAuth from web form in desktop mode ends at deep link (server redirect; web does not send user to `/cabinet`)
- [ ] Register link from desktop login preserves `client=desktop`
- [ ] Auth errors remain on web login page
- [ ] Normal web login (no `client`) still redirects to `/cabinet`
- [ ] `npm run lint:fix` passes in CherryPlayWeb and CherryPlayComponents

## Testing / smoke notes

- Browser: open `http://localhost:3000/login?client=desktop`, login with valid credentials → observe deep link redirect (may fail to open app in browser-only test; verify URL format)
- Register with `?client=desktop` → same deep link behavior
- OAuth VK/Mail.ru in desktop mode → URL bar shows `cherryplaylist://auth?code=...` after provider consent
- Login without `client` → `/cabinet` (regression)
- Full auto-login in Desktop deferred to subtasks 04–05
