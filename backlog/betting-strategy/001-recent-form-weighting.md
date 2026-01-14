# 001: Recent Form Weighting (70/30)

**Priority:** Phase 1 - Quick Win
**Effort:** 1-2 days
**Impact:** High
**Status:** Complete

## Implementation Summary

### Completed
- ✅ Backend: `get_form()` calculates recent form on-demand from fixtures (uses xG from fixture_stats)
- ✅ Backend: `find_juice()` prefers form stats when available, falls back to season stats otherwise
- ✅ API: `/analysis/:matchId` returns both `comparison` (season) and `form` (last 5, nullable)
- ✅ Frontend: Tabbed UI in matchup modal to switch between Season and Last 5 views
- ✅ Tabs hidden when league not followed or team has < 5 games
- ✅ Reactive labels change based on active tab (xG/xGA for form, Avg Goals For/Against for season)

### Resolution
Recent form better reflects a team's current state than full season averages. For followed leagues with sufficient form data (≥5 games), bet recommendations now use form stats directly. For unfollowed leagues or insufficient data, recommendations fall back to season stats.

---

## Problem Statement

Current system uses entire season statistics without weighting recent performance. This means:
- Teams that were strong early season but are now struggling get overvalued
- Teams improving throughout the season get undervalued
- Predictions don't account for momentum, tactical changes, or roster changes
- Recent form is a better predictor of next match performance than season averages

## Proposed Solution

Calculate separate metrics for last 5 games vs full season, then use weighted average:
- **70% weight** on last 5 games (recent form)
- **30% weight** on season-long stats (stability/sample size)

This balances recency (more predictive) with larger sample size (reduces variance).

## Implementation

### 1. Backend: On-Demand Calculation

**No database changes needed** - calculate recent form metrics on-demand from existing fixtures.

**File:** `api/server/analysis.ard` (new function)

```ard
fn get_recent_form_metrics(
  team_id: Int,
  league_id: Int,
  season: Int,
  limit: Int
) TeamMetrics {
  // Query last N fixtures for this team, ordered by date descending
  let fixtures = db.query(
    "SELECT * FROM fixtures
     WHERE (home_team_id = @team_id OR away_team_id = @team_id)
     AND league_id = @league_id
     AND season = @season
     AND finished = true
     ORDER BY timestamp DESC
     LIMIT @limit"
  ).all(["team_id": team_id, "league_id": league_id, "season": season, "limit": limit])

  // Aggregate metrics for just these N fixtures
  // Same logic as get_metrics(), just on subset of fixtures
  // Returns: wins, draws, losses, xgf, xga, cleansheets, etc.
}
```

**File:** `api/server/predictions.ard` (weighted calculations)

```ard
fn calculate_weighted_xgf(season_xgf: Float, recent_xgf: Float) Float {
  (recent_xgf * 0.7) + (season_xgf * 0.3)
}

fn calculate_weighted_xga(season_xga: Float, recent_xga: Float) Float {
  (recent_xga * 0.7) + (season_xga * 0.3)
}

// In find_juice() - use weighted values for bet recommendations
let season_metrics = analysis::get_metrics(team_id, league_id, season)
let recent_metrics = analysis::get_recent_form_metrics(team_id, league_id, season, 5)

let weighted_xgf = calculate_weighted_xgf(season_metrics.xgf, recent_metrics.xgf)
let weighted_xga = calculate_weighted_xga(season_metrics.xga, recent_metrics.xga)

// Use weighted values in threshold checks
if weighted_xgf > 1.5 {
  // recommend over 1.5 goals
}
```

### 2. API Structure: Existing Implementation

**File:** `api/server/main.ard` - `/analysis/:matchId` endpoint (lines 236-287)

The endpoint already returns both season and recent form data:

```ard
// Existing implementation structure
struct Res {
  comparison: predictions::Comparison,  // Season stats from external API
  form: predictions::Comparison?,       // Recent 5 games from local DB (nullable)
}
```

**Response shape:**
```json
{
  "comparison": {
    "home": { "wins": 12, "draws": 5, "losses": 3, "xgf": 1.8, "xga": 1.1, ... },
    "away": { "wins": 10, "draws": 6, "losses": 4, "xgf": 1.6, "xga": 1.3, ... }
  },
  "form": {
    "home": { "wins": 4, "draws": 1, "losses": 0, "xgf": 2.3, "xga": 0.8, ... },
    "away": { "wins": 2, "draws": 1, "losses": 2, "xgf": 1.4, "xga": 1.6, ... }
  }
}
```

**Key Implementation Details:**
- `comparison` - Season-long stats from external API (`predictions::get_comparison()`)
- `form` - Last 5 games from local DB (`predictions::get_form()`)
  - Uses actual xG data from `fixture_stats` table for xgf/xga calculations
  - Falls back to 0.0 if xG data is missing for a fixture
- `form` is `null` when league is not being followed locally
- `predictions::get_form()` returns empty Snapshot (num_games: 0) when team has < 5 games

**Special case:** If league is not followed, `form` field is `null`. If team has < 5 games, `form.home.num_games` or `form.away.num_games` will be < 5.

### 3. Frontend: Tabbed UI in Matchup Modal

**File:** `web/src/components/matchup.tsx`

Add tabs to switch between Season and Recent Form views:

