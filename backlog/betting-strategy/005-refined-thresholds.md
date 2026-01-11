# 005: Refined Goal Total Thresholds

**Priority:** Phase 1 - Quick Win
**Effort:** 1 day
**Impact:** Medium-High

## Problem Statement

Current thresholds for goal total recommendations are one-sided:
- Over 1.5: Only checks if `team.xgf > 1.5`
- Clean Sheet: Only checks if `team.xga < 1.0`

This ignores the opponent's defensive/offensive strength. A team with 2.0 xGF playing against a team with 0.5 xGA is much different than playing against 2.0 xGA.

**Current logic flaws:**
```ard
// Over 1.5 goals
if team.xgf > 1.5 {
  recommend_over()  // Ignores opponent defense!
}

// Clean sheet
if team.xga < 1.0 {
  recommend_clean_sheet()  // Ignores opponent attack!
}
```

## Proposed Solution

Use **two-sided analysis**: average team's metric with opponent's complementary metric.

**For Over/Under:**
- Team Over 1.5: `(team.xgf + opponent.xga) / 2 > 1.5` AND `team.strike_rate > 0.6`
- Team Under 1.5: `(team.xgf + opponent.xga) / 2 < 1.5` AND `team.strike_rate < 0.4`

**For Clean Sheets:**
- Clean Sheet No: `(opponent.xgf + team.xga) / 2 > 0.8`
- Clean Sheet Yes: `(opponent.xgf + team.xga) / 2 < 0.8` AND `team.cleansheet_rate > 0.4`

This gives more accurate predictions by considering matchup dynamics.

## Implementation

### 1. Update Threshold Logic

**File:** `api/server/predictions.ard` - Lines 187-239

Replace fixed thresholds with matchup-adjusted thresholds:

```ard
// OLD: One-sided
if team.xgf > 1.5 {
  recommend_over_1_5()
}

// NEW: Two-sided with weighted metrics
fn should_recommend_over(
  team: TeamSnapshot,
  opponent: TeamSnapshot,
  line: Float
) Bool {
  // Use weighted metrics (70% recent, 30% season)
  let team_xgf = (team.last_5_xgf * 0.7) + (team.xgf * 0.3)
  let opp_xga = (opponent.last_5_xga * 0.7) + (opponent.xga * 0.3)

  // Average team offense with opponent defense
  let expected_goals = (team_xgf + opp_xga) / 2.0

  // Primary check: expected goals exceeds line
  let meets_threshold = expected_goals > line + 0.2  // Add buffer

  // Secondary check: team has good scoring rate
  let strike_rate_threshold = match line {
    l if l <= 0.5 => 0.4,   // Over 0.5 easier
    l if l <= 1.5 => 0.6,   // Over 1.5 moderate
    l if l <= 2.5 => 0.7,   // Over 2.5 harder
    _ => 0.8                // Over 3.5+ very hard
  }

  let good_strike_rate = team.strike_rate > strike_rate_threshold

  meets_threshold && good_strike_rate
}
```

### 2. Implement for All Bet Types

