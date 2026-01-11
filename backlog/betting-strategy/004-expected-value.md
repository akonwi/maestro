# 004: Expected Value (EV) Calculations

**Priority:** Phase 1 - Quick Win
**Effort:** 1-2 days
**Impact:** High

## Problem Statement

Current system filters by odds (only >= -150) but doesn't calculate expected value. This means:
- No way to know if a bet is actually profitable long-term
- Can't compare bets with different odds fairly
- Missing true "edge" calculation
- Treating -110 with 60% win probability same as -110 with 52% win probability

Expected Value (EV) shows average profit/loss per dollar wagered:
- **Positive EV (+5%)**: Bet returns $1.05 per $1 on average → GOOD BET
- **Negative EV (-3%)**: Bet loses $0.03 per $1 on average → BAD BET, SKIP

## Proposed Solution

Calculate true win probability from statistics, compare to implied probability from odds:
1. Estimate true probability using weighted xG, form, home/away
2. Convert odds to implied probability
3. Calculate EV = (True Win% × Payout) - (True Loss% × Stake)
4. Only recommend bets with EV% > 5% (configurable threshold)
5. Display EV% prominently in UI to help prioritize

## Implementation

### 1. Probability Estimation

**File:** `api/server/predictions.ard`

```ard
fn estimate_win_probability(
  team: TeamSnapshot,
  opponent: TeamSnapshot,
  bet_type: Str,
  line: Float
) Float {
  // Calculate weighted metrics (70% recent, 30% season)
  let team_xgf = (team.last_5_xgf * 0.7) + (team.xgf * 0.3)
  let team_xga = (team.last_5_xga * 0.7) + (team.xga * 0.3)
  let opp_xgf = (opponent.last_5_xgf * 0.7) + (opponent.xgf * 0.3)
  let opp_xga = (opponent.last_5_xga * 0.7) + (opponent.xga * 0.3)

  match bet_type {
    "Over Goals" => {
      // Average of team offense and opponent defense
      let expected_goals = (team_xgf + opp_xga) / 2.0

      // Probability based on distance from line
      // Simple model: probability decreases as line increases
      if expected_goals >= line + 0.5 {
        return 0.75  // Strong confidence
      } else if expected_goals >= line + 0.3 {
        return 0.65  // Good confidence
      } else if expected_goals >= line {
        return 0.55  // Slight edge
      } else {
        return 0.45  // Below threshold
      }
    },

    "Under Goals" => {
      let expected_goals = (team_xgf + opp_xga) / 2.0

      if expected_goals <= line - 0.5 {
        return 0.75
      } else if expected_goals <= line - 0.3 {
        return 0.65
      } else if expected_goals <= line {
        return 0.55
      } else {
        return 0.45
      }
    },

    "Clean Sheet No" => {
      // Probability opponent scores based on opponent xGF vs team xGA
      let opponent_attack = (opp_xgf + team_xga) / 2.0

      if opponent_attack >= 1.5 {
        return 0.75  // Very likely to score
      } else if opponent_attack >= 1.2 {
        return 0.65
      } else if opponent_attack >= 1.0 {
        return 0.55
      } else {
        return 0.45
      }
    },

    "Clean Sheet Yes" => {
      let opponent_attack = (opp_xgf + team_xga) / 2.0

      if opponent_attack <= 0.8 {
        return 0.70  // Strong defense
      } else if opponent_attack <= 1.0 {
        return 0.60
      } else if opponent_attack <= 1.2 {
        return 0.50
      } else {
        return 0.40
      }
    },

    _ => 0.50  // Default 50/50
  }
}
```

### 2. Implied Probability from Odds

```ard
fn odds_to_implied_probability(american_odds: Int) Float {
  if american_odds > 0 {
    // Positive odds: +150 = 100/(150+100) = 40%
    100.0 / (american_odds + 100)
  } else {
    // Negative odds: -150 = 150/(150+100) = 60%
    let abs_odds = american_odds.abs()
    abs_odds / (abs_odds + 100)
  }
}
```

### 3. Expected Value Calculation

```ard
fn calculate_ev(
  true_win_prob: Float,
  american_odds: Int
) [Str: Float] {
  // Convert odds to decimal for payout calculation
  let decimal_odds = if american_odds > 0 {
    (american_odds / 100.0) + 1.0
  } else {
    (100.0 / american_odds.abs()) + 1.0
  }

  // Calculate EV
  let win_amount = decimal_odds - 1.0  // Profit on $1 bet
  let loss_amount = 1.0                 // Lose $1 if bet loses

  let ev = (true_win_prob * win_amount) - ((1.0 - true_win_prob) * loss_amount)
  let ev_percentage = ev * 100.0

  // Also calculate implied probability for comparison
  let implied_prob = odds_to_implied_probability(american_odds)

  [
    "ev": ev,
    "ev_percentage": ev_percentage,
    "true_win_prob": true_win_prob,
    "implied_prob": implied_prob,
    "edge": true_win_prob - implied_prob
  ]
}
```

