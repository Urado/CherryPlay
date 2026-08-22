# CP-065 Subtask 06 — Documentation: contracts and integration guides

## Type

**Documentation**

## Project

Repository docs (`CONTRACTS.md`, `docs/integration/`, `CherryPlayServer/DATABASE.md`, Desktop BUILD/ENV notes)

## Goal and scope

Document the desktop browser SSO flow, new API endpoints, deep link contract, code TTL/semantics, and Desktop `webBaseUrl` configuration. Update integration guide for «Логин в CherryPlayList» to reflect removal of inline auth.

## Dependencies

- **Subtasks 01–05 functionally complete** — document actual implemented behavior (endpoint paths, response shapes, TTL, deep link format)
- Can draft structure early; finalize after implementation stabilizes

## Checklist

### CONTRACTS.md

- [ ] Add new §3.2.x «Desktop browser SSO»
- [ ] Document `POST /auth/desktop/exchange`: request `{ code, deviceId? }`, response `{ accessToken }`, 401 cases
- [ ] Document code issuance: server returns `{ code }` on login/register when `client=desktop`; OAuth callback redirect format
- [ ] Deep link contract: `cherryplaylist://auth?code={rawCode}`; JWT never in URL
- [ ] TTL: 3 minutes; one-time use; hash-at-rest
- [ ] Note Desktop no longer uses inline email auth or direct `/auth/{provider}/start`
- [ ] Note legacy `POST /auth/exchange` (OAuth provider) may remain but is unused by new Desktop UI

### Integration guide

- [ ] Update `docs/integration/accounts-and-auth.md` section «Логин в CherryPlayList»:
  - Browser SSO flow diagram or step list
  - `client=desktop` on web login/register
  - Dev equivalent: protocol + optional `/auth/callback` on 5173

### Database

- [ ] Update `CherryPlayServer/DATABASE.md`: `DesktopAuthCodes` table columns, indexes, TTL semantics

### Config / build

- [ ] Document `webBaseUrl` in Desktop config (`serverConfig.*.json`) — e.g. `CherryPlayList/BUILD.md` or `ENV.md` if that is the project convention for Desktop env/config
- [ ] Cross-link `PUBLIC_WEB_BASE_URL` on server (web URL Desktop should open)

### CP-038 note

- [ ] Document dependency: when CP-038 ships, consent checkboxes live on web register only; no Desktop duplication

## Files likely to change

| Doc | Path |
|-----|------|
| Contracts | `CONTRACTS.md` |
| Integration | `docs/integration/accounts-and-auth.md` |
| Database | `CherryPlayServer/DATABASE.md` |
| Desktop config | `CherryPlayList/BUILD.md` and/or root `ENV.md` (follow existing convention) |
| Optional | `DOCUMENTATION_MAP.yaml` only if new doc files added (prefer editing existing linked docs) |

## Acceptance criteria

- [ ] `CONTRACTS.md` describes desktop exchange API and deep link format accurately
- [ ] `accounts-and-auth.md` describes new Desktop login flow (browser → code → exchange)
- [ ] `DATABASE.md` documents `DesktopAuthCodes`
- [ ] Desktop `webBaseUrl` configuration documented with dev/prod defaults
- [ ] Docs consistent with implemented code (no invented endpoints)
- [ ] Cross-links between CONTRACTS, integration guide, and DATABASE resolve correctly

## Testing / smoke notes

- Reviewer walkthrough: follow docs only to understand happy path and error cases
- Verify example URLs match defaults (`localhost:3000` dev, `cherrypashkaparty.ru` prod)
- Confirm task card checkbox «Contracts updated» satisfied
- No application code changes in this subtask unless a doc-linked comment in code is required (prefer docs-only)
