# 003: Confidence Scoring System

**Priority:** Phase 1 - Quick Win
**Effort:** 1-2 days
**Impact:** High

## Problem Statement

All bet recommendations are currently treated equally - no way to prioritize high-probability bets over marginal ones. Users can't distinguish between:
- Strong recommendations (all metrics align, large sample, consistent form)
- Weak recommendations (barely meets threshold, inconsistent form)

This leads to:
- Equal stake sizes on unequal opportunities
- Difficulty prioritizing which bets to place
- No transparency about recommendation quality

## Proposed Solution

Assign each bet recommendation a confidence score (0-100%) based on:
1. **Metrics Alignment** (0-30 points): How strongly do stats support the bet?
2. **Sample Size** (0-20 points): Enough games for statistical validity?
3. **Recent Form Consistency** (0-20 points): Is team on a streak?
4. **Odds Value** (0-30 points): How favorable are the odds?

Display confidence as stars (⭐⭐⭐⭐⭐) or percentage, filter by minimum confidence.

## Implementation

### 1. Confidence Calculation Function

**File:** `api/server/predictions.ard`

```ard
fn calculate_confidence(
  team: TeamSnapshot,
  opponent: TeamSnapshot,
  bet_type: Str,
  odds: Int
) Int {
  mut score = 0

  // 1. Metrics Alignment (0-30 points)
  score += calculate_metrics_score(team, opponent, bet_type)

  // 2. Sample Size (0-20 points)
  score += calculate_sample_score(team.num_games)

  // 3. Recent Form Consistency (0-20 points)
  score += calculate_form_score(team.current_streak, team.last_5_record)

  // 4. Odds Value (0-30 points)
  score += calculate_odds_score(odds)

  score
}

fn calculate_metrics_score(team: TeamSnapshot, opponent: TeamSnapshot, bet_type: Str) Int {
  // For "Over 1.5 goals" bet
  if bet_type.contains("Over") {
    let weighted_xgf = (team.last_5_xgf * 0.7) + (team.xgf * 0.3)
    let opponent_xga = (opponent.last_5_xga * 0.7) + (opponent.xga * 0.3)

    // Strong alignment: team offense >> opponent defense
    if weighted_xgf > opponent_xga + 0.8 {
      return 30  // Excellent
    } else if weighted_xgf > opponent_xga + 0.5 {
      return 22  // Good
    } else if weighted_xgf > opponent_xga + 0.3 {
      return 15  // Moderate
    } else {
      return 8   // Weak
    }
  }

  // Similar logic for other bet types...
  0
}

fn calculate_sample_score(num_games: Int) Int {
  match num_games {
    n if n >= 15 => 20,  // Full season, reliable
    n if n >= 10 => 15,  // Good sample
    n if n >= 7 => 10,   // Minimum acceptable
    _ => 5               // Small sample, risky
  }
}

fn calculate_form_score(streak: Int, record: Str) Int {
  // Positive streak (winning)
  if streak >= 4 {
    return 20  // Excellent momentum
  } else if streak >= 3 {
    return 15  // Good momentum
  } else if streak >= 2 {
    return 10  // Moderate
  }

  // Negative streak (losing)
  if streak <= -3 {
    return 0   // Fade this bet
  }

  // Parse record for win rate
  let parts = record.split("-")
  let wins = parts.at(0).to_int()

  match wins {
    4, 5 => 18,  // 80-100% win rate
    3 => 12,     // 60% win rate
    2 => 7,      // 40% win rate
    _ => 3       // 0-20% win rate
  }
}

fn calculate_odds_score(odds: Int) Int {
  // Better odds (closer to even or plus money) = higher score
  // Odds format: -110, +150, etc.

  if odds >= 0 {
    // Plus money (+150, +200) = great value
    return 30
  } else if odds >= -110 {
    // Near even (-110) = good value
    return 25
  } else if odds >= -130 {
    // Slightly negative (-120, -130) = okay value
    return 18
  } else if odds >= -150 {
    // More negative (-140, -150) = less value
    return 10
  } else {
    // Very negative (-160+) = poor value
    return 5
  }
}
```

### 2. Add to Bet Recommendations

**File:** `api/server/predictions.ard` - `find_juice()` function

