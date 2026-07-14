# Scoring and Leaderboards Milestone

## Purpose

This document is the implementation guide for completing scoring and group leaderboards in the Maestro prediction game. It translates the durable architecture in [ADR 0002](./adrs/0002-scoring-architecture.md) into functional scope, work sequencing, API contracts, UI behavior, and acceptance criteria.

The milestone completes the core game loop:

1. A user predicts a fixture.
2. The prediction locks at the original kickoff deadline.
3. Maestro resolves the final result asynchronously.
4. The user receives 3, 1, or 0 points.
5. Group standings update from persisted scores.

## Scope

### Included

- Direct cached API-Football lookup by fixture ID
- Durable scoring workflow state for fixtures with predictions
- Pure Ard scoring worker with channel-based startup and shutdown
- Automatic 3/1/0 scoring for finished MLS regular-season fixtures
- Terminal handling for cancelled fixtures without awarded points
- Season and weekly group leaderboard APIs
- Leaderboard UI on group detail
- Scored prediction presentation on fixture detail
- Unit, integration, and end-to-end coverage
- Operational logging for scoring attempts and failures

### Excluded

- Playoffs, extra time, and penalty shootouts
- Automatic reconciliation of corrected provider results
- Full fixture or team persistence
- Live point projections while a fixture is in progress
- Per-group scoring rules
- Global leaderboards
- Multiple concurrent scoring workers or row leasing
- Administrative result correction tools

## Functional rules

### Points

| Result | Points |
|---|---:|
| Exact home and away score | 3 |
| Correct home-win/draw/away-win outcome | 1 |
| Incorrect outcome | 0 |

For a final score of `3–2`:

| Prediction | Points | Reason |
|---|---:|---|
| `3–2` | 3 | Exact score |
| `2–1` | 1 | Correct home-win outcome |
| `4–0` | 1 | Correct home-win outcome |
| `1–1` | 0 | Incorrect outcome |
| `0–1` | 0 | Incorrect outcome |

### Prediction states

`predictions.points` has three meaningful cases when combined with fixture scoring state:

| Scoring state | Points | Meaning |
|---|---:|---|
| `pending` | `NULL` | Awaiting a trustworthy final result |
| `settled` | `0`, `1`, or `3` | Scored prediction |
| `void` | `NULL` | Cancelled fixture; no score awarded |

A void prediction is not a zero-point miss and must not count as a played prediction in leaderboard statistics.

### Deadlines and postponements

- Predictions lock at the kickoff known when scoring state is first created.
- That timestamp is stored as immutable `prediction_lock_at`.
- A postponed fixture may update its scheduling `kickoff_at` and `next_check_at`.
- A postponement does not reopen predictions after `prediction_lock_at`.
- Cancelled fixtures become void and stop being polled.
- Abandoned or suspended fixtures remain pending until API-Football provides a trustworthy terminal status.

### Result finality

For v1, `FT` is the scoring status because the active scope is MLS regular season. Settled fixtures are terminal: Maestro does not continue polling for provider corrections or automatically rescore them.

## Data model

ADR 0002 defines the authoritative scoring-state schema. The implementation migration should add that table and its due-work index.

The scoring state must also identify the internal competition associated with the fixture so leaderboard aggregation can remain competition-aware without persisting the complete fixture:

```sql
competition_id INTEGER NOT NULL REFERENCES competitions(id)
```

The direct API-Football fixture decoder must therefore retain the provider league ID and season, then resolve those values to `competitions.id` when scoring state is created.

Useful indexes for leaderboard reads should be validated with `EXPLAIN QUERY PLAN` after endpoint queries are written. Do not add speculative indexes before the final query shape exists.

### Existing predictions

Deployment must account for unscored predictions created before scoring-state rows exist. The worker should include a bootstrap/discovery step that finds them:

```sql
SELECT DISTINCT p.fixture_id
FROM predictions p
LEFT JOIN fixture_scoring_state s ON s.fixture_id = p.fixture_id
WHERE p.points IS NULL
  AND s.fixture_id IS NULL;
```

For each missing fixture, the server performs a direct fixture lookup, resolves its competition, and creates scoring state. This makes rollout safe without requiring network access inside a SQL migration.

## Server design

### Direct fixture lookup

Add an API-Football client operation backed by the existing URL cache:

```text
GET https://v3.football.api-sports.io/fixtures?id={fixture_id}
```

It should return either one decoded fixture or no fixture. The decoded model needs:

- Fixture ID
- Kickoff timestamp
- Provider status
- Provider league ID
- Season
- Home and away team identity
- Home and away score

Both deadline validation and the scoring worker should use this operation. The current season-wide `fixtures::by_id` search should no longer be used for these paths.

### Prediction write transaction

The prediction endpoint performs network work before opening a transaction:

1. Read existing scoring state, if any.
2. Reject immediately if its immutable `prediction_lock_at` has passed.
3. Fetch the fixture directly from API-Football.
4. Validate fixture existence and deadline.
5. Resolve the fixture to an internal competition.
6. Open a transaction.
7. Recheck the persisted deadline to close the request race.
8. Upsert the prediction.
9. Insert scoring state if absent.
10. Update mutable scheduling metadata without changing an existing lock timestamp.
11. Commit.

