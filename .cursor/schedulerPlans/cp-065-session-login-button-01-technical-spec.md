Temporary orchestration file; may be deleted after run.

# CP-065 follow-up — Session login button — Technical Specification (Stage 1)

## Restatement of the ask

When CherryPlayList opens browser SSO (`/login?client=desktop`) and the user already has an active CherryPlayWeb session (cookie), do **not** show the password/OAuth form and do **not** auto-redirect. Show a confirmation UI with a **«Войти»** button; on click, issue a one-time desktop auth code from the existing session and return to the app via the existing deep-link / `POST /auth/desktop/exchange` flow.

---

## Current state vs gaps

### Already exists (parent CP-065)

| Area | What works today |
|------|------------------|
| **Server** | `DesktopAuthCode` persistence + `IDesktopAuthCodeService.IssueCodeAsync` / `ExchangeAsync`; `POST /auth/desktop/exchange`; code issued on desktop-mode `POST /auth/login`, `POST /auth/register`, and OAuth callback with `client=desktop` in state. |
| **Web** | `LoginPage` + `AuthForm` with `client=desktop` → `onDesktopAuthSuccess(code)` → `buildAuthReturnUrl` / deep link; `RegisterPage` redirects to `/login` preserving `client` / `return_to`. |
| **Desktop** | Browser open of `{webBaseUrl}/login?client=desktop`; deep link / dev callback → exchange → JWT → auto-login. No organizer account in Desktop until login succeeds. |
| **Contracts** | `CONTRACTS.md` §3.2.0b documents exchange + issuance via login/register/OAuth only. |

### Gaps (this follow-up)

| Gap | Evidence | Needed |
|-----|----------|--------|
| **No authenticated “issue code for current session” API** | `AuthController` exposes only `POST /auth/desktop/exchange`; no `POST /auth/desktop/code` (or equivalent). Issuance only after fresh login/register/OAuth. | **Backend:** add cookie-authenticated issue endpoint reusing `IssueCodeAsync`. |
| **LoginPage ignores existing web session in desktop mode** | `LoginPage` always renders `AuthForm`; `checkAuth` is used only after non-desktop login success (cabinet navigate). | **Frontend (Web):** on mount in `client=desktop`, if session valid → session-continue UI with «Войти». |
| **Contracts omit session-continuation UX** | §3.2.0b flow step 2 assumes email/password or OAuth every time. | **Documentation:** short note + new issuance row for authenticated code issue. |

### Explicitly out of scope / no change expected

- Desktop/Electron deep-link and exchange wiring (already done).
- Auto-redirect without button click (rejected in discovery).
- Password re-entry or “pick another account” on Desktop (Desktop has no account until login).
- OAuth UI polish beyond ensuring session-based path works for **any** web session (email or OAuth-established cookie).
- Editing pre-existing automated tests without user confirmation (add **new** tests only if needed).

---

## Target UX / flow

```
Desktop opens /login?client=desktop
        │
        ▼
Web: checkAuth (cookie session)
        │
        ├── not authenticated → existing AuthForm (email + OAuth)  [unchanged]
        │
        └── authenticated → session-continue panel
                              title/copy + button «Войти»
                              (NO password fields, NO auto-redirect)
                                    │
                                    ▼ click
                              POST /auth/desktop/code (credentials/cookies)
                                    │
                                    ├── 200 { code } → existing return-to-app
                                    │   (buildAuthReturnUrl / deep link)
                                    │
                                    └── 401 / failure → clear error + fall back
                                        to AuthForm (or re-checkAuth → form)
```

**Register in desktop mode:** `RegisterPage` already redirects to `/login?client=desktop` (+ `return_to`). Same session-continue UI applies; no separate register-session UI required.

---

## Assumptions

1. Web `checkAuth` / organizer session endpoints (`session/check` + `/me` with cookies) are the source of truth for “already logged in”.
2. Whatever organizer is signed in on the web is the account to hand to Desktop (discovery: different-account concern invalid for Desktop pre-login).
3. `IDesktopAuthCodeService.IssueCodeAsync` can be reused unchanged; only a new controller entry point is missing.
4. New issue endpoint authenticates via existing organizer cookie / `[AuthorizeOrganizer]` (same pattern as `POST /auth/logout`, `change-password`).
5. JWT never appears in the URL; only the one-time code goes into the deep link.
6. Session missing or expired → keep current AuthForm behavior.
7. Desktop Electron changes are not required if deep-link + exchange already work (they should).

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Stale / expired cookie** | User sees «Войти», click fails | On issue failure (401): show short error and fall back to AuthForm; optionally re-run `checkAuth`. |
| **Missing backend endpoint** | Frontend cannot complete flow without password | Ship backend `POST /auth/desktop/code` before or with web UI (backend is a hard dependency). |
| **Auto-redirect temptation** | Violates discovery UX | Spec/acceptance forbid auto-issue or auto-redirect on mount. |
| **Register edge case** | User lands on register with session | Already redirects to login; session-continue covers it. |
| **Docs drift** | Integrators miss session-continue path | Update `CONTRACTS.md` §3.2.0b (+ integration doc if it restates the flow). |
| **Pre-existing tests** | Blocked if workers edit old tests | Add **new** server test file(s) only unless user confirms editing existing ones. |