```tsx
import { createSignal, Show } from 'solid-js';

function Comparison(props: AnalysisData & { juiceData?: JuiceFixture; matchId: number }) {
  const [activeTab, setActiveTab] = createSignal<'season' | 'form'>('season');

  // Determine which dataset to display based on active tab
  const homeStats = () =>
    activeTab() === 'season'
      ? props.comparison.home
      : props.form?.home;

  const awayStats = () =>
    activeTab() === 'season'
      ? props.comparison.away
      : props.form?.away;

  // Calculate trend for tab indicator (compare recent vs season win rate)
  const trendIndicator = () => {
    if (!props.form?.home) return '';

    const homeRecentWinRate = props.form.home.win_rate;
    const homeSeasonWinRate = props.comparison.home.win_rate;

    return homeRecentWinRate > homeSeasonWinRate ? '📈'
      : homeRecentWinRate < homeSeasonWinRate ? '📉'
      : '➡️';
  };

  // Only show tabs if form data exists AND teams have played >= 5 games
  const showTabs = () =>
    props.form?.home &&
    props.form?.away &&
    props.form.home.num_games >= 5 &&
    props.form.away.num_games >= 5;

  return (
    <>
      {/* Team Names with Tabs */}
      <div class="flex justify-between items-center mb-4">
        <h4 class="text-lg font-semibold">Team Statistics</h4>

        {/* Show tabs only if form data exists for both teams with >= 5 games */}
        <Show when={showTabs()}>
          <div class="tabs tabs-boxed tabs-sm">
            <button
              class={`tab ${activeTab() === 'season' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('season')}
            >
              Season
            </button>
            <button
              class={`tab ${activeTab() === 'form' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('form')}
            >
              Last 5 {trendIndicator()}
            </button>
          </div>
        </Show>
      </div>

      {/* Same StatRow components, just use homeStats() and awayStats() */}
      <StatRow
        label="W-D-L Record"
        homeValue={formatRecord(homeStats())}
        awayValue={formatRecord(awayStats())}
        // ... rest of props
      />

      <StatRow
        label="Form Rating"
        homeValue={getFormRating(homeStats())}
        awayValue={getFormRating(awayStats())}
        // ... rest of props
      />

      {/* All other StatRows remain the same, just pull from homeStats()/awayStats() */}
    </>
  );
}
```

**Key UX Decisions:**
- Tabs integrated with section header (compact placement)
- "Last 5" tab hidden if `form` is null OR either team has < 5 games
- Trend indicator (📈/📉/➡️) compares recent win_rate vs season win_rate
- Same metrics shown in both tabs - just different data windows
- Same Form Rating thresholds used for both (pure calculation per window)

## Testing

### Unit Tests

**Backend:**
```ard
// Test weighted calculation
let weighted = calculate_weighted_xgf(1.5, 2.0)
assert(weighted == 1.85)  // (2.0 * 0.7) + (1.5 * 0.3)

// Test recent form aggregation
let recent = get_recent_form_metrics(team_id, league_id, season, 5)
assert(recent.num_games == 5 or recent.num_games == 0)  // Either 5 games or team hasn't played enough
```

**Frontend:**
```typescript
// Test tab visibility
// If team has < 5 games, Last 5 tab should not appear
const team = { season: {...}, recent5: null };
expect(shouldShowRecentTab(team)).toBe(false);

// Test trend indicator
const improving = { season: { win_rate: 0.5 }, recent5: { win_rate: 0.8 } };
expect(getTrendIndicator(improving)).toBe('📈');

const declining = { season: { win_rate: 0.7 }, recent5: { win_rate: 0.4 } };
expect(getTrendIndicator(declining)).toBe('📉');
```

### Integration Tests
1. Query fixtures and verify `get_recent_form_metrics()` returns correct aggregation
2. Verify API endpoint `/analysis/:matchId` returns both `season` and `recent5` objects
3. Verify `recent5` is `null` when team has played < 5 games
4. Verify bet recommendations use weighted values in threshold checks

### Manual Testing
1. Open matchup modal for team with 10+ games played
2. Verify "Last 5" tab appears with trend indicator
3. Switch between tabs - verify stats update correctly
4. Check team with only 3 games played - verify Last 5 tab is hidden
5. Verify all StatRow components work in both tabs

### Performance Testing
1. Measure query time for `get_recent_form_metrics()` (should be < 50ms)
2. Test with 20 concurrent matchup requests - no slowdown expected
3. Verify no N+1 queries (should be 2 queries per team: season + recent)

### Validation
1. Backtest weighted predictions on historical data (last 100 matches)
2. Compare accuracy:
   - Old method (season only)
   - New method (70/30 weighted)
3. Measure improvement in ROI and win rate

## Rollout

1. **Backend**: Deploy `get_recent_form_metrics()` function
2. **API**: Update `/analysis/:matchId` to return both season and recent5
3. **Frontend**: Add tabbed UI to matchup modal
4. **Predictions**: Update `find_juice()` to use weighted calculations
5. Monitor performance and bet recommendation quality for 1 week

## Success Criteria

- [x] `get_form()` function calculates recent form on-demand from fixtures
- [x] API returns both `comparison` and `form` data in single call
- [x] Matchup modal shows tabs with correct data in each view
- [x] Last 5 tab hidden when team has < 5 games or league not followed
- [x] ~~Trend indicator (📈/📉) displays correctly~~ (removed - not needed)
- [x] Bet recommendations prefer recent form stats when available
- [ ] No performance degradation (< 100ms API response time)
- [ ] Backtest shows improvement over season-only approach

## Related Enhancements

- [003: Confidence Scoring](./003-confidence-scoring.md) - Uses form consistency
- [009: Matchup Visualization](../ux/009-matchup-visualization.md) - Displays weighted comparison
