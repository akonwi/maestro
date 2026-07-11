# Maestro Server

The backend for the Maestro prediction game (see `../docs/prediction-game-plan.md`).

Written in [Ard](https://github.com/akonwi/ard), backed by SQLite, deployed to
Zeabur as a container.

## Stack

- **Ard** compiles to Go; HTTP via Go interop with [chi](https://github.com/go-chi/chi).
- **SQLite** via a pure-Go driver (`modernc.org/sqlite`), wrapped by a small
  Go FFI package (`ffi/db.go`) and the Ard `sql` module (`sql.ard`).
- **Migrations** via [`migr`](https://github.com/akonwi/migr). NB: the published
  migr release binary is CGO-free and its SQLite path is a stub; the Docker
  image builds migr from source with CGO on. Locally, the Homebrew migr works.
- **JSON decoding** via the local `decode` module (`decode.ard`), copied from
  tinear; there is no `ard/json`/`ard/decode` stdlib in the current compiler.

## Layout

```
server/
├── ard.toml            # Ard project manifest
├── go.mod / go.sum     # Go deps (chi, modernc sqlite) for interop
├── tools.go            # build-tagged; pins interop-only deps for `go mod tidy`
├── main.ard            # entrypoint: chi server + /health
├── sql.ard             # Ard wrapper over Go database/sql
├── decode.ard          # composable JSON decoders (local module)
├── ffi/db.go           # Go-side SQLite handle the sql module calls
├── migrations/         # migr up/down SQL files
├── Dockerfile          # multi-stage: builds Ard compiler, server, grabs migr
└── entrypoint.sh       # runs `migr up` then the server
```

## Prerequisites

- [Ard compiler](https://github.com/akonwi/ard) on your `PATH` (`ard`)
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

## Environment variables

| Var            | Purpose                          | Default            |
|----------------|----------------------------------|--------------------|
| `DATABASE_URL` | SQLite file path (also used by migr) | `maestro.db` (server) / required (migr) |
| `PORT`         | HTTP listen port                 | `8080`             |
| `RESEND_ENABLED` | Send real email via Resend    | `true`             |
| `RESEND_API_KEY` | Resend API key                | required when RESEND_ENABLED |
| `RESEND_FROM_EMAIL` | From address               | `onboarding@resend.dev` |
| `SERVER_BASE_URL` | This server's public URL (magic-link emails) | required |
| `APP_BASE_URL` | Web app URL (verify redirect)    | required           |
| `MAGIC_LINK_TTL_SECONDS` | Magic-link lifetime    | `900`              |
| `SESSION_TTL_SECONDS` | Session lifetime          | `2592000` (30d)    |
| `API_FOOTBALL_KEY` | API-Football key             | required           |

## Docker

```sh
docker build -t maestro-server .
docker run --rm -p 8080:8080 -v "$PWD/data:/data" maestro-server
```

The container runs `migr up` against `/data/maestro.db` before starting the
server. Mount a volume at `/data` for persistence (Zeabur does this).

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
