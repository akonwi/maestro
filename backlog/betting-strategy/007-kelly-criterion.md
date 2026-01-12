# 007: Kelly Criterion Position Sizing

**Priority:** Phase 2 - Medium Effort
**Effort:** 2-3 days
**Impact:** High (Bankroll Management)

## Problem Statement

Current system uses fixed $5 bet size with no guidance on optimal stake. This means:
- No consideration of bankroll size
- No adjustment for bet quality (confidence/EV)
- Risk of over-betting on low-confidence bets
- Risk of under-betting on high-confidence bets
- No bankroll growth strategy

**Kelly Criterion** solves this by calculating mathematically optimal bet size based on edge and odds.

## Background: Kelly Criterion Formula

```
Kelly % = (bp - q) / b

Where:
  b = decimal odds - 1 (profit per $1 bet)
  p = true win probability
  q = 1 - p (true loss probability)
```

**Example:**
- Odds: -110 (decimal: 1.909, b = 0.909)
- True win probability: 60% (p = 0.6, q = 0.4)
- Kelly = (0.909 × 0.6 - 0.4) / 0.909 = 16% of bankroll

**Fractional Kelly:** Use 25-50% of Kelly to reduce variance and avoid over-betting.

## Proposed Solution

1. Track user's bankroll in settings
2. Calculate Kelly percentage for each bet using true win probability from [004: Expected Value](./004-expected-value.md)
3. Suggest fractional Kelly stake (25% of full Kelly by default)
4. Display in bet form as suggested amount
5. Allow user to configure Kelly fraction in settings

## Implementation

### 1. Add Bankroll to Settings

**File:** `web/src/routes/settings.tsx`

```tsx
function Settings() {
  const [bankroll, setBankroll] = createSignal(
    Number(localStorage.getItem('bankroll') || 1000)
  );

  const [kellyFraction, setKellyFraction] = createSignal(
    Number(localStorage.getItem('kelly_fraction') || 0.25)
  );

  createEffect(() => {
    localStorage.setItem('bankroll', String(bankroll()));
    localStorage.setItem('kelly_fraction', String(kellyFraction()));
  });

  return (
    <div class="space-y-4">
      <div class="form-control">
        <label class="label">
          <span class="label-text">Bankroll ($)</span>
          <span class="label-text-alt">
            Total funds allocated for betting
          </span>
        </label>
        <input
          type="number"
          class="input input-bordered"
          value={bankroll()}
          onInput={(e) => setBankroll(Number(e.target.value))}
          min="0"
          step="10"
        />
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Kelly Fraction</span>
          <span class="label-text-alt">
            Use {(kellyFraction() * 100).toFixed(0)}% of full Kelly (safer)
          </span>
        </label>
        <input
          type="range"
          class="range"
          value={kellyFraction()}
          onInput={(e) => setKellyFraction(Number(e.target.value))}
          min="0.1"
          max="1.0"
          step="0.05"
        />
        <div class="flex justify-between text-xs px-2 mt-1">
          <span>10% (Very Safe)</span>
          <span>25% (Recommended)</span>
          <span>50% (Moderate)</span>
          <span>100% (Aggressive)</span>
        </div>
      </div>
    </div>
  );
}
```

### 2. Kelly Calculation Function

**File:** `web/src/api/bets.ts` or new `web/src/utils/kelly.ts`

```typescript
export function calculateKellyStake(
  trueWinProbability: number,  // 0-1
  americanOdds: number,
  bankroll: number,
  kellyFraction: number = 0.25
): number {
  // Convert American odds to decimal
  const decimalOdds = americanOdds > 0
    ? (americanOdds / 100) + 1
    : (100 / Math.abs(americanOdds)) + 1;

  const b = decimalOdds - 1;  // Profit per $1
  const p = trueWinProbability;
  const q = 1 - p;

  // Full Kelly percentage
  const kellyPercent = (b * p - q) / b;

  // Apply fraction for safety
  const fractionalKelly = kellyPercent * kellyFraction;

  // Convert to dollar amount
  const suggestedStake = bankroll * fractionalKelly;

  // Bounds checking
  if (suggestedStake < 0) return 0;  // Negative EV, don't bet
  if (suggestedStake > bankroll * 0.1) {
    // Cap at 10% of bankroll (safety check)
    return bankroll * 0.1;
  }

  return Math.max(1, Math.round(suggestedStake * 100) / 100);  // Min $1, round to cents
}
```

### 3. Add to Bet Recommendations

