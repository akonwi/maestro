# 004: Expected Value (EV) Calculations

**Priority:** Phase 1 - Quick Win
**Effort:** Split into 3 phases (see below)
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

## Implementation Phases

### Phase 1: Basic EV Calculation (1 day)
- Add EV formula with simple probability estimation
- Display EV% in UI
- Filter by minimum EV threshold

### Phase 2: Venue-Aware Probability Model (1-2 days)
- Use `TeamSeasonStats.home_only` / `away_only` for venue context
- Factor in matchup dynamics (attack vs defense)
- Weight recent form vs season averages

### Phase 3: Model Calibration (ongoing)
- Track predicted vs actual outcomes
- Adjust probability model based on historical accuracy
- Consider Poisson distribution for goal-based bets

## Current State

**Available Data:**
- `Snapshot` struct with: xgf, xga, strike_rate, win_rate, leakiness, cleansheets
- `get_form()` - returns last 5 games as Snapshot
- `get_team_season_stats()` - returns `TeamSeasonStats` with `overall`, `home_only`, `away_only`
- American odds available via `odds::get()`

**Current Filtering (to be replaced):**
- Hard-coded threshold comparisons (e.g., `xgf > 1.5` for Over 1.5)
- Odds floor of `-150`
- No probability or EV calculation

## References

