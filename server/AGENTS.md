# AGENTS.md — Maestro Server

Guidance for working in `server/`, the Ard backend for the Maestro prediction
game. Read alongside `../docs/prediction-game-plan.md` (product + milestones).

## What this is

An Ard HTTP service on SQLite. Ard compiles to Go; the HTTP layer uses the
pinned Dram Git dependency, which integrates with Go's `net/http`. The project
requires the released Ard 0.30.0 compiler or newer.

## Module system reality

- **A module is a file.** `server/auth.ard` in project `maestro`
  becomes `use maestro/auth`, accessed as `auth::thing`. There is no
  multi-file package.
- Subdirectories work (`http/x.ard` → `use maestro/http/x`) but we stay
  **flat** at this size.
- Assume **no circular imports**. Dependencies flow one direction:
  `main → router → domain handlers → stores → sql/decode`. Stores never import
  HTTP modules; handlers never import each other.
- Bias toward boring, shallow structure; the language and ecosystem are still
  young enough that clever abstractions expose more compiler surface area.

## Layout — flat by domain (mirrors ranger/server)

```
server/
  main.ard          entry: build config, open db, wire router, run lifecycle
  config.ard        Config struct + env reading + startup validation
  app.ard           App struct, threaded to every handler
  router.ard        composes routes: calls each domain's register()
  errors.ard        HttpError: a business-logic error carrying an HTTP status
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
  crypto.ard        token generation (crypto/rand + hex)

  (SQL access and JSON decoding are external Git deps:
   github.com/akonwi/ard-sql and github.com/akonwi/ard-decode. The local
   sql.ard/decode.ard/ffi/db.go were replaced once ard-sql stabilized.)
```

New domains get one `.ard` file each until they outgrow it, then a subdir.

## Conventions

### Dependency threading: the `App` value

No globals. Handlers receive an `App` (cheap value; the db handle is a Go
pointer). Dram handlers are closures that capture `app`:

```ard
struct App {
  db: sql::Database,
  config: config::Config,
  // email: email::Client   (added in M2)
}

fn register(router: mut dram::App, a: app::App) {
  router.post(
    "/auth/request",
    fn(req: dram::Request, res: mut dram::Response) {
      let addr = try decode_field(req, "email") -> err { set_error(res, err) }
      match send_magic_link(a, addr) {
        ok => { res.status = 204 },
        err(message) => set_error(res, message),
      }
    },
  )
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

### Auth: Dram middleware + request context

Authentication is ordinary Dram middleware. It reads the bearer token from the
Dram request, looks up the session, stores the user id in a derived Go context
through `dram/context`, and continues with `next.run(request.with_context(ctx),
response)`. Protected handlers read the typed value through `auth::user_id`.
`/auth/*` and `/health` are public; everything else sits behind the middleware.

### Responses: Dram's API directly

```ard
res.json(http::StatusOK, payload)               // JSON body
res.json(status, ["error": message])            // flat { "error": "..." } envelope
res.status = 204                                // no-content (body defaults to [])
res.header("Location", target)                  // header
```

The error envelope `{ "error": "message" }` is written inline. If one module
repeats it a lot, a one-line local helper (`set_error(res, msg)`) is fine — but
not a shared cross-module helper module. Note `["error": msg]` is a **map**;
`["error", msg]` is a list and would serialize as a JSON array.

### Handler & code style

These crystallized from the M2 auth refactor. They favor directness over layering.

- **Handlers are inline route closures.** The closure passed to
  `router.<method>` *is* the handler — no private `handle_x(a, res, req)` shell
  that just forwards. Reading a domain's `register()` top to bottom shows every
  handler.
- **Handlers stick to request/response; delegate the rest.** The route closure
  parses the request (`req.query` / `req.param` / `decode_field`) into plain
  typed values and shapes the response (`res.json`, `res.status`), and hands the
  actual work to a business-logic or store function where possible. Those
  functions take plain typed values and don't touch `dram::Request`/`Response`.
  `send_magic_link(a, address)` and `verify(a, token)` are the reference shape.
- **Prefer explicit repetition over thin abstractions.** A helper must earn its
  keep. Wrapping a single native call, or a trivial two-line pattern, does not —
  inline it (as a closure at the call site if needed). We deleted `response.ard`
  and inlined `read_body` / `describe_body_error` / `no_content` for exactly this
  reason. Dumb and repetitive beats a shallow indirection.
- **Name for Dram, not borrowed frameworks.** Request/response params are
  `req`/`res`. Dram's `Response` is a value you mutate, not a chi/gin
  `ResponseWriter`, so `w`/`r` would mislead.
- **Mirror a good pattern across siblings.** Once one endpoint reads well, give
  its neighbors the same shape.

#### Multi-status flows: propagate `HttpError`

Most endpoints have one success and one error status, so the delegated function
can return `T!Str` and the handler maps `err` to a single status. But some flows
emit **different statuses at different steps** (the prediction upsert returns
429 / 409 / 404 / 502 / 500 depending on where it fails). A plain `err(Str)`
can't say *which* status, which otherwise forces either threading `res` through
the business logic or a fragile `message == "..."` comparison to recover the
status you already knew.

For those flows, carry the shared `errors::HttpError` and let the handler map it
to a status:

```ard
// errors.ard: struct HttpError { status: Int, message: Str }

// business logic returns T!errors::HttpError and never touches res
fn save_before_kickoff(a, user_id, fixture_id, scores) Prediction!errors::HttpError { ... }

// handler owns the write
match save_before_kickoff(a, user_id, fixture_id, scores) {
  ok(prediction) => res.json(http::StatusOK, prediction_json(prediction)),
  err(e)         => res.json(e.status, ["error": e.message]),
}
```

The business-logic chain names the status (a small, localized HTTP leak) but
never writes the response — `res` stays entirely in the handler. Reach for this
only when an endpoint really has more than one error status; `T!Str` is fine for
the common single-status case. (The one place a `message ==` compare survives is
the boundary with a lower-level store that only returns `Str`.)

### Config

`config.ard` reads env once at startup into a `Config` struct and validates
required values (`DATABASE_URL`, `CLOUDFLARE_EMAIL_API_TOKEN`, etc.), failing fast with a
clear message. No config files.

## Interop rules of thumb (learned in M1)

- Go slice params need **mutable** Ard slices (`mut body`, `mut args`).
- A Go func returning only `error` maps to `Void!Str`; `(T, error)` maps to
  `T!Str`.
- Dram owns the `net/http` adaptation; application handlers and middleware stay
  in Ard and capture dependencies directly.
- Dram carries Go's `context.Context` directly; use `dram/context` helpers and
  application-owned comparable key types for request values.

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
