# 006: Enhanced Bet Form with Real-Time Calculations

**Priority:** Phase 1 - Quick Win
**Effort:** 1 day
**Impact:** Medium

## Problem Statement

Current bet form (`web/src/components/bet-form.tsx`) has several UX issues:
- No real-time payout calculation - users can't see potential profit
- Default $5 amount with no explanation
- No validation feedback until submit button clicked
- Doesn't show confidence or EV from backend recommendation
- No suggested stake based on Kelly Criterion or confidence

Users can't make informed decisions about bet sizing without calculating payouts manually.

## Proposed Solution

Enhance bet form to provide real-time feedback and decision support:
1. **Live payout calculator** - Shows payout and profit as user types amount
2. **Display recommendation context** - Show confidence, EV, key metrics
3. **Suggested stake** - Based on Kelly Criterion and confidence
4. **Inline validation** - Real-time feedback on inputs
5. **Quick stake buttons** - 1x, 2x, 3x suggested amount

## Implementation

### 1. Add Real-Time Payout Calculation

**File:** `web/src/components/bet-form.tsx`

```tsx
import { createMemo, createSignal } from 'solid-js';

function BetForm(props: BetFormProps) {
  const [amount, setAmount] = createSignal(props.suggestedStake || 5);
  const [odds, setOdds] = createSignal(props.initialData?.odds || 0);

  // Calculate payout in real-time
  const payout = createMemo(() => {
    const amt = amount();
    const oddsVal = odds();

    if (oddsVal === 0) return 0;

    if (oddsVal > 0) {
      // Positive odds: +150 means bet $100 to win $150
      return amt + (amt * (oddsVal / 100));
    } else {
      // Negative odds: -150 means bet $150 to win $100
      return amt + (amt * (100 / Math.abs(oddsVal)));
    }
  });

  const profit = createMemo(() => payout() - amount());

  return (
    <div class="modal-box">
      <h3 class="font-bold text-lg">Place Bet</h3>

      {/* Show recommendation context */}
      <Show when={props.recommendation}>
        <div class="alert alert-info mt-4">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span>Confidence:</span>
              <ConfidenceStars stars={props.recommendation.confidence_stars} />
              <span class="text-sm">({props.recommendation.confidence}%)</span>
            </div>
            <div>
              EV: <span class={props.recommendation.ev_percentage > 0 ? "text-success" : "text-error"}>
                {props.recommendation.ev_percentage > 0 ? '+' : ''}
                {props.recommendation.ev_percentage.toFixed(1)}%
              </span>
            </div>
            <div class="text-xs">
              Recent xG: {props.recommendation.recent_metric.toFixed(2)} |
              Weighted: {props.recommendation.weighted_metric.toFixed(2)}
            </div>
          </div>
        </div>
      </Show>

      {/* Form fields */}
      <div class="form-control mt-4">
        <label class="label">
          <span class="label-text">Description</span>
        </label>
        <input
          type="text"
          class="input input-bordered"
          value={description()}
          onInput={(e) => setDescription(e.target.value)}
        />
        <Show when={description().trim() === ''}>
          <label class="label">
            <span class="label-text-alt text-error">Description is required</span>
          </label>
        </Show>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Odds (American)</span>
        </label>
        <input
          type="number"
          class="input input-bordered"
          value={odds()}
          onInput={(e) => setOdds(Number(e.target.value))}
        />
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Amount ($)</span>
          <Show when={props.suggestedStake}>
            <span class="label-text-alt">
              Suggested: ${props.suggestedStake.toFixed(2)}
            </span>
          </Show>
        </label>

        {/* Quick stake buttons */}
        <Show when={props.suggestedStake}>
          <div class="join mb-2">
            <button
              class="btn btn-sm join-item"
              onClick={() => setAmount(props.suggestedStake!)}
            >
              1x
            </button>
            <button
              class="btn btn-sm join-item"
              onClick={() => setAmount(props.suggestedStake! * 2)}
            >
              2x
            </button>
            <button
              class="btn btn-sm join-item"
              onClick={() => setAmount(props.suggestedStake! * 3)}
            >
              3x
            </button>
          </div>
        </Show>

        <input
          type="number"
          class="input input-bordered"
          value={amount()}
          onInput={(e) => setAmount(Number(e.target.value))}
          step="0.01"
          min="0.01"
        />

        <Show when={amount() <= 0}>
          <label class="label">
            <span class="label-text-alt text-error">Amount must be positive</span>
          </label>
        </Show>
      </div>

      {/* Real-time payout display */}
      <div class="alert alert-success mt-4">
        <div class="flex flex-col">
          <div class="text-lg font-bold">
            Potential Payout: ${payout().toFixed(2)}
          </div>
          <div class="text-sm">
            Profit if wins: <span class="text-success font-semibold">
              +${profit().toFixed(2)}
            </span>
          </div>
          <div class="text-xs opacity-70">
            Risk: ${amount().toFixed(2)}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div class="modal-action">
        <button class="btn" onClick={props.onClose}>Cancel</button>
        <button
          class="btn btn-primary"
          onClick={handleSubmit}
          disabled={!isValid()}
        >
          Place Bet
        </button>
      </div>
    </div>
  );
}
```