**File:** `api/server/predictions.ard`

Return Kelly suggestion in recommendation:

```ard
// In find_juice() when creating recommendation
let kelly_percent = calculate_kelly_percent(true_win_prob, odds)

bets.push([
  // ... existing fields
  "true_win_prob": true_win_prob,
  "kelly_percent": kelly_percent,  // NEW: Backend calculates, frontend applies to bankroll
])
```

**Backend Kelly calculation:**

```ard
fn calculate_kelly_percent(true_prob: Float, american_odds: Int) Float {
  let decimal_odds = if american_odds > 0 {
    (american_odds / 100.0) + 1.0
  } else {
    (100.0 / american_odds.abs()) + 1.0
  }

  let b = decimal_odds - 1.0
  let p = true_prob
  let q = 1.0 - p

  let kelly = (b * p - q) / b

  // Return as percentage (0.05 = 5% of bankroll)
  if kelly < 0.0 {
    0.0  // Negative EV, don't bet
  } else if kelly > 0.25 {
    0.25  // Cap at 25% for safety
  } else {
    kelly
  }
}
```

### 4. Display in Bet Form

**File:** `web/src/components/bet-form.tsx`

```tsx
const suggestedStake = createMemo(() => {
  if (!props.recommendation) return 5;  // Default

  const bankroll = Number(localStorage.getItem('bankroll') || 1000);
  const kellyFraction = Number(localStorage.getItem('kelly_fraction') || 0.25);

  return calculateKellyStake(
    props.recommendation.true_win_prob / 100,  // Convert % to decimal
    props.recommendation.odds,
    bankroll,
    kellyFraction
  );
});

// In UI
<div class="form-control">
  <label class="label">
    <span class="label-text">Amount ($)</span>
    <span class="label-text-alt text-info">
      Kelly Suggested: ${suggestedStake().toFixed(2)}
      ({((suggestedStake() / bankroll()) * 100).toFixed(1)}% of bankroll)
    </span>
  </label>
  // ... input field
</div>
```

## Testing

### Unit Tests

```typescript
describe('Kelly Calculation', () => {
  it('calculates correct stake for positive EV bet', () => {
    // -110 odds, 60% win probability, $1000 bankroll, 25% Kelly
    const stake = calculateKellyStake(0.60, -110, 1000, 0.25);

    // Full Kelly: (0.909 * 0.6 - 0.4) / 0.909 = 0.16 (16%)
    // Fractional: 0.16 * 0.25 = 0.04 (4%)
    // Stake: $1000 * 0.04 = $40
    expect(stake).toBeCloseTo(40, 0);
  });

  it('returns 0 for negative EV', () => {
    // -110 odds, 48% win probability (negative EV)
    const stake = calculateKellyStake(0.48, -110, 1000, 0.25);
    expect(stake).toBe(0);
  });

  it('caps at 10% of bankroll', () => {
    // Very high EV scenario
    const stake = calculateKellyStake(0.90, 100, 1000, 1.0);
    expect(stake).toBeLessThanOrEqual(100);  // Max 10% of $1000
  });
});
```

### Integration Test

1. Set bankroll to $1000
2. Set Kelly fraction to 0.25
3. Open bet with:
   - True win prob: 60%
   - Odds: -110
   - Expected suggested stake: ~$40
4. Adjust Kelly fraction to 0.5
5. Verify suggested stake doubles to ~$80

## Success Criteria

- [ ] Bankroll setting added to settings page
- [ ] Kelly fraction slider works correctly
- [ ] Kelly calculation accurate (matches manual calculation)
- [ ] Suggested stake displayed in bet form
- [ ] Stake adjusts when bankroll or Kelly fraction changes
- [ ] Safety caps prevent over-betting (max 10% per bet)
- [ ] Negative EV bets show $0 suggested stake

## Example Output

**Settings:**
- Bankroll: $1,000
- Kelly Fraction: 25% (Recommended)

**Bet Recommendation:**
```
Arsenal Over 1.5 Goals (-110)
Confidence: 85% | EV: +12.4% | True Win: 65%

Suggested Stake: $42.50 (4.25% of bankroll)
[Quick: 1x ($42.50) | 2x ($85) | 3x ($127.50)]

Potential Payout: $81.13
Profit if wins: +$38.63
```

## Related Enhancements

- [003: Confidence Scoring](./003-confidence-scoring.md) - Higher confidence increases Kelly stake
- [004: Expected Value](./004-expected-value.md) - Provides true win probability