The transaction must be short and contain no HTTP request.

### Worker lifecycle

The scoring module owns a pure Ard worker handle with stop and done channels. Exact syntax should follow the Ard channel APIs available in the compiler version used by the project.

Lifecycle:

```text
startup
  open database
  start scoring worker
  start HTTP server

shutdown
  stop accepting HTTP requests
  signal scoring worker
  wait for worker completion
  close database
```

The worker runs one pass at a time. A slow API request delays the next pass rather than creating overlapping work.

### Worker pass

A pass performs two bounded phases:

1. Discover a batch of unscored prediction fixtures that lack scoring state.
2. Process a batch of pending scoring rows whose `next_check_at` is due.

Fixtures are processed sequentially in v1. Each API request happens outside a transaction.

The polling loop may wake every minute because due scheduling prevents unnecessary API requests.

### Scheduling policy

| Condition | Next action |
|---|---|
| Not started, future kickoff | Schedule kickoff plus two hours |
| Live or temporarily interrupted | Retry in 10 minutes |
| Finished (`FT`) | Settle immediately |
| Postponed with replacement kickoff | Update scheduling kickoff; check after replacement kickoff |
| Postponed without replacement kickoff | Retry on the long interval |
| Cancelled | Mark void; clear next check |
| Abandoned or suspended | Keep pending; retry on the long interval |
| API, rate-limit, or decoding failure | Apply bounded error backoff |

Error backoff starts at five minutes and grows to a maximum of one hour. A successful response resets the attempt count and clears the last error.

### Settlement

Settlement uses one transaction:

1. Update every prediction for the fixture using the deterministic 3/1/0 calculation.
2. Store the provider status and final home and away score.
3. Store scoring rule version `1`.
4. Mark scoring state settled.
5. Clear `next_check_at` and prior errors.
6. Commit.

The update overwrites points rather than incrementing them. Repeating settlement with the same result must produce the same database state.

### Logging

Use structured, concise server logs for:

- Worker startup and shutdown
- Number of discovered and due fixtures per non-empty pass
- Fixture settlement with fixture ID and prediction count
- Fixture voiding
- Provider or decode failure with fixture ID and next retry time
- Unexpected status retained as pending

Do not log every empty worker pass.

## Leaderboards

### Membership and visibility

Every leaderboard is scoped to a group. The requesting user must be a member of that group. Leaderboards include every current member, including members with no scored predictions.

### Ranking statistics

Each row contains:

```json
{
  "rank": 1,
  "user": {
    "id": 42,
    "email": "ada@example.com",
    "display_name": "Ada"
  },
  "total_points": 18,
  "exact_count": 4,
  "outcome_count": 6,
  "played": 10
}
```

Definitions:

- `total_points`: sum of non-null points
- `exact_count`: predictions worth 3 points
- `outcome_count`: predictions worth 1 point
- `played`: predictions with non-null points

Void and pending predictions are excluded from all four statistics.

### Ranking order

Rows are ordered by:

1. Total points descending
2. Exact predictions descending
3. Correct-outcome predictions descending
4. Display name or email ascending for stable presentation

Players tied on all scoring criteria share the same displayed rank. The alphabetical field stabilizes output but does not break a scoring tie.

### Season leaderboard

Endpoint:

```text
GET /groups/:id/leaderboard/season[?competition_id=]
```

For v1, omitted competition means all active competitions, which is the single active MLS regular-season competition. The query must start from group membership and left join predictions so zero-score members remain visible.

### Weekly leaderboard

Endpoint:

```text
GET /groups/:id/leaderboard/week[?competition_id=&week=]
```

A scoring week runs from **Tuesday at 6:00 AM through the following Tuesday at 5:59:59 AM in `America/New_York`**. Equivalently, the interval is inclusive at Tuesday 6:00 AM and exclusive at the next Tuesday 6:00 AM. This keeps late Monday-night fixtures in the week that is ending, including matches that finish after midnight Eastern time.

The server constructs boundaries in the `America/New_York` time zone and converts them to UTC instants for comparisons against stored Unix-millisecond kickoff timestamps. Calendar arithmetic must happen in the named time zone rather than by subtracting a fixed number of milliseconds so daylight-saving transitions remain correct.

The `week` query parameter is the local Tuesday start date in `YYYY-MM-DD` form, for example `week=2026-03-03`. The server interprets it as `2026-03-03T06:00:00 America/New_York`. When omitted, the endpoint uses the week containing the current instant.

Weekly aggregation includes fixtures whose scheduling `kickoff_at` falls within the half-open interval:

```text
week_start <= kickoff_at < next_week_start
```

The web UI uses the same Tuesday date as its stable URL/navigation key and displays a human-readable range such as `Mar 3–9`. API-Football's `round` field is not used as a week because league rounds do not map reliably to calendar periods.

## API changes

### Group fixture predictions

The existing response should expose awarded points once settlement occurs. No separate scoring request is needed:

