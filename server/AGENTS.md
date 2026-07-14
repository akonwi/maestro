# AGENTS.md — Maestro Server

Guidance for working in `server/`, the Ard backend for the Maestro prediction
game. Read alongside `../docs/prediction-game-plan.md` (product + milestones).

## What this is

An Ard HTTP service on SQLite. Ard compiles to Go; we use Go interop (`use
go:...`) for the HTTP layer (chi) and wrap the rest in small local modules.
The current compiler is unreleased dev — we are dogfooding it.

## Module system reality

- **A module is a file.** `server/auth.ard` in project `maestro`
  becomes `use maestro/auth`, accessed as `auth::thing`. There is no
  multi-file package.
- Subdirectories work (`http/x.ard` → `use maestro/http/x`) but we stay
  **flat** at this size.
- Assume **no circular imports**. Dependencies flow one direction:
  `main → router → domain handlers → stores → sql/decode`. Stores never import
  http; handlers never import each other.
- We are on an **unreleased compiler**. Bias toward boring, shallow structure.
  `decode.ard` already carries a workaround for a generic-function miscompile
  (ard#282); expect more surface area with cleverness.

## Layout — flat by domain (mirrors ranger/server)

```
server/
  main.ard          entry: build config, open db, wire router, run lifecycle
  config.ard        Config struct + env reading + startup validation
  app.ard           App struct, threaded to every handler
  router.ard        composes routes: calls each domain's register()
  response.ard      JSON envelope + error helpers
  health.ard        health handler + register()
  auth.ard          magic-link handlers + register()
  users.ard         user store (queries -> typed structs) + User struct
  sessions.ard      session store, token mint/verify + Session struct
  magic_links.ard   magic-link store, single-use consume
  email.ard         Cloudflare Email Service REST client
  api_football.ard  API-Football client + cached response decoding
  competitions.ard  competitions store (which leagues/seasons to fetch)
  fixtures.ard      cached API-Football proxy + public read endpoints
  groups.ard        group membership, detail, and email-invite endpoints
  predictions.ard   prediction persistence, kickoff locking, group visibility
  scoring_state.ard durable fixture scoring workflow state and discovery
  scoring.ard       deterministic point calculation and transactional settlement
  scoring_worker.ard channel-managed result polling and retry scheduling
  leaderboards.ard  membership-scoped season and weekly standings
  week.ard          Tuesday 6am America/New_York week boundaries
  ffi/cache.go      concurrency-safe in-memory TTL cache
  ffi/http.go       auth middleware + request-context user id
  crypto.ard        token generation (crypto/rand + hex)

  (SQL access and JSON decoding are external Git deps:
   github.com/akonwi/ard-sql and github.com/akonwi/ard-decode. The local
   sql.ard/decode.ard/ffi/db.go were replaced once ard-sql stabilized.)
```

New domains get one `.ard` file each until they outgrow it, then a subdir.

## Conventions

### Dependency threading: the `App` value

No globals. Handlers receive an `App` (cheap value; the db handle is a Go
pointer). chi handlers must be `fn(w, r)`, so each domain builds them as
closures capturing `app`:

```ard
struct App {
  db: sql::Database,
  config: config::Config,
  // email: email::Client   (added in M2)
}

fn register(router: mut chi::Mux, app: App) {
  router.Post("/auth/request", fn(w, r) { handle_request(app, w, r) })
}
```

### Data access: thin store modules

Stores own the SQL **and** the row-to-struct decoding. `sql` (the external
`ard-sql` dep) returns rows as `[Any]` (each row is an `Any` map); the store
decodes them into typed Ard structs using the external `decode` dep.
Handlers are HTTP-only and never touch `sql` directly. Stores are the primary
unit tested with `ard test` (`users_test.ard`, etc.).

### Domain structs: colocated with their store

`users.ard` defines `User`; `sessions.ard` defines `Session`. No shared
`models.ard` unless a struct is genuinely cross-domain.

### Auth: chi middleware + context, plumbed through Go FFI

We use real middleware with `context.WithValue`, but the `context` mechanics
live in `ffi/http.go` (idiomatic and painless in Go), exposed as Ard-friendly
seams:

```go
// ffi/http.go
func AuthMiddleware(authenticate func(*http.Request) (int, bool)) func(http.Handler) http.Handler
func UserID(r *http.Request) (int, bool)
```

Ard provides the `authenticate` closure (looks up the bearer token via the
sessions store) and reads the id back with `UserID(r)` in protected handlers.
`/auth/*` and `/health` are public; everything else sits behind the middleware.

> This adapter is the first thing to build/verify in M2, before auth logic is
> layered on it, to confirm the interop compiles.

### Responses: simple error envelope

One `response.ard` with helpers used everywhere:

```ard
fn json(w, status, value)          // Content-Type: application/json
fn fail(w, status, message)        // { "error": "message" }
```

Error envelope is `{ "error": "message" }`. Keep it flat for v1.

### Config

`config.ard` reads env once at startup into a `Config` struct and validates
required values (`DATABASE_URL`, `CLOUDFLARE_EMAIL_API_TOKEN`, etc.), failing fast with a
clear message. No config files.

## Interop rules of thumb (learned in M1)

- Go slice params need **mutable** Ard slices (`mut body`, `mut args`).
- A Go func returning only `error` maps to `Void!Str`; `(T, error)` maps to
  `T!Str`.
- Ard closures work as Go func values (that's how chi route handlers and the
  auth adapter callback work), but authoring Go *interface-shaped* callbacks
  still needs a companion Go wrapper in `ffi/`.
- Anything `any`-keyed or interface-heavy (like `context`) belongs behind a
  thin `ffi/*.go` seam, not driven directly from Ard.

## Build / test / run

```sh
export DATABASE_URL=./dev.db
migr up
ard run main.ard          # or: ard build main.ard --out ./maestro-server
ard test                  # runs *_test.ard (store-level unit tests)
go test ./...             # runs ffi/*_test.go
bun run test              # runs tests/*.test.ts (e2e API tests via bun:test)
curl localhost:8080/health
```

See `README.md` for the Docker workflow and the migr-from-source note.

### E2E API tests (`tests/*.test.ts`)

The `tests/` directory holds bun:test suites that boot the built server
binary as a subprocess and hit real HTTP. They double as the API's
living documentation: reading `tests/auth.test.ts` tells you every
endpoint's shape, error envelope, and side effects.

- Each test file gets its **own port + own SQLite file** (bun runs test
  files in parallel). Pass `{ id, port }` to `createHarness`.
- `setup()` does a file-based DB reset (unlinks + `migr up`) exactly
  once. `beforeEach` calls `resetDb()` which **truncates tables** via the
  shared bun:sqlite connection — unlinking the file after the server has
  it open would leave the server writing to a ghost inode.
- `EMAIL_ENABLED=false` in the harness so `/auth/request` never calls
  Cloudflare Email Service but still writes the `magic_links` row we assert against.
- Add a new suite by dropping `tests/<domain>.test.ts` and giving it a
  unique `id` and `port`. Reuse `test-support/harness.ts`.