### 2. Pass Recommendation Data from Parent

**File:** `web/src/routes/index.tsx`

Update bet form context to include recommendation:

```tsx
function openBetForm(bet: BetRecommendation) {
  setBetFormState({
    matchId: bet.match_id,
    initialData: {
      description: bet.description,
      odds: bet.odds,
      line: bet.line,
    },
    recommendation: bet,  // NEW: Pass full recommendation
    suggestedStake: calculateSuggestedStake(bet),  // NEW
  });
}

function calculateSuggestedStake(bet: BetRecommendation): number {
  // Simple version: scale by confidence
  const baseStake = 10; // User's default unit size
  const confidenceMultiplier = bet.confidence / 100;

  return baseStake * confidenceMultiplier;
}
```

### 3. Keyboard Shortcuts

Add keyboard support for better UX:

```tsx
// In BetForm component
onMount(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && isValid()) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      props.onClose();
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  onCleanup(() => window.removeEventListener('keydown', handleKeyPress));
});
```

## Testing

### Manual Testing Checklist

- [ ] Open bet form, verify payout updates as amount changes
- [ ] Enter positive odds (+150), verify payout calculated correctly
- [ ] Enter negative odds (-150), verify payout calculated correctly
- [ ] Try amount $0 or negative, verify error shown
- [ ] Try empty description, verify error shown
- [ ] Click quick stake buttons (1x, 2x, 3x), verify amount updates
- [ ] Press Enter to submit, verify works
- [ ] Press Escape to cancel, verify closes
- [ ] Verify confidence and EV displayed from recommendation

### Unit Tests

```typescript
describe('Payout Calculation', () => {
  it('calculates payout for positive odds', () => {
    // +150 odds, $10 bet
    const payout = calculatePayout(10, 150);
    expect(payout).toBe(25); // $10 stake + $15 profit
  });

  it('calculates payout for negative odds', () => {
    // -150 odds, $15 bet
    const payout = calculatePayout(15, -150);
    expect(payout).toBe(25); // $15 stake + $10 profit
  });

  it('handles even odds correctly', () => {
    // +100 odds, $10 bet
    const payout = calculatePayout(10, 100);
    expect(payout).toBe(20); // $10 stake + $10 profit
  });
});
```

## Success Criteria

- [ ] Payout calculation updates in real-time as user types
- [ ] Confidence and EV displayed prominently
- [ ] Suggested stake shown and quick buttons work
- [ ] Inline validation provides immediate feedback
- [ ] Keyboard shortcuts (Enter/Escape) work
- [ ] Form is intuitive and requires minimal mental math

## Related Enhancements

- [003: Confidence Scoring](../betting-strategy/003-confidence-scoring.md) - Provides confidence data
- [004: Expected Value](../betting-strategy/004-expected-value.md) - Provides EV data
- [007: Kelly Criterion](../betting-strategy/007-kelly-criterion.md) - Calculates suggested stake
