# CP-065 Session Login Button Subtask 04 — Documentation: session-continue contracts

## Type

**Documentation**

## Project

Repository docs (`CONTRACTS.md`, `docs/integration/accounts-and-auth.md`)

## Worker

**worker-documentation**

## Goal and scope

Document authenticated desktop code issuance (`POST /auth/desktop/code`) and the session-continue UX on `/login?client=desktop` (confirmation «Войти», no auto-redirect). Extend existing CP-065 §3.2.0b coverage; mirror in the integration guide only if it restates the Desktop login sequence.

## Dependencies

- **Subtasks 02–03** preferred for final accuracy (endpoint path, response shape, UX copy/behavior)
- Can draft after Step 1 freezes the API sketch; finalize after Step 2 lands
- Does **not** require Desktop/Electron changes

## Checklist

### C1 — CONTRACTS.md §3.2.0b

- [ ] Add issuance row for authenticated `POST /auth/desktop/code`: organizer cookie (`[AuthorizeOrganizer]`), body none/`{}`, success `200 { code }`, `401` if unauthenticated
- [ ] Note issuance semantics identical to desktop login/register (TTL 3 min, one-time, hash-at-rest); client still uses `POST /auth/desktop/exchange`
- [ ] Add happy-path / flow bullet: existing web session + `client=desktop` → session-continue UI → user clicks «Войти» → issue code → deep link (no password/OAuth form, no auto-redirect)
- [ ] Clarify JWT never in URL (unchanged rule)
- [ ] Keep existing login/register/OAuth issuance rows; do not remove them

### C2 — Integration guide

- [ ] Update `docs/integration/accounts-and-auth.md` **only if** it duplicates the Desktop login sequence: add session-continue step for already-authenticated web cookie
- [ ] Cross-link to `CONTRACTS.md` §3.2.0b for API details
- [ ] Skip unrelated DATABASE / BUILD / ENV churn unless contracts reference something new (expected: none — no new tables)

### C3 — Consistency

- [ ] Docs match implemented paths and response shapes from subtasks 02–03
- [ ] No invented endpoints or auto-redirect wording

## Files likely to change

| Doc | Path |
|-----|------|
| Contracts | `CONTRACTS.md` (§3.2.0b) |
| Integration | `docs/integration/accounts-and-auth.md` (if Desktop login flow listed there) |

## Acceptance criteria

- [ ] `CONTRACTS.md` §3.2.0b documents authenticated code issuance + session-continue UX
- [ ] Integration doc updated if it restates Desktop login; otherwise left consistent via contracts cross-link
- [ ] Docs forbid implying auto-redirect / auto-issue on page load
- [ ] Docs consistent with code (no invented behavior)
- [ ] No application code changes in this subtask

## Testing / smoke notes

- Reviewer walkthrough: read §3.2.0b alone and reconstruct happy path + failure (401 → form)
- Confirm task-card checkbox for contracts / integration satisfied
- Spot-check that parent CP-065 exchange/deep-link docs remain accurate
