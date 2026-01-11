# 001: Recent Form Weighting (70/30)

**Priority:** Phase 1 - Quick Win
**Effort:** 1-2 days
**Impact:** High

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

### 2. API Structure: Single Call Returns Both Datasets

**File:** `api/server/analysis.ard` - Update `/analysis/:matchId` endpoint

```ard
// Existing endpoint enhanced to return both season and recent5 data
fn get_comparison(home_team_id: Int, away_team_id: Int, league_id: Int, season: Int) Comparison {
  // Get season-long metrics (existing)
  let home_season = get_metrics(home_team_id, league_id, season)
  let away_season = get_metrics(away_team_id, league_id, season)

  // Get recent form metrics (NEW)
  let home_recent = get_recent_form_metrics(home_team_id, league_id, season, 5)
  let away_recent = get_recent_form_metrics(away_team_id, league_id, season, 5)

  Comparison {
    home: [
      "season": home_season,
      "recent5": home_recent
    ],
    away: [
      "season": away_season,
      "recent5": away_recent
    ]
  }
}
```

**Response shape:**
```json
{
  "comparison": {
    "home": {
      "season": { "wins": 12, "draws": 5, "losses": 3, "xgf": 1.8, "xga": 1.1, ... },
      "recent5": { "wins": 4, "draws": 1, "losses": 0, "xgf": 2.3, "xga": 0.8, ... }
    },
    "away": {
      "season": { "wins": 10, "draws": 6, "losses": 4, "xgf": 1.6, "xga": 1.3, ... },
      "recent5": { "wins": 2, "draws": 1, "losses": 2, "xgf": 1.4, "xga": 1.6, ... }
    }
  }
}
```

**Special case:** If team has < 5 games played, `recent5` field is `null`.

### 3. Frontend: Tabbed UI in Matchup Modal

**File:** `web/src/components/matchup.tsx`

Add tabs to switch between Season and Recent Form views:

```tsx
import { createSignal, Show } from 'solid-js';

function Comparison(props: AnalysisData & { juiceData?: JuiceFixture; matchId: number }) {
  const [activeTab, setActiveTab] = createSignal<'season' | 'recent5'>('season');

  // Determine which dataset to display
  const homeStats = () =>
    activeTab() === 'season'
      ? props.comparison.home.season
      : props.comparison.home.recent5;

  const awayStats = () =>
    activeTab() === 'season'
      ? props.comparison.away.season
      : props.comparison.away.recent5;

  // Calculate trend for tab indicator
  const trendIndicator = () => {
    if (!props.comparison.home.recent5) return '';

    const homeRecent = props.comparison.home.recent5.wins / 5;
    const homeSeason = props.comparison.home.season.wins /
      (props.comparison.home.season.wins + props.comparison.home.season.draws + props.comparison.home.season.losses);

    return homeRecent > homeSeason ? '📈' : homeRecent < homeSeason ? '📉' : '➡️';
  };

  return (
    <>
      {/* Team Names with Tabs */}
      <div class="flex justify-between items-center mb-4">
        <h4 class="text-lg font-semibold">Team Statistics</h4>

        {/* Show tabs only if recent5 data exists */}
        <Show when={props.comparison.home.recent5}>
          <div class="tabs tabs-boxed tabs-sm">
            <button
              class={`tab ${activeTab() === 'season' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('season')}
            >
              Season
            </button>
            <button
              class={`tab ${activeTab() === 'recent5' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('recent5')}
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
- "Last 5" tab hidden if team hasn't played 5 games
- Trend indicator (📈/📉/➡️) shows if recent form is better/worse/same as season
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

- [ ] `get_recent_form_metrics()` function calculates correctly on-demand
- [ ] API returns both `season` and `recent5` data in single call
- [ ] Matchup modal shows tabs with correct data in each view
- [ ] Last 5 tab hidden when team has < 5 games
- [ ] Trend indicator (📈/📉) displays correctly
- [ ] Bet recommendations use weighted (70/30) values
- [ ] No performance degradation (< 100ms API response time)
- [ ] Backtest shows improvement over season-only approach

## Related Enhancements

- [003: Confidence Scoring](./003-confidence-scoring.md) - Uses form consistency
- [009: Matchup Visualization](../ux/009-matchup-visualization.md) - Displays weighted comparison
