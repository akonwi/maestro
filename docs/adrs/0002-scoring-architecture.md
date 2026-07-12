# 0002: Score Predictions Asynchronously

## Status

Proposed

## Context

Maestro awards three points for an exact scoreline, one point for the correct home-win/draw/away-win outcome, and zero points for an incorrect outcome. Predictions lock at kickoff and currently remain unscored until fixture results are resolved.

Fixture and team data are intentionally fetched from API-Football and cached in memory rather than persisted. Scoring must therefore remain reliable across process restarts and temporary upstream failures without introducing a full local fixture mirror or polling fixtures that have no predictions.

A null prediction score must also remain distinct from an incorrect prediction. `points = NULL` means no score has been awarded, while `points = 0` means the fixture was settled and the prediction was incorrect. Cancelled fixtures should leave their predictions unscored.

## Decision

Maestro will score predictions asynchronously using a durable, prediction-driven scoring workflow.

### Persistent scoring state

A migration will add a table dedicated to workflow state:

```sql
CREATE TABLE fixture_scoring_state (
  fixture_id INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  kickoff_at INTEGER NOT NULL,
  prediction_lock_at INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'settled', 'void')),
  provider_status TEXT,
  next_check_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_checked_at INTEGER,
  last_error TEXT,
  final_home_score INTEGER,
  final_away_score INTEGER,
  scoring_version INTEGER,
  settled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX fixture_scoring_state_due
ON fixture_scoring_state (state, next_check_at);
```

All timestamps are UTC Unix milliseconds. `competition_id` is resolved from the provider league and season when state is created so leaderboards can filter without storing the complete fixture. This table otherwise stores only the metadata required to schedule, resolve, and audit scoring; it is not a general fixture store.

The states have application-level meaning independent of API-Football's status codes:

- `pending`: eligible for another provider check;
- `settled`: final scores and prediction points were persisted;
- `void`: no points will be awarded, including cancelled fixtures.

`predictions.points` remains nullable. A pending or void fixture has null prediction points; a settled incorrect prediction has zero points.

### Prediction submission

The prediction endpoint already retrieves the fixture to verify that kickoff has not passed. It will use a direct cached API-Football request for that fixture ID rather than loading every active competition's season.

If scoring state already exists, the endpoint first enforces its immutable `prediction_lock_at`. A postponement or revised kickoff does not reopen existing predictions after their original deadline.

After the provider request succeeds, the server will open one short transaction that:

1. verifies an existing `prediction_lock_at` has not passed;
2. creates or updates the user's prediction;
3. inserts the fixture's scoring-state row if absent, using the current kickoff as both `kickoff_at` and `prediction_lock_at`; and
4. updates the mutable `kickoff_at` scheduling metadata when API-Football reports a revised kickoff, without changing `prediction_lock_at`.

The initial `next_check_at` will be scheduled shortly after the expected end of the fixture rather than at prediction time. For a normal league fixture, the default is kickoff plus two hours. The unique `(user_id, fixture_id)` constraint continues to enforce one prediction per user and fixture.

A scoring-state row is not created for fixtures without predictions.

### Direct fixture lookup

The API-Football client will support a cached fixture lookup using:

```text
GET /fixtures?id={fixture_id}
```

The worker and prediction deadline validation will share this lookup. It avoids the current `fixtures::by_id` behavior of fetching complete season payloads for every active competition. The existing in-memory URL cache continues to coalesce repeated upstream requests.

### Worker lifecycle

One scoring worker will run per server process in pure Ard. Starting the worker returns lifecycle channels conceptually equivalent to:

```text
ScoringWorker {
  stop: channel,
  done: channel
}
```

The worker owns a sequential loop. It waits for either its polling interval or a stop signal, runs at most one scoring pass at a time, and signals `done` before exiting. Server shutdown will:

1. stop accepting HTTP traffic;
2. signal the worker's stop channel;
3. wait for the done channel; and
4. close the database.

The worker will not use a Go FFI lifecycle shim. HTTP requests, fixture classification, scheduling, and scoring remain in Ard.

### Selecting work

Each pass selects a bounded batch of due fixtures:

