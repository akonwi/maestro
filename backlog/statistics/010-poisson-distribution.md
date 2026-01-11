# 010: Poisson Distribution Goal Prediction Model

**Priority:** Phase 2 - Medium Effort
**Effort:** 3-5 days
**Impact:** High (Prediction Accuracy)

## Problem Statement

Current probability estimation uses simple thresholds:
- "If xGF > 1.5, then probably Over 1.5" → Binary, imprecise
- No probability distribution for exact scores
- Can't calculate probabilities for specific goal totals
- Doesn't account for natural variance in soccer scoring

**Poisson distribution** is the standard statistical model for rare events (like goals) and provides:
- Probability of exactly 0, 1, 2, 3+ goals
- More accurate over/under probabilities
- Correct score predictions
- Better expected value calculations

## Background: Poisson Distribution

The Poisson distribution models the probability of K events occurring:

```
P(X = k) = (λ^k × e^-λ) / k!

Where:
  λ = expected number of events (xG)
  k = number of occurrences (goals)
  e = Euler's number (2.71828...)
```

**Example:** Team has λ = 1.5 xG
- P(0 goals) = (1.5^0 × e^-1.5) / 0! = 0.223 (22.3%)
- P(1 goal) = (1.5^1 × e^-1.5) / 1! = 0.335 (33.5%)
- P(2 goals) = (1.5^2 × e^-1.5) / 2! = 0.251 (25.1%)
- P(3+ goals) = 1 - (P(0) + P(1) + P(2)) = 0.191 (19.1%)

## Proposed Solution

Implement Poisson model for goal predictions:
1. Calculate λ (expected goals) using weighted xGF/xGA
2. Use Poisson distribution to get probabilities for 0, 1, 2, 3+ goals
3. Sum probabilities for over/under lines
4. Use for more accurate win probability and EV calculations
5. Optionally display correct score probabilities in UI

## Implementation

### 1. Poisson Calculation Functions

**File:** `api/server/poisson.ard` (new module)

```ard
use ard/math

fn factorial(n: Int) Int {
  if n <= 1 {
    1
  } else {
    n * factorial(n - 1)
  }
}

fn poisson_probability(lambda: Float, k: Int) Float {
  // P(X = k) = (λ^k × e^-λ) / k!
  let numerator = math::pow(lambda, k) * math::exp(-lambda)
  let denominator = factorial(k)

  numerator / denominator
}

fn poisson_cumulative(lambda: Float, k: Int) Float {
  // P(X <= k) = sum of P(X = 0) to P(X = k)
  mut cumulative = 0.0

  for i in 0..=k {
    cumulative += poisson_probability(lambda, i)
  }

  cumulative
}

fn poisson_over(lambda: Float, line: Float) Float {
  // P(X > line) = 1 - P(X <= line)
  let k = line.floor()
  1.0 - poisson_cumulative(lambda, k)
}

fn poisson_under(lambda: Float, line: Float) Float {
  // P(X < line) = P(X <= line - 1)
  let k = (line - 1.0).floor()
  poisson_cumulative(lambda, k)
}
```

### 2. Expected Goals Calculation

```ard
fn calculate_expected_goals(
  team: TeamSnapshot,
  opponent: TeamSnapshot,
  is_home: Bool
) Float {
  // Use weighted metrics (70% recent, 30% season)
  let team_xgf = (team.last_5_xgf * 0.7) + (team.xgf * 0.3)
  let opp_xga = (opponent.last_5_xga * 0.7) + (opponent.xga * 0.3)

  // Adjust for home/away if available
  let adjusted_xgf = if is_home and team.home_xgf > 0.0 {
    (team_xgf + team.home_xgf) / 2.0  // Blend overall with home-specific
  } else if !is_home and team.away_xgf > 0.0 {
    (team_xgf + team.away_xgf) / 2.0  // Blend overall with away-specific
  } else {
    team_xgf
  }

  // Average attack and defense to get expected goals (lambda)
  (adjusted_xgf + opp_xga) / 2.0
}
```

### 3. Updated Win Probability Estimation

**File:** `api/server/predictions.ard` - Update `estimate_win_probability()`

```ard
use maestro/poisson

fn estimate_win_probability_poisson(
  team: TeamSnapshot,
  opponent: TeamSnapshot,
  bet_type: Str,
  line: Float,
  is_home: Bool
) Float {
  let lambda = poisson::calculate_expected_goals(team, opponent, is_home)

  match bet_type {
    "Over Goals" => {
      poisson::poisson_over(lambda, line)
    },

    "Under Goals" => {
      poisson::poisson_under(lambda, line)
    },

    "Clean Sheet No" => {
      // P(opponent scores) = 1 - P(0 goals)
      let opp_lambda = poisson::calculate_expected_goals(opponent, team, !is_home)
      1.0 - poisson::poisson_probability(opp_lambda, 0)
    },

    "Clean Sheet Yes" => {
      // P(opponent scores 0)
      let opp_lambda = poisson::calculate_expected_goals(opponent, team, !is_home)
      poisson::poisson_probability(opp_lambda, 0)
    },

    _ => 0.50
  }
}
```

