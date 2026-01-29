# 008: Corner Confidence + ROI Impact Preview

**Priority:** Phase 1 - Quick Win
**Effort:** 1-2 days
**Impact:** Medium-High

## Goal

Add two independent advisory signals for corner bets:
1. **Derived confidence** based on corner analysis signals (no manual input).
2. **ROI impact preview** showing how cumulative ROI would change if the bet loses.

## Requirements

### Confidence (Derived)
- Use only corner analysis signals:
  - Corners won per game
  - Form vs season delta
  - Edge vs line (already computed in odds view)
- Show confidence in two places:
  - Odds line list (at-a-glance)
  - Bet form (with brief reasoning)

### ROI Impact Preview
- Use cumulative ROI from existing betting overview.
- Show a what-if ROI if the new bet loses.
- No gating or thresholds; informational only.

## Proposed Logic

### Confidence Inputs
- Edge vs line from `web/src/components/matchup/odds-card.tsx`.
- Corners won per game for form + season from `teamMetricsQueryOptions`.
- Corner projection total (already derived in matchup page).

### Confidence Score (example)
- `edgeScore = clamp(edge / 2, -1, 1)`
- `formDeltaScore = clamp((formForTotal - seasonForTotal) / max(1, seasonForTotal), -0.5, 0.5)`
- `strengthScore = clamp(projectionTotal / 10, 0, 1)`
- `confidenceScore = 0.5*edgeScore + 0.3*formDeltaScore + 0.2*strengthScore`
- Map to tier 1-5 (thresholds to be tuned with real data).

### ROI Impact Preview
- Inputs from `/bets/overview`:
  - `total_wagered`
  - `net_profit`
  - `roi`
- If the bet loses:
  - `next_total = total_wagered + amount`
  - `next_profit = net_profit - amount`
  - `next_roi = (next_profit / next_total) * 100`
- Display: "If this bet loses, ROI -> X% (from Y%)"

## Implementation Notes

### Data Plumbing
- `web/src/routes/matchup/[id].tsx`
  - Add parallel queries for form + season team metrics (corner-specific).
  - Pass compact confidence inputs to `OddsCard`.

- `web/src/components/matchup/odds-card.tsx`
  - Calculate confidence per line.
  - Display confidence badge next to edge badge.
  - Pass confidence tier/score and reason into bet form initial data.

- `web/src/components/bet-form.tsx`
  - Render confidence summary and reasoning.
  - Add ROI impact preview using `betOverviewQueryOptions()`.

## UI Placement
- Odds line button: small badge with confidence tier (1-5).
- Bet form: advisory block with confidence + ROI impact preview.

## Open Questions
- Final thresholds for confidence tier mapping after first pass.
- Confirm naming for confidence labels (e.g., "Low/Medium/High").

## Success Criteria
- Confidence appears on odds lines and in bet form.
- ROI impact preview updates live with bet amount.
- No backend changes required.