```json
{
  "user": { "id": 42, "display_name": "Ada" },
  "home_score": 2,
  "away_score": 1,
  "points": 3,
  "updated_at": 1770000000000
}
```

Pending and void predictions return `points: null`.

### Leaderboard errors

Use the existing flat error envelope:

```json
{ "error": "group not found" }
```

Return the same not-found response for a missing group and a group the requester cannot access, preserving existing membership-hiding behavior.

## Web experience

### Group detail

Add a leaderboard section to group detail after the member summary. Season standings ship first.

Desktop presentation:

- Rank
- Member
- Points
- Exact
- Outcomes
- Played

Mobile presentation should prioritize rank, member, and points. Secondary statistics may move to a second line rather than forcing horizontal page scrolling.

The current user should be identified textually as “You”; color alone is insufficient.

### Fixture detail

The Workbench group-prediction panel already receives nullable points. After settlement:

- Show `+3`, `+1`, or `0` beside each prediction.
- Show the final fixture score in the fixture masthead.
- Keep the user's prediction read-only.
- Do not show points for pending or void fixtures.
- Show cancelled status without presenting predictions as incorrect.

### Loading and errors

Use TanStack Query for leaderboard data and the existing authenticated request pattern. Scoring staleness is not an HTTP error: the UI simply displays the latest persisted standings.

## Implementation sequence

### Phase 1: Result lookup and persistence

1. Add direct fixture-by-ID API client and decoder fields.
2. Add scoring-state migration and test schema.
3. Refactor prediction writes into a transaction with scoring-state creation.
4. Add rollout discovery for existing unscored predictions.

Exit condition: every predicted fixture acquires durable scoring state without season-wide API fetches.

### Phase 2: Scoring worker

1. Implement pure scoring functions and status classification.
2. Implement due-row scheduling and retry updates.
3. Implement transactional settlement and voiding.
4. Add the Ard channel-based worker lifecycle.
5. Integrate clean startup and shutdown.

Exit condition: a finished fixture is scored exactly once in effect, survives retries, and updates all associated predictions.

### Phase 3: Season leaderboard API

1. Implement membership-scoped aggregation.
2. Include members with no predictions.
3. Calculate ranks and ties.
4. Add season endpoint and E2E coverage.

Exit condition: group members receive deterministic standings from persisted scores without upstream requests.

### Phase 4: Web scoring and standings

1. Display points and final state on fixture detail.
2. Add season standings to group detail.
3. Complete responsive and accessibility review.

Exit condition: users can follow the complete predict → result → points → standings loop.

### Phase 5: Weekly standings

1. Implement Tuesday 6:00 AM `America/New_York` boundary calculation and navigation keys.
2. Implement bounded aggregation and navigation contract.
3. Add weekly/season switching in the group UI.

Exit condition: users can inspect the current and prior scoring weeks without changing season totals.

## Test plan

### Pure scoring tests

- Exact home win, draw, and away win produce 3
- Non-exact correct home win, draw, and away win produce 1
- Incorrect outcomes produce 0
- Repeated calculation produces the same result

### Store and transaction tests

- First prediction creates scoring state
- Later predictions reuse the fixture state
- Prediction and state creation roll back together
- Revised kickoff updates scheduling but not `prediction_lock_at`
- Postponement does not reopen prediction editing
- Settlement updates all fixture predictions atomically
- Cancelled fixture becomes void and leaves points null
- Repeated settlement does not change totals
- Existing unscored predictions are discovered

### Worker tests

- Only due pending rows are processed
- Empty passes make no provider calls
- Live status schedules a short retry
- Provider failure applies bounded backoff
- Successful response resets error state
- Stop signal prevents another pass
- Done signal occurs after in-flight work completes

Use a fake fixture-result boundary around the worker logic. Unit and E2E tests must not depend on live API-Football responses.

### Leaderboard tests

- Non-members cannot read a group leaderboard
- Members with no scored predictions appear with zeroes
- Pending and void predictions are excluded
- Exact, outcome, played, and total counts are correct
- Ties share a rank
- Ordering remains stable within ties
- Competition filtering cannot leak unrelated results

### Web checks

After each completed frontend body of work:

1. Apply the web-design-guidelines review.
2. Apply the React best-practices review.
3. Run Biome, typecheck, and production build.

## Completion criteria

The milestone is complete when:

- Prediction submission creates durable scoring work.
- The server scores finished fixtures asynchronously and idempotently.
- Cancelled fixtures stop retrying and remain unscored.
- Server shutdown waits for the pure Ard scoring worker.
- Season leaderboards are group-scoped, deterministic, and include zero-score members.
- Weekly leaderboard semantics are documented and implemented.
- Fixture detail displays final scores and awarded points.
- Group detail displays responsive season and weekly standings.
- No leaderboard read depends on API-Football availability.
- Server and web validation suites pass.

## Related

- [ADR 0002: Score Predictions Asynchronously](./adrs/0002-scoring-architecture.md)
- [Prediction Game Plan](./prediction-game-plan.md)
- [Server conventions](../server/AGENTS.md)
- [Web conventions](../web/AGENTS.md)