### 4. Correct Score Probabilities (Optional)

```ard
fn calculate_correct_scores(
  home_team: TeamSnapshot,
  away_team: TeamSnapshot
) [[Int, Int, Float]] {
  let home_lambda = poisson::calculate_expected_goals(home_team, away_team, true)
  let away_lambda = poisson::calculate_expected_goals(away_team, home_team, false)

  mut scores: [[Int, Int, Float]] = []

  // Calculate probabilities for scorelines 0-0 to 5-5
  for home_goals in 0..=5 {
    for away_goals in 0..=5 {
      let home_prob = poisson::poisson_probability(home_lambda, home_goals)
      let away_prob = poisson::poisson_probability(away_lambda, away_goals)

      // Independent events, multiply probabilities
      let score_prob = home_prob * away_prob

      scores.push([home_goals, away_goals, score_prob])
    }
  }

  // Sort by probability (descending)
  scores.sort_by(|a, b| b.at(2).compare(a.at(2)))

  scores
}
```

### 5. Frontend Display (Optional)

**File:** `web/src/components/matchup/score-predictions.tsx`

```tsx
export function ScorePredictions(props: {
  homeTeam: string;
  awayTeam: string;
  predictions: Array<[number, number, number]>;  // [home, away, probability]
}) {
  const topScores = () => props.predictions.slice(0, 10);  // Top 10 most likely

  return (
    <div>
      <h4 class="font-semibold mb-2">Most Likely Scores</h4>
      <div class="grid grid-cols-2 gap-2">
        <For each={topScores()}>
          {([home, away, prob]) => (
            <div class="flex justify-between items-center p-2 bg-base-200 rounded">
              <span class="font-mono">
                {home}-{away}
              </span>
              <span class="text-sm text-base-content/60">
                {(prob * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
```

## Testing

### Unit Tests

```ard
// Test factorial
assert(factorial(0) == 1)
assert(factorial(5) == 120)

// Test Poisson probability
let prob = poisson_probability(1.5, 0)
assert(prob > 0.22 and prob < 0.23)  // Should be ~22.3%

let prob_1 = poisson_probability(1.5, 1)
assert(prob_1 > 0.33 and prob_1 < 0.34)  // Should be ~33.5%

// Test over probability
let over_1_5 = poisson_over(1.8, 1.5)
// P(X > 1.5) = P(X >= 2) = 1 - P(X <= 1)
// With λ=1.8: should be ~0.537 (53.7%)
assert(over_1_5 > 0.52 and over_1_5 < 0.55)
```

### Comparison with Simple Model

Backtest on 100 matches:
- **Simple model**: "xGF > 1.5 → Over 1.5" (binary)
- **Poisson model**: Calculate actual probability

Measure:
- Calibration: Do 70% probability bets win ~70% of the time?
- Log loss: Measure prediction accuracy
- ROI: Does Poisson model produce better EV?

## Success Criteria

- [ ] Poisson functions implemented and tested
- [ ] Integration with existing prediction logic
- [ ] Probabilities more accurate than simple thresholds
- [ ] Calibration curve shows good alignment (predicted vs actual)
- [ ] Improved ROI on recommendations
- [ ] Optional: Correct score predictions displayed in UI

## Example Output

**Arsenal vs Chelsea**

**Expected Goals (λ):**
- Arsenal: 1.85
- Chelsea: 1.32

**Over/Under Probabilities:**
- Over 0.5 Total: 94.7%
- Over 1.5 Total: 75.2%
- Over 2.5 Total: 49.8%
- Over 3.5 Total: 25.4%

**Most Likely Scores:**
1. 2-1 Arsenal (12.3%)
2. 1-1 Draw (11.8%)
3. 2-0 Arsenal (9.5%)
4. 1-0 Arsenal (8.7%)
5. 2-2 Draw (7.2%)

**Recommendation:**
- Arsenal Over 1.5 Goals: 63.2% probability
- Odds: -110 (52.4% implied)
- EV: +10.8% ✅

## Related Enhancements

- [001: Recent Form Weighting](../betting-strategy/001-recent-form-weighting.md) - Provides weighted xG for λ
- [004: Expected Value](../betting-strategy/004-expected-value.md) - Uses Poisson probabilities for better EV
- [009: Matchup Visualization](../ux/009-matchup-visualization.md) - Display score predictions