- [Pinnacle: How to Calculate Expected Value](https://www.pinnacle.com/betting-resources/en/betting-strategy/how-to-calculate-expected-value/ees2ve46tm4htt32)
- [TheLines: Calculate Implied Probability for American Odds](https://www.thelines.com/calculate-implied-probability-american-betting-odds/)

### Example from Pinnacle

> An NFL underdog is listed at +150 on the moneyline (implied win probability ~40%). After doing your homework, you believe this team actually has about a 45% chance to win.
>
> If you place a $20 bet at +150, your potential profit is $30. Using the EV formula:
> `0.45 × $30 – 0.55 × $20 = $13.50 – $11.00 = +$2.50 expected value`
>
> That +$2.50 may seem modest, but it's an edge of 12.5% on your $20 stake.

---

## Phase 1 Implementation

### 1. Implied Probability from Odds

Implied probability is what the bookmaker's odds suggest as the "true" chance of an outcome.

**Formulas:**
| Odds Type | Formula | Example |
|-----------|---------|---------|
| Positive (+150) | `100 / (odds + 100)` | 100 / 250 = 40% |
| Negative (-110) | `|odds| / (|odds| + 100)` | 110 / 210 = 52.4% |

**File:** `api/server/predictions.ard`

```ard
fn odds_to_implied_probability(american_odds: Int) Float {
  if american_odds > 0 {
    // Positive odds: +150 = 100/(150+100) = 40%
    100.0 / Float::from_int(american_odds + 100)
  } else {
    // Negative odds: -110 = 110/(110+100) = 52.4%
    let abs_odds = american_odds * -1
    Float::from_int(abs_odds) / Float::from_int(abs_odds + 100)
  }
}
```

### 2. Simple Probability Estimation (Phase 1)

Uses basic thresholds - will be improved in Phase 2.

```ard
fn estimate_win_probability(
  team: Snapshot,
  opponent: Snapshot,
  bet_type: Str,
  line: Float
) Float {
  match bet_type {
    "Over Goals" => {
      let expected_goals = (team.xgf + opponent.xga) / 2.0
      let diff = expected_goals - line
      match {
        diff >= 0.5 => 0.72,
        diff >= 0.3 => 0.62,
        diff >= 0.0 => 0.52,
        _ => 0.42
      }
    },
    "Under Goals" => {
      let expected_goals = (team.xgf + opponent.xga) / 2.0
      let diff = line - expected_goals
      match {
        diff >= 0.5 => 0.72,
        diff >= 0.3 => 0.62,
        diff >= 0.0 => 0.52,
        _ => 0.42
      }
    },
    "Clean Sheet No" => {
      let opponent_attack = (opponent.xgf + team.xga) / 2.0
      match {
        opponent_attack >= 1.5 => 0.75,
        opponent_attack >= 1.2 => 0.65,
        opponent_attack >= 1.0 => 0.55,
        _ => 0.45
      }
    },
    "Clean Sheet Yes" => {
      let opponent_attack = (opponent.xgf + team.xga) / 2.0
      match {
        opponent_attack <= 0.8 => 0.65,
        opponent_attack <= 1.0 => 0.55,
        opponent_attack <= 1.2 => 0.45,
        _ => 0.35
      }
    },
    _ => 0.50
  }
}
```

### 3. Expected Value Calculation

```ard
struct EVResult {
  ev: Float,              // Raw EV (-1.0 to +inf)
  ev_percentage: Float,   // EV as percentage
  true_win_prob: Float,   // Our estimated probability
  implied_prob: Float,    // Bookmaker's implied probability
  edge: Float,            // Our edge over bookmaker
}

fn calculate_ev(true_win_prob: Float, american_odds: Int) EVResult {
  // Convert odds to decimal for payout calculation
  let decimal_odds = match american_odds > 0 {
    true => Float::from_int(american_odds) / 100.0 + 1.0,
    false => 100.0 / Float::from_int(american_odds * -1) + 1.0
  }

  let win_amount = decimal_odds - 1.0  // Profit on $1 bet
  let loss_amount = 1.0                 // Lose $1 if bet loses

  let ev = (true_win_prob * win_amount) - ((1.0 - true_win_prob) * loss_amount)
  let implied_prob = odds_to_implied_probability(american_odds)

  EVResult{
    ev: ev,
    ev_percentage: ev * 100.0,
    true_win_prob: true_win_prob,
    implied_prob: implied_prob,
    edge: true_win_prob - implied_prob,
  }
}
```

### 4. Update Juice Selection Logic

Replace current threshold-based filtering with EV-based filtering:

```ard
// In find_juice(), replace pick_team_goal_lines with:
fn evaluate_bet(
  team: Snapshot,
  opponent: Snapshot,
  bet_type: Str,
  line: Float,
  odds: Int,
  min_ev: Float  // e.g., 5.0 for 5%
) EVResult? {
  let true_prob = estimate_win_probability(team, opponent, bet_type, line)
  let ev_result = calculate_ev(true_prob, odds)

  match ev_result.ev_percentage >= min_ev {
    true => maybe::some(ev_result),
    false => maybe::none()
  }
}
```

### 5. Frontend Display

**File:** `web/src/routes/index.tsx`

Add EV data to the juice response type and display it:

```tsx
// Update Line type to include EV data
interface LineWithEV {
  name: string;
  odd: number;
  ev_percentage: number;
  true_win_prob: number;
  implied_prob: number;
  edge: number;
}

// EV Badge component
function EVBadge(props: { ev: number }) {
  const color = () => {
    if (props.ev >= 10) return 'badge-success';
    if (props.ev >= 5) return 'badge-warning';
    return 'badge-ghost';
  };

  return (
    <span class={`badge ${color()}`}>
      EV: {props.ev > 0 ? '+' : ''}{props.ev.toFixed(1)}%
    </span>
  );
}

// In bet badge display, add EV:
<button class="badge badge-lg badge-primary ...">
  {value.name}: {formatOdds(value.odd)}
  <EVBadge ev={value.ev_percentage} />
</button>
```

### 6. Sort by EV

The existing sort by odds can be extended to sort by EV:

```tsx
const [sortBy, setSortBy] = createSignal<"odds" | "ev" | null>(null);

// In sorting logic
if (sortBy() === "ev") {
  return flattened.sort((a, b) => b.value.ev_percentage - a.value.ev_percentage);
}
```

---

## Phase 2 Implementation

### Venue-Aware Probability Estimation

Use the existing `TeamSeasonStats` structure for venue context:

```ard
fn estimate_win_probability_v2(
  home_stats: TeamSeasonStats,
  away_stats: TeamSeasonStats,
  is_home_team: Bool,
  bet_type: Str,
  line: Float
) Float {
  // Use venue-specific stats
  let team = match is_home_team {
    true => home_stats.home_only,   // Home team's home performance
    false => away_stats.away_only   // Away team's away performance
  }
  let opponent = match is_home_team {
    true => away_stats.away_only,   // Opponent's away performance
    false => home_stats.home_only   // Opponent's home performance
  }

  // Matchup-adjusted expected goals
  let expected_goals = (team.xgf + opponent.xga) / 2.0

  // Rest of probability estimation...
}
```

### Form Weighting

Blend recent form with season averages:

```ard
fn blend_stats(season: Snapshot, form: Snapshot, form_weight: Float) Snapshot {
  let season_weight = 1.0 - form_weight
  // Blend key metrics
  Snapshot{
    xgf: (season.xgf * season_weight) + (form.xgf * form_weight),
    xga: (season.xga * season_weight) + (form.xga * form_weight),
    // ... other fields
  }
}

// Usage: 60% form, 40% season
let blended = blend_stats(season_stats.overall, form_stats, 0.6)
```

---

## Phase 3: Model Calibration

### Track Predictions

Store predicted probability with each bet recommendation:

```sql
ALTER TABLE bets ADD COLUMN predicted_prob REAL;
ALTER TABLE bets ADD COLUMN ev_percentage REAL;
```

### Analyze Accuracy

Compare predicted vs actual outcomes:

```sql
-- Calculate calibration: for bets with predicted_prob ~60%, what % actually won?
SELECT
  ROUND(predicted_prob, 1) as prob_bucket,
  COUNT(*) as total_bets,
  SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) as actual_wins,
  ROUND(100.0 * SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) / COUNT(*), 1) as actual_win_rate
FROM bets
WHERE predicted_prob IS NOT NULL AND result IS NOT NULL
GROUP BY prob_bucket
ORDER BY prob_bucket;
```

### Adjust Model

If 60% predictions only win 52% of the time, the model is overconfident and needs adjustment.

## Testing

### Unit Tests for EV Calculation

```ard
// Test 1: Positive odds (+150 = 40% implied)
let ev1 = calculate_ev(0.55, 150)
// Win: 55% × 1.5 = 0.825
// Lose: 45% × 1.0 = 0.45
// EV = 0.825 - 0.45 = 0.375 = +37.5%
assert(ev1.ev_percentage > 35.0)
assert(ev1.edge > 0.15)  // 15% edge

// Test 2: Negative odds (-110 = 52.4% implied)
let ev2 = calculate_ev(0.60, -110)
// Win: 60% × 0.909 = 0.545
// Lose: 40% × 1.0 = 0.40
// EV = 0.545 - 0.40 = 0.145 = +14.5%
assert(ev2.ev_percentage > 12.0)

// Test 3: Negative EV (should filter out)
let ev3 = calculate_ev(0.55, -150)
assert(ev3.ev_percentage < 0)  // Not enough edge for -150 odds

// Test 4: Implied probability conversion
assert(odds_to_implied_probability(150) == 0.40)   // +150 = 40%
assert(odds_to_implied_probability(-150) == 0.60)  // -150 = 60%
assert(odds_to_implied_probability(-110) > 0.52)   // -110 ≈ 52.4%
```

## Success Criteria

### Phase 1
- [ ] `odds_to_implied_probability()` implemented and tested
- [ ] `calculate_ev()` implemented and tested
- [ ] `estimate_win_probability()` implemented (simple version)
- [ ] Juice endpoint returns EV data with each bet
- [ ] UI displays EV percentage with color coding
- [ ] Bets filtered by minimum EV threshold (5%)

### Phase 2
- [ ] Venue-specific stats used (home_only/away_only)
- [ ] Matchup dynamics factored in (attack vs defense)
- [ ] Form weighting implemented (recent vs season)
- [ ] Probability estimates are more accurate

### Phase 3
- [ ] Predicted probability stored with bets
- [ ] Calibration analysis query working
- [ ] Model adjusted based on historical accuracy
- [ ] Over 100 bets, actual ROI approximates average EV

## Example Output

After Phase 1, juice endpoint returns:

```json
{
  "fixture": { "id": 123, "home": {...}, "away": {...} },
  "stats": [
    {
      "id": 16,
      "name": "Home Team Total Goals",
      "values": [
        {
          "name": "Over 1.5",
          "odd": -110,
          "ev_percentage": 12.4,
          "true_win_prob": 0.65,
          "implied_prob": 0.524,
          "edge": 0.126
        }
      ]
    }
  ]
}
```

UI Display:
```
Arsenal Over 1.5 Goals
-110  |  EV: +12.4%  |  65% vs 52% implied
```

## Related Enhancements

- [007: Kelly Criterion](./007-kelly-criterion.md) - Use EV for optimal bet sizing
- [010: Poisson Distribution](../statistics/010-poisson-distribution.md) - More accurate probability estimates (Phase 2/3)
