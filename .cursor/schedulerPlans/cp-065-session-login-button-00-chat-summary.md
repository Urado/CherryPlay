Temporary orchestration file; may be deleted after run.

# CP-065 follow-up — Session login button (no password re-entry)

## Restatement

When CherryPlayList opens browser SSO (`/login?client=desktop`) and the user is **already logged in** on CherryPlayWeb (active cookie/session), the web page must **not** ask for password again. Instead show a confirmation UI with a **«Войти»** button; on click, issue a one-time desktop auth code and return to the app via the existing deep-link / exchange flow.

## Context

- Parent feature: CP-065 Desktop browser SSO (already implemented: `client=desktop`, `POST /auth/desktop/exchange`, deep link `cherryplaylist://auth?code=…`).
- Gap: `LoginPage` always shows `AuthForm` even when web session exists.
- Desktop verified: when not authenticated, app has no account info (`AccountView` shows only `BrowserLoginPanel`; store `accessToken`/`organizer` are null until login).

## User answers (discovery)

1. **Different account concern:** Invalid for Desktop — no account data until logged in. Use whatever account is already signed in on the web.
2. **UX:** Not auto-redirect. Show a **«Войти»** button (one click, no password).
3. **OAuth:** Separate polish later; the session-based path must work for **all** session types (email and OAuth cookies alike).
4. **Scope:** Refinement of current CP-065, not a brand-new large initiative — but run structured orchestration for this follow-up.

## Assumptions

- Existing `POST /auth/desktop/code` (or equivalent authenticated issue endpoint) may already exist from CP-065; reuse if present.
- Web `checkAuth` / cookie session is the source of truth for “already logged in”.
- If session missing/expired → keep current password/OAuth login form.
- JWT never in URL; only one-time code → Desktop exchange.

## Risks

- Stale cookie → issue code fails → must fall back to form or clear error + form.
- Register page in desktop mode with existing session — decide in spec (likely same button or redirect to login desktop mode).
- Docs (`CONTRACTS.md` §3.2.0b) need a short note on session-continuation UX.

## Minimal path

1. Web `/login?client=desktop`: on mount, if authenticated → session-continue UI with «Войти».
2. Button → issue desktop code (authenticated API) → existing return-to-app redirect.
3. Docs update for contracts/integration if behavior is contract-visible.
4. No Desktop Electron changes expected unless deep-link already works (it should).

## Acceptance criteria (from discovery)

- [ ] Logged-in web session + desktop client → no password fields; «Войти» button visible.
- [ ] Click «Войти» → deep link with code → Desktop auto-login.
- [ ] Not logged in → existing AuthForm unchanged.
- [ ] Works for any existing web session (email or OAuth-established).
- [ ] No JWT in URL.
