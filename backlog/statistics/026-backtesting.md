# Backtesting Feature

## Overview

Evaluate betting strategies historically by running the prediction logic against past fixtures and comparing picks to actual outcomes. This enables strategy validation and threshold refinement before risking real money.

## Use Cases

1. **Local development**: Run backtest via CLI for immediate feedback when tweaking thresholds
2. **Production monitoring**: Background job runs backtest and exposes results via API, allowing the frontend to display performance of currently deployed strategies

## Scope

- Backtest against the entire current season of followed leagues
- Use cached historical odds from `fapi.ard`
- Run the same picking logic used in `find_juice()`

## Implementation

### 1. Core Backtest Engine

Create `backtest.ard` module with the simulation logic:

```ard
struct BacktestResult {
  total_picks: Int,
  wins: Int,
  losses: Int,
  pushes: Int,
  win_rate: Float,
  roi: Float,
  by_bet_type: [BetTypeResult],
  by_league: [LeagueResult],
}

struct BetTypeResult {
  type_id: Int,
  name: Str,
  picks: Int,
  wins: Int,
  win_rate: Float,
}

struct LeagueResult {
  league_id: Int,
  name: Str,
  picks: Int,
  wins: Int,
  win_rate: Float,
}

fn run_backtest(db: sql::Database, season: Int) BacktestResult!Str {
  // 1. Get all finished fixtures for followed leagues in season
  // 2. For each fixture (in chronological order):
  //    a. Compute form comparison as of that fixture's date
  //    b. Get cached odds for the fixture
  //    c. Run picking logic (pick_outcome, pick_team_goal_lines, pick_cleansheet_lines)
  //    d. Compare picks to actual outcomes
  // 3. Aggregate results
}
```

### 2. CLI Tool

Create `backtest_cli.ard` for local execution:

```bash
ard run backtest_cli.ard                    # Run for current season
ard run backtest_cli.ard --season 2024      # Run for specific season
ard run backtest_cli.ard --league 39        # Run for specific league (Premier League)
```

Output:
```
Backtesting 2025 season for 5 leagues...

Overall Results:
  Total picks: 342
  Wins: 198 (57.9%)
  Losses: 144
  ROI: +12.3%

By Bet Type:
  Money Line:      45/82  (54.9%)
  Team Totals:     89/156 (57.1%)
  Clean Sheets:    64/104 (61.5%)

By League:
  Premier League:  52/89  (58.4%)
  La Liga:         41/73  (56.2%)
  ...
```

### 3. Background Job + API

Add to `main.ard`:
- Background job that runs backtest periodically (e.g., daily)
- Store results in a `backtest_results` table
- Expose via `GET /backtest` endpoint

```ard
// Background job
async::start(fn() {
  while {
    let result = backtest::run_backtest(conn, config::CURRENT_SEASON)
    backtest::save_result(conn, result)
    async::sleep(duration::from_hours(24))
  }
})

// API endpoint
"/backtest": fn(req: http::Request) http::Response {
  match req.method {
    http::Method::Get => {
      let result = try backtest::get_latest_result(conn) -> internal_error
      let body = try json::encode(result) -> internal_error
      http::Response{status: 200, headers: res_headers, body: body}
    },
    _ => not_found
  }
}
```

### 4. Schema Addition

```sql
CREATE TABLE backtest_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season INTEGER NOT NULL,
  ran_at INTEGER NOT NULL,
  total_picks INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  win_rate REAL NOT NULL,
  roi REAL NOT NULL,
  raw_data TEXT NOT NULL  -- Full JSON breakdown
);
```

### 5. Frontend Display

Add backtest results to the frontend, possibly on:
- Dashboard/home page showing current strategy performance
- Dedicated `/backtest` page with detailed breakdowns

## Considerations

- **Form calculation timing**: When backtesting fixture X, form should only include fixtures that happened *before* X
- **Odds availability**: Some historical fixtures may not have cached odds - skip or note these
- **Performance**: Running full season backtest may be slow - consider caching intermediate results

## Files to Create/Modify

**Create:**
- `api/server/backtest.ard` - Core backtest engine
- `api/server/backtest_cli.ard` - CLI entry point
- `api/server/migrations/XXX_add_backtest_results.up.sql`
- `web/src/routes/backtest.tsx` - Frontend display (optional)
- `web/src/api/backtest.ts` - API hooks

**Modify:**
- `api/server/main.ard` - Add endpoint and background job

## Impact

Medium-high - New module with significant logic, but largely independent of existing code. High value for strategy refinement.
