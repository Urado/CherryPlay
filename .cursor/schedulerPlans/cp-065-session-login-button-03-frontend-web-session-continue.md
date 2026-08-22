# CP-065 Session Login Button Subtask 03 — Web: session-continue «Войти» UI

## Type

**Frontend**

## Project

CherryPlayWeb (primary); CherryPlayComponents only if shared auth types/helpers are required for the new API call

## Worker

**worker-frontend** (CherryPlayWeb)

## Goal and scope

On `LoginPage` when `client=desktop`, detect an existing web session via `checkAuth`. If authenticated, show a session-continue confirmation panel with **«Войти»** (no AuthForm, no auto-redirect). On click, call `POST /auth/desktop/code` with cookies and reuse the existing desktop return-to-app path (`handleDesktopAuthSuccess` / `buildAuthReturnUrl`). If not authenticated, keep existing AuthForm unchanged.

## Dependencies

- **Subtask 02 (Backend)** — hard dependency: `POST /auth/desktop/code` must exist and return `{ code }`
- Blocks: documentation of session-continue UX in subtask 04 (finalize after this lands)
- **Does not change:** Desktop Electron deep link / exchange (parent CP-065)

## Checklist

### B1 — Desktop-mode session detect

- [ ] On `LoginPage` when `client=desktop`: on mount call `checkAuth` (loading state)
- [ ] If organizer session present → render session-continue UI (not AuthForm)
- [ ] If not authenticated / check fails → existing AuthForm unchanged
- [ ] Non-desktop `/login` (no `client=desktop`): behavior unchanged (AuthForm → cabinet)

### B2 — Session-continue UI

- [ ] Confirmation panel with title/copy + button **«Войти»**
- [ ] **No** password fields, **no** OAuth form on this panel
- [ ] **No** auto-redirect and **no** auto-issue on mount (button click only)
- [ ] Optional email/name display is **out of scope** unless trivial and already available from `checkAuth` without design scope creep

### B3 — Issue + return-to-app

- [ ] Add `authService` method for `POST /auth/desktop/code` with `credentials: 'include'`
- [ ] On «Войти» click → call issue endpoint → on success reuse existing `handleDesktopAuthSuccess` / return-to-app UI («Возвращаемся в приложение…» + fallback link)
- [ ] JWT never placed in URL; only one-time `code` via existing deep-link / callback builders

### B4 — Failure / fallback

- [ ] On issue failure (401 / network / other): show short user-visible error
- [ ] Fall back to AuthForm (and/or re-run `checkAuth` then form) — no silent dead-end
- [ ] Stale cookie path covered by this fallback

### B5 — Register path

- [ ] Confirm `RegisterPage` still redirects to `/login` preserving `client` / `return_to`; no separate register-session UI
- [ ] Session-continue on redirected login covers the register-with-session edge case

## Files likely to change

| Area | Files |
|------|-------|
| Web pages | `CherryPlayWeb/src/pages/LoginPage.tsx`, possibly `LoginPage.css` |
| Web auth | `CherryPlayWeb/src/services/authService.ts` |
| Shared (optional) | `CherryPlayComponents` types only if needed for response shape |
| Utils | Existing `desktopClientMode` helpers if present — extend only if required |

## Acceptance criteria

- [ ] Logged-in + `client=desktop` → session-continue with «Войти»; no AuthForm; no auto-redirect on load
- [ ] Click «Войти» → code issued → existing return-to-app / deep-link path with `code`
- [ ] Logged out / expired → AuthForm unchanged
- [ ] Issue failure → visible error + path back to AuthForm
- [ ] Works for cookie sessions from email login **or** OAuth
- [ ] Non-desktop `/login` unchanged
- [ ] `npm run lint:fix` passes in CherryPlayWeb (and CherryPlayComponents if touched)

## Testing / smoke notes

- Browser with active web session: open `/login?client=desktop` → see «Войти» only
- Click → observe deep link / callback URL with `code` (Desktop exchange smoke with running app if available)
- Incognito / logged out → AuthForm
- Force stale cookie (or mock 401) → error + AuthForm fallback
- `/login` without `client` → cabinet path after normal login (regression)