```ard
// When creating bet recommendation
let confidence = calculate_confidence(home_team, away_team, "Over 1.5", odds)

// Only return bets with minimum confidence
if confidence >= 50 {
  bets.push([
    "match_id": fixture.id,
    "description": "{team.name} Over 1.5 Goals",
    "odds": odds,
    "line": 1.5,
    "confidence": confidence,  // NEW
    "confidence_stars": confidence / 20,  // 0-100 -> 0-5 stars
    ...
  ])
}
```

### 3. Frontend Display

**File:** `web/src/routes/index.tsx`

Add confidence to bet cards:

```tsx
interface BetRecommendation {
  // ... existing
  confidence: number;
  confidence_stars: number;
}

function ConfidenceStars({ stars }: { stars: number }) {
  return (
    <div class="flex items-center gap-1" title={`${stars * 20}% confidence`}>
      <span class="text-yellow-500">
        {"⭐".repeat(Math.round(stars))}
        {"☆".repeat(5 - Math.round(stars))}
      </span>
      <span class="text-xs text-base-content/60">
        ({(stars * 20).toFixed(0)}%)
      </span>
    </div>
  );
}

// In bet card display
<div class="card">
  <div class="card-body">
    <h3>{bet.description}</h3>
    <ConfidenceStars stars={bet.confidence_stars} />
    <div class="badge">{bet.odds > 0 ? '+' : ''}{bet.odds}</div>
  </div>
</div>
```

### 4. Filtering by Confidence

Add filter dropdown:

```tsx
<select
  class="select select-sm"
  value={minConfidence()}
  onChange={e => setMinConfidence(Number(e.target.value))}
>
  <option value={0}>All Confidence</option>
  <option value={80}>⭐⭐⭐⭐⭐ Only (80%+)</option>
  <option value={60}>⭐⭐⭐⭐+ (60%+)</option>
  <option value={40}>⭐⭐⭐+ (40%+)</option>
</select>

// Filter bets
const filteredBets = createMemo(() =>
  bets().filter(bet => bet.confidence >= minConfidence())
);
```

## Testing

### Unit Tests
Test confidence calculation with various scenarios:

```ard
// Scenario 1: Perfect bet
team = TeamSnapshot{
  xgf: 2.0, last_5_xgf: 2.5,
  num_games: 20,
  current_streak: 4,
  last_5_record: "4-1-0"
}
opponent = TeamSnapshot{ xga: 1.5, last_5_xga: 2.0 }
odds = -110

confidence = calculate_confidence(team, opponent, "Over 1.5", odds)
assert(confidence >= 85)  // Should be very high

// Scenario 2: Marginal bet
team = TeamSnapshot{
  xgf: 1.5, last_5_xgf: 1.6,
  num_games: 8,
  current_streak: 1,
  last_5_record: "2-2-1"
}
opponent = TeamSnapshot{ xga: 1.4, last_5_xga: 1.5 }
odds = -140

confidence = calculate_confidence(team, opponent, "Over 1.5", odds)
assert(confidence < 60)  // Should be moderate/low
```

### Integration Tests
1. Generate recommendations, verify all have confidence scores
2. Filter by confidence, verify correct bets shown
3. Sort by confidence, verify descending order

### Validation
1. Manually review high confidence bets (80%+) - should "feel" strong
2. Manually review low confidence bets (40-50%) - should be marginal
3. Track actual results: do high confidence bets win more often?

## Success Criteria

- [ ] Confidence calculation implemented and tested
- [ ] All bet recommendations include confidence score
- [ ] UI displays confidence as stars and percentage
- [ ] Filtering by minimum confidence works
- [ ] Sorting by confidence works
- [ ] High confidence bets (80%+) have better win rate than low confidence (40-60%)

## Example Output

```
Value Bets for Today:

1. Arsenal Over 1.5 Goals (-110)
   ⭐⭐⭐⭐⭐ 88% Confidence
   Recent xGF: 2.5 | Opponent xGA: 1.8 | 4-game win streak

2. Chelsea Clean Sheet No (-105)
   ⭐⭐⭐⭐ 76% Confidence
   Recent xGA: 1.6 | Opponent xGF: 1.9 | Mixed form

3. Liverpool Over 2.5 Goals (+105)
   ⭐⭐⭐ 64% Confidence
   Recent xGF: 2.2 | Opponent xGA: 1.5 | Small sample (8 games)
```

## Related Enhancements

- [001: Recent Form Weighting](./001-recent-form-weighting.md) - Confidence uses weighted metrics
- [004: Expected Value](./004-expected-value.md) - Combine confidence with EV
- [007: Kelly Criterion](./007-kelly-criterion.md) - Use confidence for stake sizing