### 4. Filter by Minimum EV

**File:** `api/server/predictions.ard` - `find_juice()`

```ard
// After calculating confidence and EV
let true_prob = estimate_win_probability(team, opponent, bet_type, line)
let ev_calc = calculate_ev(true_prob, odds)

// Only recommend if EV is positive and above threshold
if ev_calc["ev_percentage"] >= 5.0 {
  bets.push([
    "match_id": fixture.id,
    "description": "{team.name} {bet_type}",
    "odds": odds,
    "line": line,
    "confidence": confidence,

    // NEW EV fields
    "ev_percentage": ev_calc["ev_percentage"],
    "true_win_prob": ev_calc["true_win_prob"] * 100,
    "implied_prob": ev_calc["implied_prob"] * 100,
    "edge": ev_calc["edge"] * 100,
  ])
}
```

### 5. Frontend Display

**File:** `web/src/routes/index.tsx`

```tsx
interface BetRecommendation {
  // ... existing
  ev_percentage: number;
  true_win_prob: number;
  implied_prob: number;
  edge: number;
}

function EVBadge({ ev }: { ev: number }) {
  const color = ev >= 10 ? 'badge-success' :
                ev >= 5 ? 'badge-warning' :
                'badge-ghost';

  return (
    <div class={`badge ${color} gap-1`}>
      <span>EV: {ev > 0 ? '+' : ''}{ev.toFixed(1)}%</span>
    </div>
  );
}

// In bet card
<div class="card">
  <div class="card-body">
    <h3>{bet.description}</h3>
    <div class="flex gap-2">
      <ConfidenceStars stars={bet.confidence_stars} />
      <EVBadge ev={bet.ev_percentage} />
    </div>
    <div class="text-xs text-base-content/60">
      True: {bet.true_win_prob.toFixed(0)}% |
      Implied: {bet.implied_prob.toFixed(0)}% |
      Edge: +{bet.edge.toFixed(1)}%
    </div>
  </div>
</div>
```

### 6. Sort by EV

```tsx
<select class="select select-sm">
  <option>Sort by: Time</option>
  <option>Sort by: EV ↓</option>
  <option>Sort by: Confidence ↓</option>
</select>

// Sorting logic
const sortedBets = createMemo(() => {
  const bets = filteredBets();
  if (sortBy() === 'ev') {
    return [...bets].sort((a, b) => b.ev_percentage - a.ev_percentage);
  }
  // ...
});
```

## Testing

### Unit Tests

```ard
// Test 1: Positive odds
odds = +150  // 40% implied probability
true_prob = 0.55  // 55% true probability

ev_calc = calculate_ev(true_prob, odds)

// Win: 55% × 1.5 = 0.825
// Lose: 45% × 1.0 = 0.45
// EV = 0.825 - 0.45 = 0.375 = +37.5%
assert(ev_calc["ev_percentage"] > 35.0)
assert(ev_calc["edge"] > 0.15)  // 15% edge

// Test 2: Negative odds
odds = -110  // 52.4% implied probability
true_prob = 0.60  // 60% true probability

ev_calc = calculate_ev(true_prob, odds)

// Win: 60% × 0.909 = 0.545
// Lose: 40% × 1.0 = 0.40
// EV = 0.545 - 0.40 = 0.145 = +14.5%
assert(ev_calc["ev_percentage"] > 12.0)

// Test 3: Negative EV (should not recommend)
odds = -150
true_prob = 0.55  // Not high enough for -150

ev_calc = calculate_ev(true_prob, odds)
assert(ev_calc["ev_percentage"] < 0)  // Negative EV, skip
```

### Validation

1. Review high EV bets (>10%) - should have clear statistical edge
2. Review moderate EV bets (5-10%) - should be solid recommendations
3. Track actual results over 50+ bets:
   - Do +10% EV bets actually return ~10% profit?
   - Do +5% EV bets actually return ~5% profit?

## Success Criteria

- [ ] Win probability estimation implemented
- [ ] EV calculation working correctly
- [ ] Only positive EV bets recommended (threshold: 5%+)
- [ ] UI displays EV percentage with color coding
- [ ] Can sort/filter by EV
- [ ] Over 100 bets, actual ROI approximates average EV

## Example Output

```
High EV Bets:

1. Arsenal Over 1.5 Goals (-110)
   EV: +12.4% | Confidence: ⭐⭐⭐⭐⭐
   True Win: 65% | Implied: 52% | Edge: +13%

2. Chelsea Clean Sheet No (+105)
   EV: +8.7% | Confidence: ⭐⭐⭐⭐
   True Win: 58% | Implied: 49% | Edge: +9%
```

## Related Enhancements

- [003: Confidence Scoring](./003-confidence-scoring.md) - Combine with EV for ranking
- [007: Kelly Criterion](./007-kelly-criterion.md) - Use EV for optimal bet sizing
- [010: Poisson Distribution](../statistics/010-poisson-distribution.md) - More accurate probability estimates
