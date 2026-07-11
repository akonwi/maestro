# Prediction Game Plan

## Product

A group-based scoreline prediction game for me and my friends. Pick the final score of every fixture before kickoff, earn points, chase the leaderboard.

**v1 covers MLS regular season only.** The system is designed to support additional competitions later (other leagues, cups, playoffs) as first-class citizens — nothing about the competition configuration or UI should hardcode MLS. See "Multi-competition forward compatibility" below.

### Scoring (v1)

- **3 points** — exact scoreline correct (2-1 predicted, 2-1 actual)
- **1 point** — outcome correct (home win / draw / away win) but scoreline wrong
- **0 points** — outcome wrong

### Rules (v1)

- One prediction per user per fixture.
- Deadline is kickoff time; predictions lock at kickoff.
- Predictions are private until kickoff, then visible to the group.
- Regular season only. Playoffs, Leagues Cup, US Open Cup deferred to later milestones.

## Product thesis

Two things matter:

1. **Small enough to actually ship.** Prediction games are the smallest coherent fantasy-adjacent mechanic. Data need is trivial (fixtures + final scores). No player prices, no formations, no live event data. This makes it a real weekend project instead of a half-year commitment.
2. **Room for the analysis I actually care about.** The core loop ("what do I think will happen? was I right?") is the same loop I want data to inform. Future milestones can bolt on form / xG / H2H hints without touching the core mechanic. See "Analysis embedding" below.

## Relationship to Maestro Desktop

The repo now contains two products both called "Maestro":

- `desktop/` — Maestro Desktop, a personal tactical analytics app (macOS, SwiftUI, API-Football).
- `server/` + `web/` — Maestro, a web-based MLS prediction game.

The naming is intentional (single brand across everything I build for football), but confusing when discussing "Maestro" without context. In this doc and going forward, "Maestro Desktop" refers to the desktop app; "Maestro" unqualified refers to the prediction game.

The two apps do **not** share code or data. They may eventually share design language, and Maestro Desktop's tactical insights may inform hints surfaced in the prediction game, but they remain independent products.

## Scope decisions

- **Competition scope for v1**: MLS regular season only. Additional competitions (playoffs, Leagues Cup, US Open Cup, other leagues) are deferred but the design must not preclude them.
- **Launch timing**: ship into the tail of the 2025 regular season. Fewer fixtures remaining is fine — it doubles as a live beta with friends. A full-season leaderboard restarts for 2026.
- **Users**: friend group only for v1. Invite-only. No public sign-up flow.
- **Data source**: **API-Football**, not football-data.org (which lacks MLS coverage). Same upstream as Maestro Desktop but a separate account/key so their rate limits don't collide.

## Architecture

### Layout

```
maestro/
├── desktop/     # existing SwiftUI app (Maestro Desktop)
├── server/      # NEW: Ard backend (this project)
├── web/         # NEW: TanStack Start web app (this project)
└── docs/        # cross-project plans (this file lives here)
```

### Server (`server/`)

Written in **Ard**, deployed to **Zeabur** as a static Go binary in a multi-stage Docker container.

Ard's stdlib is intentionally small; the idiomatic path for backend work is direct Go interop (`use go:...`) with project-local wrapper modules where an Ard-flavored API is worth having. Modules referenced here follow that pattern:

