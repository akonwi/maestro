# Maestro Server

The backend for the Maestro prediction game (see `../docs/prediction-game-plan.md`).

Written in [Ard](https://github.com/akonwi/ard) and backed by SQLite.

## Stack

- **Ard** compiles to Go; HTTP via a pinned [Dram](https://github.com/akonwi/dram) dependency backed by `net/http`.
- **SQLite** via the external `ard-sql` dependency and its pure-Go driver.
- **Migrations** via the published, CGO-free [`migr`](https://github.com/akonwi/migr)
  release with pure-Go SQLite. The Docker image downloads the platform-specific
  artifact; locally, install migr through Homebrew.
- **JSON decoding** via the external `ard-decode` dependency.

## Layout

Ard modules are files. The server stays shallow by domain; the API-Football
integration uses a directory because it contains several independent endpoint
families.

```text
server/
├── main.ard / router.ard       # process lifecycle and Dram route composition
├── config.ard / app.ard        # validated environment and shared dependencies
├── auth.ard                    # magic-link HTTP workflows and auth middleware
├── users.ard                   # user persistence
├── sessions.ard                # session persistence
├── magic_links.ard             # single-use login tokens
├── email.ard                   # Cloudflare Email Service client
├── competitions.ard            # configured provider leagues and seasons
├── fixtures.ard                # public fixture and round endpoints
├── predictions.ard             # prediction validation and persistence
├── groups.ard                  # groups, memberships, and invitations
├── scoring_state.ard           # durable scoring workflow state
├── scoring.ard                 # deterministic scoring and settlement
├── scoring_worker.ard          # result polling and retry scheduling
├── leaderboards.ard / week.ard # season/weekly tables and week boundaries
├── analysis.ard                # fixture outlook and match-detail responses
├── standings.ard / strength.ard
├── api_football.ard            # authenticated provider transport and raw cache
├── api_football/
│   ├── decoding.ard            # tolerant shared provider decoding helpers
│   ├── fixtures.ard            # fixture models, rounds, and fixture lookup
│   ├── prematch.ard            # outlook, standings, injuries, and team context
│   └── details.ard             # statistics, events, lineups, and players
├── maintenance_worker.ard      # expired session and magic-link cleanup
├── ffi/cache.go                # concurrency-safe in-memory TTL cache
├── migrations/                 # migr up/down SQL files
├── tests/ / test-support/      # Bun HTTP e2e suites and process harness
├── Dockerfile
└── entrypoint.sh
```

Route closures own request parsing and response shaping. Domain/store functions
own business rules, SQL, and row decoding. Small repetitions such as local error
envelopes and explicit result matching are intentional; the server does not use
a generic response, service, or repository layer.

## Prerequisites

- [Ard 0.35.1](https://github.com/akonwi/ard) or newer on your `PATH` (`ard`)
- [`migr`](https://github.com/akonwi/migr) on your `PATH`
- Go 1.26+ (the Ard toolchain shells out to it)
- [Bun](https://bun.sh) for running the e2e API tests

## Local development

Dependencies are resolved via `go.mod`. If you change Go interop imports, run:

```sh
go mod tidy
```

Set a local database path once per shell:

```sh
export DATABASE_URL=./dev.db
```

Apply migrations:

```sh
migr up          # apply
migr status      # show state
migr down        # roll back the last batch
```

Run the server (compiles and runs in one step):

```sh
ard run main.ard
```

Or build a binary:

```sh
ard build main.ard --out ./maestro-server
./maestro-server
```

The server listens on `PORT` (default `8080`). Check it:

```sh
curl http://localhost:8080/health   # -> "ok" when the DB pings
```

### Local scoring simulation

To populate a local group with randomized predictions for the two most recent
completed MLS rounds, stop the server and run:

```sh
./scripts/simulate-scoring.sh 1  # group id; defaults to 1
```

The command loads `.env`, applies migrations, preserves existing prediction
scores, inserts only missing member predictions, and clears settlement state
for the selected fixtures. Restart `main.ard` afterward; the real scoring
worker will discover those fixtures and settle every local prediction for them.
The simulation requires an explicit local-only opt-in and refuses `/data/*`
database paths.

## Environment variables

| Var            | Purpose                          | Default            |
|----------------|----------------------------------|--------------------|
| `DATABASE_URL` | SQLite file path (also used by migr) | `maestro.db` (server) / required (migr) |
| `PORT`         | HTTP listen port                 | `8080`             |
| `EMAIL_ENABLED` | Send real magic-link email through Cloudflare Email Service | `false` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account containing Email Service | required when EMAIL_ENABLED |
| `CLOUDFLARE_EMAIL_API_TOKEN` | API token with Email Sending permission | required when EMAIL_ENABLED |
| `EMAIL_FROM` | Sender on a domain configured for Email Service | required when EMAIL_ENABLED |
| `SERVER_BASE_URL` | This server's public URL (magic-link emails) | required |
| `APP_BASE_URL` | Web app URL (verify redirect)    | required           |
| `MAGIC_LINK_TTL_SECONDS` | Magic-link lifetime    | `900`              |
| `SESSION_TTL_SECONDS` | Session lifetime          | `2592000` (30d)    |
| `API_FOOTBALL_KEY` | API-Football key             | required           |
| `VAPID_PUBLIC_KEY` | VAPID public key; push notifications are enabled when the keypair is set | optional |
| `VAPID_PRIVATE_KEY` | VAPID private key            | optional           |
| `PUSH_SUBSCRIBER` | VAPID subscriber contact (`mailto:` URL) | required when VAPID keys are set |
| `ADMIN_TOKEN` | Bearer token for the `/admin` surface; unset disables it | optional |

Generate a VAPID keypair once with webpush-go:

```sh
cat > /tmp/genvapid.go << 'EOF'
package main

import (
	"fmt"
	webpush "github.com/SherClockHolmes/webpush-go"
)

func main() {
	priv, pub, _ := webpush.GenerateVAPIDKeys()
	fmt.Println("VAPID_PUBLIC_KEY=" + pub)
	fmt.Println("VAPID_PRIVATE_KEY=" + priv)
}
EOF
go run /tmp/genvapid.go
```

## Docker

```sh
docker build -t maestro-server .
docker run --rm -p 8080:8080 -v "$PWD/data:/data" maestro-server
```

The image uses Ard 0.35.1 and resolves Dram from its pinned Git commit. It runs
`migr up` against `/data/maestro.db` before starting the server. Mount a volume
at `/data` for persistence.

## Migrations

Create a new pair:

```sh
migr create add_something
# edit migrations/NNN_add_something.up.sql and .down.sql
```

Naming is `NNN_name.up.sql` / `NNN_name.down.sql`. `migr up` is idempotent and
tracks applied migrations in a `schema_migrations` table.

## Managing competitions

Competitions are administered through the token-gated `/admin` surface
(set `ADMIN_TOKEN`) or the web app's `/admin` page. A competition is a
league, configured once — the current season is resolved automatically
from API-Football, so season rollovers need no changes. Upserts are
keyed by league id; re-posting with `is_active: false` deactivates.

```sh
# List all competitions (active and inactive)
curl -H "Authorization: Bearer $ADMIN_TOKEN" $SERVER/admin/competitions

# Add / activate the Premier League
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"api_football_league_id": 39, "name": "Premier League"}' \
  $SERVER/admin/competitions

# Add the EFL Championship
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"api_football_league_id": 40, "name": "EFL Championship"}' \
  $SERVER/admin/competitions

# Deactivate a league (same POST, is_active false)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"api_football_league_id": 40, "name": "EFL Championship", "is_active": false}' \
  $SERVER/admin/competitions
```

`kind` defaults to `league` (`cup` and `playoff` are reserved for later).

## E2E API tests

Bun-based integration suites live in `tests/`. They build the server
binary, boot it as a subprocess with its own SQLite file, and hit real
HTTP endpoints. They double as living documentation of the API.

```sh
bun install     # first time only
bun run test    # builds the server via `pretest`, then runs bun test
```

See `AGENTS.md` for the harness contract and how to add a new suite.