```ard
// Over 1.5 Goals
if should_recommend_over(home_team, away_team, 1.5) {
  add_recommendation("Home Team Over 1.5 Goals")
}

// Over 2.5 Goals
if should_recommend_over(home_team, away_team, 2.5) {
  add_recommendation("Home Team Over 2.5 Goals")
}

// Under 1.5 Goals
fn should_recommend_under(team: TeamSnapshot, opponent: TeamSnapshot, line: Float) Bool {
  let team_xgf = (team.last_5_xgf * 0.7) + (team.xgf * 0.3)
  let opp_xga = (opponent.last_5_xga * 0.7) + (opponent.xga * 0.3)

  let expected_goals = (team_xgf + opp_xga) / 2.0

  // Must be well below line
  let meets_threshold = expected_goals < line - 0.2

  // Team should have poor scoring record
  let poor_strike_rate = team.strike_rate < 0.5

  meets_threshold && poor_strike_rate
}

// Clean Sheet Logic
fn should_recommend_no_clean_sheet(team: TeamSnapshot, opponent: TeamSnapshot) Bool {
  let opp_xgf = (opponent.last_5_xgf * 0.7) + (opponent.xgf * 0.3)
  let team_xga = (team.last_5_xga * 0.7) + (team.xga * 0.3)

  let expected_goals_conceded = (opp_xgf + team_xga) / 2.0

  // Opponent likely to score
  let meets_threshold = expected_goals_conceded > 0.8

  // OR team has high leakiness
  let is_leaky = team.leakiness > 0.5

  meets_threshold || is_leaky
}

fn should_recommend_clean_sheet(team: TeamSnapshot, opponent: TeamSnapshot) Bool {
  let opp_xgf = (opponent.last_5_xgf * 0.7) + (opponent.xgf * 0.3)
  let team_xga = (team.last_5_xga * 0.7) + (team.xga * 0.3)

  let expected_goals_conceded = (opp_xgf + team_xga) / 2.0

  // Opponent unlikely to score
  let meets_threshold = expected_goals_conceded < 0.6

  // AND team has good clean sheet record
  let good_cs_rate = team.cleansheet_rate > 0.4

  meets_threshold && good_cs_rate
}
```

### 3. Add Buffer Zones

Avoid marginal bets by requiring thresholds be exceeded by a buffer:

```ard
// Instead of: expected_goals > 1.5
// Use: expected_goals > 1.7 (1.5 + 0.2 buffer)

const THRESHOLD_BUFFER = 0.2
```

This reduces false positives and improves recommendation quality.

## Testing

### Comparison Test

Create test cases comparing old vs new logic:

```ard
// Test 1: Strong offense vs strong defense
team = TeamSnapshot{ xgf: 2.0, strike_rate: 0.8 }
opponent = TeamSnapshot{ xga: 0.6 }  // Great defense

// OLD: xgf > 1.5 → YES, recommend over
// NEW: (2.0 + 0.6) / 2 = 1.3 → NO, don't recommend
// CORRECT: Don't bet against elite defense

// Test 2: Moderate offense vs weak defense
team = TeamSnapshot{ xgf: 1.4, strike_rate: 0.65 }
opponent = TeamSnapshot{ xga: 2.0 }  // Poor defense

// OLD: xgf < 1.5 → NO
// NEW: (1.4 + 2.0) / 2 = 1.7 > 1.5 → YES, recommend
// CORRECT: Weak defense creates opportunity

// Test 3: Strong offense vs moderate defense
team = TeamSnapshot{ xgf: 2.2, strike_rate: 0.75 }
opponent = TeamSnapshot{ xga: 1.3 }

// OLD: xgf > 1.5 → YES
// NEW: (2.2 + 1.3) / 2 = 1.75 > 1.5 → YES
// CORRECT: Both methods agree, high confidence
```

### Backtest Validation

1. Run predictions on last 100 matches using:
   - Old thresholds (one-sided)
   - New thresholds (two-sided)
2. Measure:
   - Precision (% of recommendations that won)
   - Recall (% of winning opportunities identified)
   - F1 Score (balance of precision/recall)
3. Expected result: New method has higher precision (fewer false positives)

## Success Criteria

- [ ] Two-sided threshold logic implemented for all bet types
- [ ] Weighted metrics (70/30) used in calculations
- [ ] Buffer zones added to avoid marginal bets
- [ ] Backtest shows improvement in precision
- [ ] Recommendation count may decrease (good - higher quality)
- [ ] Win rate on recommendations increases

## Example Impact

**Before (One-Sided):**
- 20 Over 1.5 recommendations per day
- 11 wins, 9 losses
- 55% win rate

**After (Two-Sided with Buffer):**
- 14 Over 1.5 recommendations per day (fewer, but better)
- 10 wins, 4 losses
- 71% win rate
- Higher confidence, better ROI

## Related Enhancements

- [001: Recent Form Weighting](./001-recent-form-weighting.md) - Uses weighted metrics
- [003: Confidence Scoring](./003-confidence-scoring.md) - Two-sided checks increase confidence
- [004: Expected Value](./004-expected-value.md) - Better thresholds improve EV estimates
