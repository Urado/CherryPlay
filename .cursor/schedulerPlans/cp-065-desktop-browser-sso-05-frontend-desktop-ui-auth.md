# CP-065 Subtask 05 — Desktop UI: remove inline auth, browser SSO button

## Type

**Frontend**

## Project

CherryPlayList (renderer UI — AccountView, party overlay, auth waiting states)

## Goal and scope

Remove inline email/password login and registration from Desktop UI; replace with «Войти» / «Войти через браузер» CTA that calls `startBrowserLogin()`. Update party editor blocked overlay to match. Show loading/error states while waiting for deep link return. Forgot-password and change-password flows remain as today.

## Dependencies

- **Subtask 02 (Backend)** — exchange endpoint must work
- **Subtask 04 (Desktop/Electron)** — `startBrowserLogin()`, unified callback registration, and `exchangeDesktopCode` must be wired before UI can complete login
- **Subtask 03 (Web)** — required for full E2E smoke; UI can be implemented once Subtask 04 services exist

## Checklist

### UI replacements

- [ ] `AccountView`: remove `AuthForm` / `EmailAuthForm` for unauthenticated state
- [ ] Show primary button «Войти» (or «Войти через браузер») → `startBrowserLogin()`
- [ ] Keep forgot-password entry (inline or link to web) — **not** part of login/register form removal scope
- [ ] `PartyEditorBlockedOverlay`: replace inline `AuthForm` with same browser-login CTA

### Waiting and error states

- [ ] Reuse or adapt OAuth waiting pattern: loading while browser auth in progress
- [ ] On deep link return failure (expired code, network): show user-friendly RU error; allow retry
- [ ] On success: auto-close waiting state; user lands logged in (session from Subtask 04 callback)

### Cleanup

- [ ] Remove Desktop UI calls to `authService.login`, `authService.register`, `authService.startOAuthFlow` from AccountView and overlay
- [ ] Keep service methods temporarily for demo/web-demo stubs unless dead-code lint requires removal
- [ ] Ensure party workspace refreshes via auth store after login (not duplicate callback in `usePartyWorkspaceEffects`)

### Demo mode

- [ ] Demo/fixtures auth unchanged — no browser SSO in demo path

## Files likely to change

| Area | Files |
|------|-------|
| Account UI | `CherryPlayList/src/.../AccountView.tsx` (or equivalent path) |
| Party | `CherryPlayList/src/workspaces/party/PartyEditorBlockedOverlay.tsx` |
| Effects | `CherryPlayList/src/workspaces/party/usePartyWorkspaceEffects.ts` (react to auth store only) |
| Services | `CherryPlayList/src/shared/services/authService.ts` (UI-facing exports used by views) |

## Acceptance criteria

- [ ] Unauthenticated Desktop shows no email/password fields and no inline OAuth buttons
- [ ] «Войти» opens system browser at `{webBaseUrl}/login?client=desktop`
- [ ] `PartyEditorBlockedOverlay` uses same browser-login CTA (no inline `AuthForm`)
- [ ] After successful web auth + deep link, user is auto-logged in without manual token entry
- [ ] Forgot-password and change-password (when logged in) behave as before
- [ ] Demo mode unaffected
- [ ] `npm run lint:fix` passes in CherryPlayList

## Testing / smoke notes

- Manual E2E (requires Subtasks 02–04 complete):
  1. Click «Войти» → browser opens web login
  2. Email login → app receives deep link → auto-login
  3. Log out → register via browser → auto-login
  4. OAuth VK/Mail.ru from web form in desktop mode
  5. Party editor blocked state shows browser CTA, not inline form
- Verify no `AuthForm` render in Desktop unauthenticated paths (grep)
- JWT never visible in URL or UI logs