- **HTTP layer** — Go interop with `chi` (mirrors `examples/chi-server` in the Ard repo). Provides real middleware, sub-routers, path params, graceful shutdown.
- **JSON** — `use go:encoding/json` for encode/decode of typed structs. For non-trivial decoding of upstream API responses (nested, partial, missing fields), a project-local `decode.ard` module, copied from `../tinear/decode.ard`, providing composable decoders (`decode::field`, `decode::list`, `decode::nullable`, etc.) over Go's `Any` values.
- **Database** — project-local `sql.ard` module wrapping `use go:database/sql` + `use go:github.com/mattn/go-sqlite3` (or a pure-Go driver like `modernc.org/sqlite` if we want to avoid CGO). Storage is **SQLite** on a mounted volume on Zeabur. ~1ms query latency; standard SQL means we can migrate to Postgres later if needed. Considered Cloudflare D1 but rejected: from Zeabur every query becomes a 50–200ms HTTPS round-trip, and D1's value proposition (colocated with Workers) doesn't apply here.
- **Outbound HTTP** — Go interop with `net/http` for calls to API-Football and Resend. Wrapping in a small local `http.ard` helper module is optional.
- **Fixture data** — proxied from API-Football on demand rather than synced into SQLite. A shared in-memory TTL cache stores raw upstream JSON by URL, so many users refreshing within the cache window produce one API request. The app stores only game-owned data (users, groups, predictions, sessions, competition configuration).
- **Config** — `use go:os` for env vars (validated at startup); no config file for v1.
- **Migrations** — [`migr`](https://github.com/akonwi/migr) CLI, run at container startup by the entrypoint (`migr up` then `exec server`). SQL files as `NNN_name.up.sql` / `NNN_name.down.sql` under `server/migrations/`. Driven by `DATABASE_URL`.
  - **Gotcha (found in M1):** the published `migr` release binary is compiled CGO-free, but its `ard/sql` backend uses `mattn/go-sqlite3` which requires CGO, so the release's SQLite path is a non-functional stub. We therefore **build migr from source with CGO on** inside the Docker image, pinned to a commit that builds against Ard 0.25.0 (0.24.0 lacks needed syntax; current dev dropped the `ard/sql`/`ard/io`/`ard/argv`/`ard/decode` stdlib modules migr relies on). Local dev can use the Homebrew `migr` (built with CGO) directly.
- **TLS** — terminated at Zeabur's edge; server speaks plain HTTP internally.

Rough edges to expect from Ard's Go interop:
- Go variadics accept only one Ard argument (e.g. `signal.Notify` for a single signal at a time).
- Multi-return Go APIs with non-error second values (`context.WithTimeout`, `signal.NotifyContext`) don't map cleanly.
- Go errors arrive as `Void!Str` — compare error message strings rather than `errors.Is`.
- None of these block v1; they're just quirks to plan around.

### Web (`web/`)

**TanStack Start**, deployed as a **Cloudflare Worker** via wrangler.

- Framework: TanStack Start (React 19, TanStack Router as its foundation, first-class SSR + streaming, Cloudflare adapter).
- Data fetching: **TanStack Query** for client-side cache/state around the Ard server API.
- UI: **shadcn/ui** components on **Tailwind CSS v4**, matching the design language already established in `../ranger/web-app`. That project is the reference for theme, tokens, component conventions, and Biome config — we mirror it rather than reinventing.
- Linter/formatter: **Biome** (matches ranger).
- Package manager: **bun** (matches ranger).
- Deploy: `wrangler deploy`, Cloudflare Worker with the TanStack Start Cloudflare adapter. Static assets served from the Worker.
- All data comes from the Ard server on Zeabur over CORS.

### Email

**Resend** for magic-link delivery. 3000 emails/month free, trivial REST API, good Cloudflare integration if needed later. Cloudflare's Send API was considered but is still beta with limitations; MailChannels (the classic free CF option) discontinued its free tier in mid-2024.

### External services summary

| Service | Purpose | Cost at v1 scale |
|---|---|---|
| API-Football | Fixtures, scores, sync | Existing key; free tier likely sufficient |
| Resend | Magic-link email | Free (< 3000/mo) |
| Zeabur | Server hosting | Free/hobby tier |
| Cloudflare Workers | Web hosting (TanStack Start via wrangler) | Free |

## Data model (SQLite, v1)

```sql
users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER  -- unix ms
);

magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

competitions (
  id INTEGER PRIMARY KEY,           -- our own id
  api_football_league_id INTEGER NOT NULL, -- external league id
  name TEXT NOT NULL,               -- e.g. "MLS", "MLS Playoffs", "Premier League"
  season INTEGER NOT NULL,          -- e.g. 2025
  kind TEXT NOT NULL,               -- 'league' | 'cup' | 'playoff'
  is_active BOOLEAN NOT NULL DEFAULT 1, -- fixture proxy fetches active competitions
  UNIQUE (api_football_league_id, season)
);

-- Fixture and team data are fetched from API-Football and cached in
-- memory; they are not persisted in v1. Team crests come directly from
-- https://media.api-sports.io/football/teams/{id}.png.

predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  fixture_id INTEGER NOT NULL,       -- stable API-Football fixture id
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points INTEGER,                   -- null until fixture finishes
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, fixture_id)
);

groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  invite_code TEXT NOT NULL UNIQUE, -- random short code
  created_at INTEGER NOT NULL
);

group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
```

> Naming: we call them **groups** (not "leagues" or "private leagues") because "league" already means MLS / Premier League / etc. in this domain.

### Groups in v1

Groups are the primary social unit from day one — there is no global "everyone in one big pool" leaderboard. A user must be a member of at least one group to see any leaderboard. Every leaderboard endpoint is scoped to a `group_id`.

- **Onboarding**: after magic-link verify, if the user has no memberships, they're prompted to join via invite code or create a new group.
- **Invite codes**: short random strings (e.g. 8 chars, base32). Joining URL is `/join/:code`. Anyone with a valid code can join.
- **Creation**: any authenticated user can create a group; the creator becomes owner and first member.
- **Multiple memberships allowed**: a user can be in several groups (e.g. "work friends", "soccer chat"). The UI presents a group switcher; the API takes `group_id` as a required filter on leaderboard/consensus endpoints.
- **v1 owner privileges**: none beyond creation. No rename, no kick, no per-group scoring rules. Deferred.

#### Multi-competition forward compatibility

The `competitions` table is the mechanism. For v1 we seed exactly one row: MLS regular season 2026. The fixture proxy fetches `WHERE is_active = 1` rather than hardcoding a league ID. Adding playoffs later = insert a second row. Adding the Premier League next season = insert another row. No schema changes required.

A competition's `kind` lets the UI treat cups/playoffs differently (no draws allowed in playoff outcome scoring, group vs. knockout stage rendering, etc.) once we care.

The API surface (see below) accepts an optional `competition_id` filter but defaults to "all active competitions" so v1 clients don't need to know about the table.

## Fixture proxy + cache

Fixture endpoints fetch API-Football's season response for every active competition and cache the raw JSON in memory by upstream URL.

- Fixture responses use a hardcoded 60-second TTL.
- The cache is shared across request goroutines and protected by a Go `sync.RWMutex` behind an opaque pointer in `App`.
- Cache misses call API-Football; hits parse the cached JSON without network I/O.
- No fixture/team rows are written to SQLite in v1.
- Prediction deadlines and scoring will resolve fixture state through the same cached API client. Points can be computed lazily when a leaderboard is requested; persistent fixture storage can return when analysis requires history.

This keeps v1 operationally small while preserving stable references: predictions store API-Football fixture ids, so fixture history can be backfilled later.

## Scoring computation

On fixture finish:

```sql
UPDATE predictions
SET points = CASE
  WHEN home_score = :actual_home AND away_score = :actual_away THEN 3
  WHEN SIGN(home_score - away_score) = SIGN(:actual_home - :actual_away) THEN 1
  ELSE 0
END
WHERE fixture_id = :fixture_id;
```

## Auth flow (magic link)

1. `POST /auth/request { email }` — server creates `magic_links` row (token = 32 random bytes hex, expires in 15 min), sends email via Resend containing `https://<web-domain>/auth/verify?token=...`.
2. Web app hits `POST /auth/verify { token }` on the Ard server — server marks link consumed, creates or fetches user, creates a `sessions` row (30-day expiry), returns `{ session_token, user }`.
3. Web app stores `session_token` (localStorage) and sends it as `Authorization: Bearer <token>` on subsequent requests.
4. Middleware on protected routes reads the header, looks up the session, attaches `user_id` to the request context.
5. `POST /auth/logout` — requires bearer, deletes the session row.

## API sketch (v1)

```
POST /auth/request              body: { email }              -> 204
POST /auth/verify               body: { token }              -> { session_token, user }
POST /auth/logout                                            -> 204

GET  /me                                                     -> { user }
PATCH /me                       body: { display_name }       -> { user }

GET  /competitions                                           -> [{ id, name, season, kind }]
GET  /fixtures/upcoming[?competition_id=]                    -> [{ fixture, my_prediction }]
GET  /fixtures/recent[?competition_id=]                      -> [{ fixture, my_prediction, points }]
GET  /fixtures/:id?group_id=                                 -> { fixture, my_prediction, group_predictions (if locked) }
PUT  /fixtures/:id/prediction   body: { home, away }         -> { prediction }
DELETE /fixtures/:id/prediction                              -> 204

# Groups
GET  /groups                                                 -> [{ id, name, member_count }]    # my memberships
POST /groups                    body: { name }               -> { group, invite_code }
POST /groups/join               body: { invite_code }        -> { group }
GET  /groups/:id                                             -> { group, members }

# Leaderboards — always scoped to a group
GET  /groups/:id/leaderboard/season[?competition_id=]        -> [{ user, total_points, exact_count, outcome_count, played }]
GET  /groups/:id/leaderboard/week[?competition_id=]          -> [{ user, week_points, ... }]

GET  /me/history[?competition_id=]                           -> [{ fixture, prediction, points }]
```

`competition_id` filters are optional; omitted = union across active competitions. v1 client can safely ignore them.

CORS: allow the Worker origin. Since we use bearer tokens instead of cookies, cross-origin is uncomplicated.

## Analysis embedding (deferred, but design for it)

Not in v1. But v1 UI should leave holes for these:

- **Per-fixture card**: an expandable section that in v1 is empty, in v2 shows recent form, H2H, home/away splits.
- **After deadline**: a "consensus" strip showing what the group predicted. v1 shows split; v2 adds "you disagreed with 70% of the group."
- **Post-match**: v2 adds "xG-based lens" — was the result actually representative, or unlucky?
- **Season stats page**: v2 tab for accuracy-by-league, accuracy-vs-favorites, best/worst matchups.

The point: v1 ships a working game. v2+ makes it a *learning tool about football*, which is the actual long-term appeal.

## Milestones

### M1 — Server foundation

- Ard project scaffolded per `examples/chi-server` pattern.
- Local `sql.ard` module wrapping Go's `database/sql` + SQLite driver.
- Local `decode.ard` module copied from `../tinear/decode.ard`.
- `migr` wired into the container entrypoint; first migration creates the full v1 schema (users, magic_links, sessions, competitions, teams, fixtures, predictions, groups, group_members).
- Seed row for MLS 2026 regular season in `competitions`.
- Health endpoint that verifies DB connectivity.
- Dockerfile that builds Ard from `main` and runs cleanly.
- Local dev workflow documented in `server/README.md`.

### M2 — Auth

- Magic-link request/verify flow.
- Bearer-token sessions, auth middleware reading `Authorization` header.
- Resend integration (real emails in dev too, via a test address).

### M3 — Cached fixture proxy (server)

- API-Football client module, driven by active competitions.
- Shared in-memory TTL cache for raw upstream responses; no background
  worker and no local fixture/team persistence in v1.
- `GET /fixtures/upcoming` and `GET /fixtures/:id` — **public-only** in this
  milestone. No `my_prediction` / `group_predictions` enrichment yet; those
  fields need auth middleware, which lands with predictions (M5). The
  response shape may still evolve when the UI consumes it in M4.
- Fixture responses use a hardcoded 60-second TTL.

### M4 — Web scaffold + fixtures UI

- Scaffold `web/` with TanStack Start, matching the ranger/web-app setup
  (React 19, Tailwind v4, shadcn/ui, Biome, bun, wrangler).
- Port ranger's theme tokens as the starting point.
- Fixture list + fixture detail screens against the real M3 endpoints.
- **UI drives API refinement**: where the screens want different
  shapes/groupings than M3 shipped, the endpoints change to match. The
  UI is the spec; the server follows.
- No auth in the web app yet — fixtures are public reads.

### M5 — Auth UI + groups + predictions

- Web: magic-link login flow (request → email → verify → bearer in
  localStorage), authed session handling.
- Server: auth middleware (the deferred ffi/http.go context adapter) for
  routes that need a user.
- Groups: `POST /groups`, `POST /groups/join`, `GET /groups`,
  `GET /groups/:id`; onboarding step in the web app (no memberships →
  create or join).
- Predictions: `PUT /fixtures/:id/prediction` with kickoff deadline
  enforcement; points computation on fixture finish;
  `GET /groups/:id/leaderboard/season` and `/week`; leaderboard +
  prediction form screens.
- Fixture endpoints gain `my_prediction` / `group_predictions` when the
  caller is authed.

### M6 — Ship to friends

- Real Zeabur deployment.
- Custom domain, real Resend sender.
- Invite emails, first live matchday.

### Deferred

- Admin seeding surface: move the MLS seed row out of migrations into an
  explicit admin action (`POST /admin/competitions` behind an
  `ADMIN_TOKEN`), so adding a competition is an operational act rather
  than a code change. For now the seed row from `001_init` stands.
- Playoffs mode
- Leagues Cup + US Open Cup
- Additional leagues beyond MLS (Premier League, etc.) — the schema supports it, just needs the `competitions` row and any UI polish for handling multiple concurrent competitions
- Owner privileges beyond group creation (rename, kick, per-group scoring rules)
- Analysis embedding (per-fixture hints, consensus, post-match lens)
- Public leaderboards / SEO / SSR
- Push notifications for locked-in predictions before deadlines

## Open questions

- **Prediction editing**: edit freely until kickoff. Locked in.
- **Session transport**: Bearer tokens in an `Authorization` header. The web app stores the token in memory / localStorage as appropriate; server does not set cookies. Clean split between server (Zeabur) and web (Cloudflare Worker) origins, and lines up with any future mobile client.
- **Historical prediction backfill?** No — v1 only scores predictions submitted through the app. Nobody gets retroactive credit for "I would have picked 2-1."
- **Timezone handling?** Store all timestamps as UTC unix ms server-side. Render in the user's browser timezone client-side. No user setting needed.
- **What happens if API-Football rate-limits us?** For v1, we log the error, retry on the next tick, and accept that a scoreboard might be stale for 3–30 minutes. Cache upstream responses eventually.
