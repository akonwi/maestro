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

### 1. Backend Changes

**File:** `api/server/predictions.ard`

Add fields to team snapshots:
```ard
// Existing: season-long metrics
xgf: 1.8
xga: 1.1
goals_diff: 12

// NEW: last 5 games metrics
last_5_xgf: 2.1
last_5_xga: 0.8
last_5_goals_diff: 7
last_5_record: "4-1-0"  // W-D-L
current_streak: 4       // Consecutive wins (negative for losses)
```

Calculate weighted metrics:
```ard
fn calculate_weighted_xgf(season_xgf: Float, last_5_xgf: Float) Float {
  (last_5_xgf * 0.7) + (season_xgf * 0.3)
}

fn calculate_weighted_xga(season_xga: Float, last_5_xga: Float) Float {
  (last_5_xga * 0.7) + (season_xga * 0.3)
}
```

### 2. Database Changes

**File:** `api/server/migrations/003_add_recent_form_metrics.up.sql`

```sql
ALTER TABLE team_snapshots ADD COLUMN last_5_xgf REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN last_5_xga REAL DEFAULT 0.0;
ALTER TABLE team_snapshots ADD COLUMN last_5_goals_diff INTEGER DEFAULT 0;
ALTER TABLE team_snapshots ADD COLUMN last_5_record TEXT DEFAULT '0-0-0';
ALTER TABLE team_snapshots ADD COLUMN current_streak INTEGER DEFAULT 0;
```

### 3. Update Predictions Logic

**File:** `api/server/predictions.ard` - `find_juice()` function

Replace direct xGF/xGA usage with weighted values:

```ard
// OLD
if team.xgf > 1.5 {
  // recommend over 1.5 goals
}

// NEW
let weighted_xgf = calculate_weighted_xgf(team.xgf, team.last_5_xgf)
if weighted_xgf > 1.5 {
  // recommend over 1.5 goals
}
```

### 4. Frontend Display

**Files:**
- `web/src/components/matchup.tsx`
- `web/src/routes/index.tsx`

Add fields to API response:
```typescript
interface BetRecommendation {
  // ... existing fields

  // NEW
  recent_metric: number;     // last_5_xgf or last_5_xga
  season_metric: number;     // season xgf or xga
  weighted_metric: number;   // 70/30 calculated value
  form_rating: "hot" | "good" | "mixed" | "cold";
}
```

Display in UI:
```tsx
<div class="text-xs text-base-content/60">
  Recent (L5): {bet.recent_metric.toFixed(1)} |
  Season: {bet.season_metric.toFixed(1)} |
  Weighted: {bet.weighted_metric.toFixed(2)}
</div>
```

## Testing

### Unit Tests
1. Test `calculate_weighted_xgf()` with various inputs:
   - Recent high, season low → should be closer to recent
   - Recent low, season high → should be closer to recent but moderated
   - Both equal → should return same value

### Integration Tests
1. Create team snapshot with:
   - Season xGF: 1.5, Last 5 xGF: 2.0
   - Verify weighted = (2.0 × 0.7) + (1.5 × 0.3) = 1.85
2. Verify bet recommendations use weighted value, not season average

### Validation
1. Backtest on historical data (last 100 matches)
2. Compare predictions using:
   - Old method (season only)
   - New method (70/30 weighted)
3. Measure improvement in accuracy and ROI

## Rollout

1. Add database columns with default values (won't break existing code)
2. Deploy backend changes to calculate and store recent form metrics
3. Update prediction logic to use weighted values
4. Deploy frontend to display recent/season/weighted metrics
5. Monitor for 1 week, compare bet performance to previous week

## Success Criteria

- [ ] Database migration applied successfully
- [ ] Recent form metrics calculated and stored for all teams
- [ ] Weighted calculations used in `find_juice()`
- [ ] UI displays all three metrics (recent, season, weighted)
- [ ] Backtest shows improvement over season-only approach
- [ ] No regression in existing bet resolution system

## Related Enhancements

- [003: Confidence Scoring](./003-confidence-scoring.md) - Uses form consistency
- [009: Matchup Visualization](../ux/009-matchup-visualization.md) - Displays weighted comparison
