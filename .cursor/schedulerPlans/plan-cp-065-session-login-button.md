# CP-065 follow-up — Session login button — Execution Plan

## Task summary

When CherryPlayList opens browser SSO (`/login?client=desktop`) and the user already has an active CherryPlayWeb session (cookie), do **not** show the password/OAuth form and do **not** auto-redirect. Show a confirmation UI with a **«Войти»** button; on click, issue a one-time desktop auth code from the existing session via authenticated `POST /auth/desktop/code`, then return to the app through the existing deep-link / `POST /auth/desktop/exchange` flow.

**Source specs:** [cp-065-session-login-button-00-chat-summary.md](./cp-065-session-login-button-00-chat-summary.md), [cp-065-session-login-button-01-technical-spec.md](./cp-065-session-login-button-01-technical-spec.md)

**Parent feature:** CP-065 Desktop browser SSO (codes, exchange, deep link already exist).

## Execution order and dependencies

```
[02 Backend issue endpoint]
         │
         ▼
[03 Web LoginPage session-continue UI]
         │
         ▼
[04 Documentation contracts]
```

| Step | Subtask file | Type | Worker | Depends on |
|------|--------------|------|--------|------------|
| 1 | [cp-065-session-login-button-02-backend-desktop-code-issue.md](./cp-065-session-login-button-02-backend-desktop-code-issue.md) | Backend | worker-dotnet | — |
| 2 | [cp-065-session-login-button-03-frontend-web-session-continue.md](./cp-065-session-login-button-03-frontend-web-session-continue.md) | Frontend | worker-frontend (CherryPlayWeb) | Step 1 |
| 3 | [cp-065-session-login-button-04-documentation-contracts.md](./cp-065-session-login-button-04-documentation-contracts.md) | Documentation | worker-documentation | Steps 1–2 (or draft after API shape frozen) |

**Parallelism:** Step 3 can draft once the API path/response shape from Step 1 is frozen; finalize after Step 2 UX lands. Steps 1 → 2 are strictly sequential (frontend hard-depends on the new endpoint).

## Out of scope

- Desktop/Electron deep-link and exchange wiring (already done in parent CP-065)
- Auto-redirect or auto-issue code on page load (explicitly rejected)
- Password re-entry or “pick another account” on Desktop
- OAuth-specific polish on the session-continue screen (deferred)
- Optional display of signed-in email/name on the «Войти» panel (nice-to-have, not required)
- Editing **pre-existing** automated tests without user confirmation
- Git commits (unless user asks)

## Global acceptance criteria (task card)

- [ ] Logged-in web session + `client=desktop` → **no** password/OAuth form; **«Войти»** button visible; **no** auto-redirect on load
- [ ] Click «Войти» → authenticated issue of one-time code → deep link (or dev callback) with `code` → Desktop exchange → auto-login
- [ ] Not logged in / expired session → existing AuthForm unchanged
- [ ] Works for any existing web session type (email login cookie or OAuth-established cookie)
- [ ] JWT never in URL; only one-time code in deep link
- [ ] Failed issue (stale cookie) → user-visible error and path back to AuthForm (no silent dead-end)
- [ ] `CONTRACTS.md` §3.2.0b documents authenticated code issuance + session-continue UX (integration doc updated if it duplicates the Desktop login sequence)
- [ ] Non-desktop `/login` behavior unchanged (still AuthForm → cabinet)

## Post-implementation smoke (manual)

Run after all subtasks complete:

1. Web already logged in → open `/login?client=desktop` → session-continue panel with «Войти» (no AuthForm, no auto-redirect)
2. Click «Войти» → deep link / callback with `code` → Desktop exchange → auto-login
3. Logged out / expired cookie → `/login?client=desktop` shows existing AuthForm
4. Stale cookie: issue returns 401 → error shown → fall back to AuthForm
5. Session established via OAuth on web → same session-continue path works
6. Non-desktop `/login` (no `client`) still AuthForm → `/cabinet` (regression)
7. Register with session already redirects to login; session-continue applies there

## Project rules reminder

- No code comments in application source (strip on edit)
- After TS changes in CherryPlayWeb: `npm run lint:fix`
- Read linked project docs; treat `CONTRACTS.md` as API source of truth
- Add **new** server test file(s) only; do not edit pre-existing tests without user confirmation
- Reuse existing return-to-app UI, deep-link builders, and exchange path
