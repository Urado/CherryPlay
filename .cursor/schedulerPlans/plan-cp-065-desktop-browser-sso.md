# CP-065 — Desktop browser SSO — Execution Plan

## Task summary

Replace CherryPlayList inline email/password login and registration with unified browser SSO through CherryPlayWeb. Desktop opens `/login?client=desktop` in the system browser; after email/password or OAuth on the web, the user returns via deep link with a **one-time code** (never JWT); Desktop exchanges the code via `POST /auth/desktop/exchange` and completes auto-login.

**Source specs:** [cp-065-desktop-browser-sso-00-chat-summary.md](./cp-065-desktop-browser-sso-00-chat-summary.md), [cp-065-desktop-browser-sso-01-technical-spec.md](./cp-065-desktop-browser-sso-01-technical-spec.md)

## Execution order and dependencies

```
[02 Backend] ──┬──► [03 Web client=desktop]
               │
               └──► [04 Electron deep link + config]
                         │
                         ▼
                    [05 Desktop UI + authService]
                         │
                         ▼
                    [06 Documentation]
```

| Step | Subtask file | Type | Worker | Depends on |
|------|--------------|------|--------|------------|
| 1 | [cp-065-desktop-browser-sso-02-backend-desktop-auth-codes.md](./cp-065-desktop-browser-sso-02-backend-desktop-auth-codes.md) | Backend | worker-dotnet | — |
| 2 | [cp-065-desktop-browser-sso-03-frontend-web-client-desktop.md](./cp-065-desktop-browser-sso-03-frontend-web-client-desktop.md) | Frontend | worker-frontend (CherryPlayWeb) | Step 1 |
| 3 | [cp-065-desktop-browser-sso-04-desktop-electron-deeplink.md](./cp-065-desktop-browser-sso-04-desktop-electron-deeplink.md) | Desktop/Electron | worker-electron | Step 1 |
| 4 | [cp-065-desktop-browser-sso-05-frontend-desktop-ui-auth.md](./cp-065-desktop-browser-sso-05-frontend-desktop-ui-auth.md) | Frontend | worker-frontend (CherryPlayList) | Steps 1, 3 |
| 5 | [cp-065-desktop-browser-sso-06-documentation-contracts.md](./cp-065-desktop-browser-sso-06-documentation-contracts.md) | Documentation | worker-documentation | Steps 1–4 |

**Parallelism:** Steps 2 and 3 can run in parallel after Step 1 completes. Step 4 requires Steps 1 and 3 (Step 2 needed for end-to-end smoke but UI can be wired against exchange endpoint once Electron callback exists). Step 5 follows functional completion of Steps 1–4.

## Out of scope

- CP-038/CP-044 consent UI implementation (web form remains single place when those land)
- Refresh tokens, Telegram OAuth, email verification
- Removing legacy `POST /auth/exchange` / `/auth/{provider}/start` from server
- Editing **pre-existing** automated tests without user confirmation
- Git commits (unless user asks)

## Global acceptance criteria (task card)

- [ ] Desktop has no inline email/password login/register; «Войти» opens browser
- [ ] Web `/login` and `/register` support `client=desktop`; success → `cherryplaylist://auth?code=...`, not `/cabinet`
- [ ] OAuth from web form in desktop mode uses same one-time code mechanism
- [ ] Server: `desktop_auth_codes` + `POST /auth/desktop/exchange` → `{ accessToken }`
- [ ] Code one-time, TTL 2–5 min; JWT never in URL
- [ ] Desktop deep link → exchange → JWT → auto-login
- [ ] Dev flow: `cherryplaylist://` and/or `http://localhost:5173/auth/callback?code=` equivalent
- [ ] Contracts updated: `CONTRACTS.md`, `docs/integration/accounts-and-auth.md`, `DATABASE.md`

## Post-implementation smoke (manual)

Run after all subtasks complete:

1. Email login → return to app → auto-login
2. Email register → return to app
3. OAuth VK and Mail.ru from web form in desktop mode
4. Repeat login (code single-use)
5. Expired code → 401, user-friendly error in Desktop
6. Dev: deep link or `/auth/callback` equivalent
7. Web-only login (`client` absent) still goes to `/cabinet` (regression)

## Project rules reminder

- No code comments in application source (strip on edit)
- Run `npm run lint:fix` in CherryPlayList, CherryPlayWeb, CherryPlayComponents after TS changes
- Read linked project docs; treat `CONTRACTS.md` as API source of truth
- Add **new** server test file(s) only; do not edit pre-existing tests without user confirmation
