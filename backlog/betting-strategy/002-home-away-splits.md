# 002: Home/Away Performance Splits

**Priority:** Phase 2 - Medium Effort
**Effort:** 3-5 days
**Impact:** High

## Problem Statement

Current system treats team performance as uniform regardless of venue. In reality:
- Many teams perform significantly better at home (crowd support, travel factors)
- Some teams are stronger away (counter-attacking style)
- Home/away splits can vary dramatically (2.0 xGF home vs 1.2 xGF away)
- Ignoring venue leads to inaccurate predictions

## Proposed Solution

Track and store separate statistics for home and away performance:
- Home: xGF, xGA, goals_diff, win_rate, clean_sheet_rate
- Away: xGF, xGA, goals_diff, win_rate, clean_sheet_rate

When predicting, use venue-specific stats combined with 70/30 recent form weighting.

## Implementation

### 1. Database Schema Changes

**File:** `api/server/migrations/004_add_home_away_splits.up.sql`

```sql
-- Add home performance columns
ALTER TABLE team_snapshots ADD COLUMN home_xgf REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN home_xga REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN home_goals_diff INTEGER DEFAULT 0;
ALTER TABLE team_snapshots ADD COLUMN home_win_rate REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN home_cleansheet_rate REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN home_games INTEGER DEFAULT 0;

-- Add away performance columns
ALTER TABLE team_snapshots ADD COLUMN away_xgf REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN away_xga REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN away_goals_diff INTEGER DEFAULT 0;
ALTER TABLE team_snapshots ADD COLUMN away_win_rate REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN away_cleansheet_rate REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN away_games INTEGER DEFAULT 0;
```

### 2. Backend Data Collection

**File:** `api/server/analysis.ard` - `get_metrics()` function

Separate aggregation by venue:

```ard
fn get_home_metrics(team_id: Int, league_id: Int, season: Int) TeamMetrics {
  // Query fixtures WHERE team_id = home_team_id
  // Aggregate xGF, xGA, goals, etc.
}

fn get_away_metrics(team_id: Int, league_id: Int, season: Int) TeamMetrics {
  // Query fixtures WHERE team_id = away_team_id
  // Aggregate xGF, xGA, goals, etc.
}
```

### 3. Update Prediction Logic

**File:** `api/server/predictions.ard`

Use venue-specific stats when comparing teams:

```ard
fn get_comparison(home_team_id: Int, away_team_id: Int, ...) Comparison {
  let home_snapshot = get_team_snapshot(home_team_id, league_id, season)
  let away_snapshot = get_team_snapshot(away_team_id, league_id, season)

  // Use home team's HOME stats
  let home_xgf = calculate_weighted_xgf(
    home_snapshot.home_xgf,        // season home avg
    home_snapshot.last_5_home_xgf  // recent home form
  )

  // Use away team's AWAY stats
  let away_xgf = calculate_weighted_xgf(
    away_snapshot.away_xgf,        // season away avg
    away_snapshot.last_5_away_xgf  // recent away form
  )

  // Compare home team's home offense vs away team's away defense
  Comparison {
    home_attack: home_xgf,
    home_defense: home_snapshot.home_xga,
    away_attack: away_xgf,
    away_defense: away_snapshot.away_xga,
    ...
  }
}
```

### 4. Recent Form + Venue Combination

For last 5 games, track venue separately:

```ard
// Example team with strong home form, weak away form
last_5_home_record: "3-0-0"  // 3 wins at home
last_5_away_record: "0-1-1"  // 0 wins away

last_5_home_xgf: 2.5
last_5_away_xgf: 1.0
```

### 5. Frontend Display

**File:** `web/src/components/matchup.tsx`

Show home/away split in matchup comparison:

```tsx
<div class="grid grid-cols-2 gap-4">
  <div>
    <h3>{homeTeam.name} (Home)</h3>
    <div class="stats">
      <div class="stat">
        <div class="stat-title">Home xGF</div>
        <div class="stat-value">{homeTeam.home_xgf}</div>
        <div class="stat-desc">vs {homeTeam.xgf} overall</div>
      </div>
      <div class="stat">
        <div class="stat-title">Home Record</div>
        <div class="stat-value">{homeTeam.home_win_rate}%</div>
      </div>
    </div>
  </div>

  <div>
    <h3>{awayTeam.name} (Away)</h3>
    <div class="stats">
      <div class="stat">
        <div class="stat-title">Away xGF</div>
        <div class="stat-value">{awayTeam.away_xgf}</div>
        <div class="stat-desc">vs {awayTeam.xgf} overall</div>
      </div>
      <div class="stat">
        <div class="stat-title">Away Record</div>
        <div class="stat-value">{awayTeam.away_win_rate}%</div>
      </div>
    </div>
  </div>
</div>
```

## Testing

### Data Validation
1. Verify home + away games = total games
2. Check that home_xgf ≠ away_xgf for teams with clear home advantage
3. Validate calculations against manual aggregation

### Prediction Accuracy
1. Backtest predictions with home/away splits vs without
2. Measure improvement in:
   - Over/under accuracy
   - Money line accuracy
   - Clean sheet predictions

### Edge Cases
1. Teams with 0 home or away games (early season)
2. Neutral venue matches (use overall stats)
3. Teams that changed stadiums mid-season

## Success Criteria

- [ ] Database migration applied successfully
- [ ] Home/away metrics calculated for all teams
- [ ] Prediction logic uses venue-specific stats
- [ ] UI clearly shows home vs away performance
- [ ] Backtest shows improvement in prediction accuracy
- [ ] No performance degradation in queries

## Example Impact

**Manchester City (hypothetical):**
- Overall xGF: 2.0
- Home xGF: 2.5 (much stronger at home)
- Away xGF: 1.6

**Old prediction (Man City away):**
- Uses overall 2.0 xGF → Recommends Over 1.5

**New prediction (Man City away):**
- Uses away 1.6 xGF → More conservative, better accuracy

## Related Enhancements

- [001: Recent Form Weighting](./001-recent-form-weighting.md) - Combine with venue splits
- [003: Confidence Scoring](./003-confidence-scoring.md) - Factor venue advantage into confidence
- [009: Matchup Visualization](../ux/009-matchup-visualization.md) - Display home/away comparison