```sql
SELECT fixture_id, kickoff_at, attempt_count
FROM fixture_scoring_state
WHERE state = 'pending'
  AND next_check_at IS NOT NULL
  AND next_check_at <= :now
ORDER BY next_check_at, fixture_id
LIMIT :batch_size;
```

Fixtures are processed sequentially for v1. The batch limit prevents a large backlog from monopolizing one pass. A subsequent pass continues the backlog.

No database transaction is held while calling API-Football.

### Provider status and scheduling

After each provider response, the worker stores `provider_status` and `last_checked_at`, then applies these rules:

- Not started with a future or revised kickoff: update `kickoff_at` and schedule `next_check_at` for kickoff plus two hours.
- Live or temporarily interrupted: retry in 10 minutes.
- Finished (`FT` for the v1 MLS regular-season scope): settle the fixture.
- Postponed: retain the pending state, update the scheduling kickoff when the provider supplies a replacement, and otherwise retry on a longer interval. Do not change `prediction_lock_at` or reopen predictions.
- Cancelled: set state to `void`, clear `next_check_at`, and leave all prediction points null.
- Abandoned, suspended, or another status without a trustworthy final result: retain the pending state and continue checking on the longer retry interval rather than guessing a score.

Transport, rate-limit, and decoding failures do not change football state. They increment `attempt_count`, store `last_error`, and schedule a bounded retry. The retry delay begins at five minutes and grows up to one hour. A successful provider response resets `attempt_count` and clears `last_error`.

The polling loop itself may run every minute because `next_check_at` determines whether any upstream work is due.

### Transactional settlement

For a final fixture, the worker obtains the actual home and away scores before opening a transaction. The transaction deterministically scores every prediction:

```sql
UPDATE predictions
SET points = CASE
  WHEN home_score = :actual_home
   AND away_score = :actual_away THEN 3
  WHEN (home_score > away_score AND :actual_home > :actual_away)
    OR (home_score = away_score AND :actual_home = :actual_away)
    OR (home_score < away_score AND :actual_home < :actual_away) THEN 1
  ELSE 0
END
WHERE fixture_id = :fixture_id;
```

The same transaction then records the result used:

```sql
UPDATE fixture_scoring_state
SET state = 'settled',
    provider_status = :provider_status,
    final_home_score = :actual_home,
    final_away_score = :actual_away,
    scoring_version = 1,
    settled_at = :now,
    next_check_at = NULL,
    last_error = NULL,
    updated_at = :now
WHERE fixture_id = :fixture_id
  AND state = 'pending';
```

The prediction update and state transition must commit or roll back together. Re-running settlement with the same result produces the same points, so a retry after an uncertain process failure is safe.

V1 runs one worker and does not add row leases. If deployment later permits multiple server processes, a new decision must define claiming or leasing due rows. Deterministic settlement protects points from duplication, but it does not prevent duplicate upstream requests.

### Read behavior

Leaderboard queries aggregate only persisted points. They do not synchronously call API-Football or execute settlement. Null points are excluded from point totals, including predictions for pending and void fixtures.

Periodic worker passes provide eventual consistency when the server was offline or API-Football was temporarily unavailable. A read path may later signal that due work exists, but it must not introduce a second scoring implementation.

Settled fixtures are terminal in v1. Maestro will not automatically poll for provider corrections or rescore settled predictions. Result correction policy is deferred until there is a demonstrated need.

## Consequences

- Only fixtures with submitted predictions consume durable scoring state or result-checking requests.
- Scoring survives restarts without persisting the complete API-Football fixture model.
- Leaderboard requests remain fast and independent of upstream API availability.
- A leaderboard may remain temporarily stale until a worker iteration successfully resolves a fixture.
- Cancelled fixtures can remain unscored without being confused with incorrect zero-point predictions.
- Stored final-score and rule-version metadata make awarded points explainable if correction support is added later.
- The server gains a managed background lifecycle and retry policy that require tests for shutdown, idempotency, fixture-state classification, and transactional settlement.
- Supporting multiple concurrent worker processes may later require row leasing or claiming, although deterministic settlement protects point correctness.

## Related

- [ADR 0001: Record Architecture Decisions](./0001-record-architecture-decisions.md)
- [Prediction Game Plan](../prediction-game-plan.md)
