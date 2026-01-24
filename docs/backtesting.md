# Backtesting

## Overview

A backtesting system was explored to validate the EV prediction model against historical fixtures. The goal was to compare predicted picks to actual outcomes and calculate ROI.

## Implementation

Two files were created:
- `api/server/backtest.ard` - Core backtest engine
- `api/server/backtest_cli.ard` - CLI entry point

### Usage

```bash
# Normal mode - test all fixtures
ard run backtest_cli.ard 2025

# Verbose mode - detailed logging for first N fixtures
ard run backtest_cli.ard 2025 verbose 10
```

### What It Does

1. Queries finished fixtures for active leagues in a given season
2. For each fixture, calculates team form using only games played BEFORE that fixture
3. Fetches odds and runs the EV picking logic
4. Resolves picks against actual outcomes (win/lose)
5. Aggregates results by bet type with win rate, ROI, and average EV

## Key Limitation: No Historical Odds

**The backtesting approach is fundamentally limited because the odds API (API-Football) does not provide historical odds data.**

- Odds are only available for upcoming/recent fixtures
- Once a match finishes, bookmakers remove the odds
- The API cache (4-hour TTL) doesn't persist odds long-term

### Fixture Skip Reasons

| Reason | Typical Count | Explanation |
|--------|---------------|-------------|
| Missing form | ~55 per league | First 5 matchweeks - teams don't have 5 prior games yet |
| No odds | ~400+ | Historical fixtures - API doesn't serve old odds |
| Tested | ~30-40 | Only recent fixtures with cached odds |

## Lessons Learned

1. **Form calculation works correctly** - The "as of" logic properly filters to games before the fixture timestamp

2. **Early season fixtures are naturally excluded** - Requiring 5 prior games means matchdays 1-5 can't be backtested

3. **Probability estimation needs work** - The original `estimate_goal_line_probability` function only returned 4 discrete values (42%, 52%, 62%, 72%). A better approximation was implemented in `backtest.ard` that scales properly with expected goals vs line.

4. **Odds are the blocker** - Even with perfect form data and probability models, backtesting requires historical odds which aren't available from free APIs.

## Future Options

If backtesting becomes important:

1. **Store odds permanently** - Save odds to a dedicated table when fetched for upcoming fixtures, enabling future backtests

2. **Weekly validation** - Run backtests on recently completed fixtures while odds are still cached

3. **Historical odds provider** - Services like Odds Portal sell historical data (paid)

4. **Synthetic odds** - Generate odds from market-average margins (less accurate but allows model validation)

## Files

- `api/server/backtest.ard` - Contains structs, form calculation, bet resolution, probability estimation
- `api/server/backtest_cli.ard` - CLI with normal and verbose modes