---

## Minimal path

Ordered, smallest set of changes:

1. **Backend (required — endpoint gap confirmed):** Add authenticated `POST /auth/desktop/code` (name may match contracts; body empty or optional `deviceId` unused for issue). Resolve organizer from cookie → `IssueCodeAsync` → `200 { code }` (`DesktopAuthCodeResponse`). `401` if unauthenticated / invalid session. Reuse existing TTL / one-time / hash semantics. New test file preferred.
2. **Frontend Web (primary UX):** On `LoginPage` when `client=desktop`:
   - Mount: call `checkAuth` (loading state).
   - If organizer present → render session-continue UI with **«Войти»** (no AuthForm, no auto-redirect).
   - Click → call issue endpoint with `credentials: 'include'` → on success reuse `handleDesktopAuthSuccess` / existing return-to-app UI.
   - If not authenticated → existing AuthForm unchanged.
   - On issue failure → error + fall back to form.
3. **Documentation:** Extend §3.2.0b issuance table + happy-path bullet for session continuation; mirror in `docs/integration/accounts-and-auth.md` if that flow list is authoritative for Desktop login.
4. **Desktop/Electron:** None expected.

---

## Acceptance criteria

- [ ] Logged-in web session + `client=desktop` → **no** password/OAuth form; **«Войти»** button visible; **no** auto-redirect on load.
- [ ] Click «Войти» → authenticated issue of one-time code → deep link (or dev callback) with `code` → Desktop exchange → auto-login.
- [ ] Not logged in / expired session → existing AuthForm unchanged.
- [ ] Works for any existing web session type (email login cookie or OAuth-established cookie).
- [ ] JWT never in URL; only one-time code in deep link.
- [ ] Failed issue (stale cookie) → user-visible error and path back to AuthForm (no silent dead-end).
- [ ] `CONTRACTS.md` §3.2.0b documents authenticated code issuance + session-continue UX (integration doc updated if it duplicates the Desktop login sequence).
- [ ] Non-desktop `/login` behavior unchanged (still AuthForm → cabinet).

---

## Constraints

- Analysis/orchestration only produced this spec; workers implement.
- No code comments in application source (project rule).
- After TS changes in CherryPlayWeb: `npm run lint:fix`.
- Do not edit pre-existing tests without explicit user confirmation; prefer new test files.
- Do not change Desktop Electron unless smoke proves deep-link regression (unlikely).
- Do not auto-redirect or auto-issue code on page load.
- Reuse existing return-to-app UI (`Возвращаемся в приложение…` + fallback link), deep-link builders, and exchange path.

---

## Suggested worker split

| Order | Worker | Scope | Depends on |
|-------|--------|-------|------------|
| 1 | **worker-dotnet** | `POST /auth/desktop/code` (or agreed path) + auth + response shape + **new** tests | — |
| 2 | **worker-frontend** (CherryPlayWeb) | `LoginPage` session detect + «Войти» UI + `authService` method to call issue endpoint; wire to existing desktop return flow | Step 1 |
| 3 | **worker-documentation** | `CONTRACTS.md` §3.2.0b (+ `docs/integration/accounts-and-auth.md` as needed) | Steps 1–2 (or parallel after API shape frozen) |
| — | **worker-electron** | **None** unless exchange/deep-link breaks | — |

**Primary:** Frontend web. **Backend:** required because authenticated issue endpoint is **missing** today. **Documentation:** yes (contract-visible behavior). **Desktop:** likely none.

---

## Follow-ups (deferred)

- OAuth-specific polish on the session-continue screen (discovery: later).
- Optional display of signed-in email/name on the «Войти» panel (nice-to-have; not required for acceptance).
- Rate-limit messaging parity with other auth endpoints if not already covered by global auth policy.

---

## API sketch (for scheduler / workers)

| Method | Path | Auth | Body | Success | Errors |
|--------|------|------|------|---------|--------|
| POST | `/auth/desktop/code` | Organizer cookie (`[AuthorizeOrganizer]`) | none (or `{}`) | `200 { code: string }` | `401` unauthenticated / invalid session |

Issuance semantics identical to desktop login/register: TTL 3 min, one-time, hash-only storage, then client uses existing `POST /auth/desktop/exchange`.
