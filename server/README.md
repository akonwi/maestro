# Maestro Server

The backend for the Maestro prediction game (see `../docs/prediction-game-plan.md`).

Written in [Ard](https://github.com/akonwi/ard) and backed by SQLite.

## Stack

- **Ard** compiles to Go; HTTP via the sibling `../../dram` filesystem dependency backed by `net/http`.
- **SQLite** via the external `ard-sql` dependency and its pure-Go driver.
- **Migrations** via the published, CGO-free [`migr`](https://github.com/akonwi/migr)
  release with pure-Go SQLite. The Docker image downloads the platform-specific
  artifact; locally, install migr through Homebrew.
- **JSON decoding** via the external `ard-decode` dependency.

## Layout

```
server/
├── ard.toml            # Ard project manifest
├── go.mod / go.sum     # Go dependencies retained for Ard interop
├── tools.go            # build-tagged; pins interop-only deps for `go mod tidy`
├── main.ard            # entrypoint: net/http server with a Dram handler
├── router.ard          # Dram routes and global middleware
├── response.ard        # JSON response and error-envelope helpers
├── ffi/cache.go        # concurrency-safe in-memory TTL cache
├── migrations/         # migr up/down SQL files
├── Dockerfile          # multi-stage: builds Ard compiler, server, grabs migr
└── entrypoint.sh       # runs `migr up` then the server
```

## Prerequisites

- Latest unreleased [Ard compiler](https://github.com/akonwi/ard) on your `PATH` (`ard-dev`)
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
ard-dev run main.ard
```

Or build a binary:

```sh
ard-dev build main.ard --out ./maestro-server
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

## Docker

The Dockerfile uses Ard 0.29.0, but the current Dram API requires the latest
`ard-dev` parser and still lives in the sibling `../../dram` checkout outside
the Docker build context. Container builds remain blocked until the parser is
released and Dram is available as a pinned Git dependency. The runtime image
will continue to run `migr up` against `/data/maestro.db` once those build-time
dependencies are available.

## Migrations

Create a new pair:

```sh
migr create add_something
# edit migrations/NNN_add_something.up.sql and .down.sql
```

Naming is `NNN_name.up.sql` / `NNN_name.down.sql`. `migr up` is idempotent and
tracks applied migrations in a `schema_migrations` table.

## E2E API tests

Bun-based integration suites live in `tests/`. They build the server
binary, boot it as a subprocess with its own SQLite file, and hit real
HTTP endpoints. They double as living documentation of the API.

```sh
bun install     # first time only
bun run test    # builds the server via `pretest`, then runs bun test
```

See `AGENTS.md` for the harness contract and how to add a new suite.
