# Architecture — CherryPlay

One-page overview for developers and screeners. Contracts and DTO details live in [CONTRACTS.md](CONTRACTS.md). Glossary: [GLOSSARY.md](GLOSSARY.md).

**Live:** [https://cherrypashkaparty.ru](https://cherrypashkaparty.ru)

## Runtime flow

```text
┌─────────────────────┐     REST + SignalR      ┌──────────────────────────┐
│ CherryPlayList      │ ───────────────────────► │ CherryPlayServer         │
│ (Electron organizer)│ ◄─────────────────────── │ .NET 9 / ASP.NET Core    │
│ optional: AIMP pipe │                          │ Hub: /partyHub           │
└─────────────────────┘                          │ EF Core → PostgreSQL     │
                                                 └────────────┬─────────────┘
                                                              │ REST + SignalR
                                                              ▼
                                                 ┌──────────────────────────┐
                                                 │ CherryPlayWeb (guests)   │
                                                 │ catalog + party pages    │
                                                 └──────────────────────────┘
```

Short form used in the root README:

```text
Electron (organizer) → API + SignalR (.NET 9) → Web (guests)
```

AIMP path (optional): plugin → named pipe → CherryPlayList → same API/SignalR → Web. See [docs/integration/aimp-streaming.md](docs/integration/aimp-streaming.md).

## Bounded contexts

| Context | Owner | Responsibility |
|---------|--------|----------------|
| **Accounts & Auth** | Server + Web/List clients | Organizer JWT (email/password, OAuth); anonymous viewers. [docs/integration/accounts-and-auth.md](docs/integration/accounts-and-auth.md) |
| **Party Management** | Server + organizer clients | Parties, playlist publish, catalog/unlisted, themes/entitlements. [docs/integration/party-management.md](docs/integration/party-management.md) |
| **Streaming** | Server Hub + List + Web | Live session/playback state over SignalR. [docs/integration/streaming.md](docs/integration/streaming.md) |
| **Branding / themes** | Components + Server catalog | PartyTheme UI; package entitlements on server. [ADDING_THEME.md](ADDING_THEME.md), [GLOSSARY.md](GLOSSARY.md) |
| **Ops** | Server + deploy | Health, rate limits, backups, Docker/CI. [CherryPlayServer/OPS.md](CherryPlayServer/OPS.md), [.github/DEPLOYMENT.md](.github/DEPLOYMENT.md) |

Roles (`viewer` / `organizer` / `admin`) and API surface: [CONTRACTS.md](CONTRACTS.md) §1–§3. Product MVP boundaries: [RELEASE_PLAN.md](RELEASE_PLAN.md).

## Persistence: dual InMemory / EF (intentional)

CherryPlayServer supports **two storage modes** behind the same repository interfaces. Switch via config flag `UseInMemoryStorage` in `CherryPlayServer/Program.cs` (also `appsettings*.json` / env).

| Mode | When | Behavior |
|------|------|----------|
| **EF Core + PostgreSQL** (`UseInMemoryStorage=false`) | **Production** and normal local/Docker with DB | `AppDbContext` + EF repositories; migrations on startup when enabled. Schema: [CherryPlayServer/DATABASE.md](CherryPlayServer/DATABASE.md) |
| **In-memory repositories** (`UseInMemoryStorage=true`) | Local/dev or tests **without** PostgreSQL | Singleton in-memory repos; same domain/API/SignalR surface; data is process-local and non-durable |

This is an **intentional** dual path — not a half-migration. Prod always uses PostgreSQL. Details and run notes: [CherryPlayServer/README.md](CherryPlayServer/README.md).

## Key entry points

| Piece | Path / doc |
|-------|------------|
| Server README | [CherryPlayServer/README.md](CherryPlayServer/README.md) |
| Solution (Server + Tests) | [CherryPlay.sln](CherryPlay.sln) — `dotnet build CherryPlay.sln` |
| SignalR hub | `CherryPlayServer/Hubs/PartyHub` (+ partials); contracts in [CONTRACTS.md](CONTRACTS.md) |
| Database schema | [CherryPlayServer/DATABASE.md](CherryPlayServer/DATABASE.md) |
| REST + SignalR contracts | [CONTRACTS.md](CONTRACTS.md) |
| Integration hubs | [docs/integration/README.md](docs/integration/README.md) |
| Resume screenshots | [docs/resume/README.md](docs/resume/README.md) |

## PR hygiene (soft guidance)

Prefer clear, packaging-oriented PR descriptions for future changes. **Do not** rewrite existing git history or force-push to rewrite past commit messages.
