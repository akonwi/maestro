# Corner Bet Selection Framework

Use this framework to convert local corner projections into bet candidates with controlled risk.

## Objective

- Start from model projections (`expectedHomeCorners`, `expectedAwayCorners`, `expectedTotalCorners`).
- Convert projections into line-level probabilities.
- Compare model probability vs market implied probability.
- Place bets only when edge, EV, confidence, and data quality all pass.

## Inputs

- Projection output: home/away/total expected corners + confidence.
- Odds lines from `cornerOdds` markets.
- Bankroll and current pending exposure from app state.

## Probability Model (Phase 1)

- Home team corners: Poisson(`lambda_home`)
- Away team corners: Poisson(`lambda_away`)
- Total corners: Poisson(`lambda_total = lambda_home + lambda_away`)

For each line:
- `P(over x.5)` = `1 - CDF(x)`
- `P(under x.5)` = `CDF(x)`

Use integer handling for `.0` and push-like outcomes if those lines are offered.

## Market Pricing

American odds -> implied probability:

- For `+a`: `100 / (a + 100)`
- For `-a`: `a / (a + 100)` where `a = abs(odds)`

Edge and value:

- `edge_pp = (model_prob - implied_prob) * 100`
- Decimal payout:
  - `+a`: `1 + (a / 100)`
  - `-a`: `1 + (100 / a)`
- `ev_per_1 = model_prob * (decimal_payout - 1) - (1 - model_prob)`
- `ev_pct = ev_per_1 * 100`

## Selection Policy (Initial Conservative)

Candidate line must satisfy all:

- `model_confidence >= 0.66`
- `edge_pp >= 3.0`
- `ev_pct >= 2.0`
- Data quality checks pass:
  - team history >= `min-history`
  - complete fixture stats where required
  - odds snapshot exists and line parse is valid

Auto-pass conditions:

- conflicting lines in same market with similar EV
- stale odds cache timestamp beyond threshold
- low-sample or high-variance warning flags

## Stake Sizing (Initial)

Use capped fractional Kelly-like sizing:

- `kelly_fraction = max(0, (b*p - q) / b)` where `b = decimal_payout - 1`, `p=model_prob`, `q=1-p`
- `stake_raw = bankroll * 0.25 * kelly_fraction`
- Clamp by guardrails:
  - min stake: `$5`
  - max per bet: `2.0%` bankroll
  - max per fixture total exposure: `3.0%` bankroll

If cap hit, keep bet but annotate with `stake_capped` risk flag.

## Output Contract

Continue using `CornerAnalysisResponse` so UI and save-bet flow remain stable.

For each selected pick include:

- market id/name + line + odds
- implied probability
- estimated probability
- edge points
- confidence
- EV%
- recommended stake
- concise risk flags and no-bet reasons

For rejected lines, include explicit pass reasons.

## Backtesting Protocol

- Strict walk-forward chronology (no leakage).
- Evaluate by league + market + confidence band.
- Metrics:
  - hit rate vs implied break-even
  - realized ROI / net
  - calibration (predicted vs actual)
  - max drawdown

Promotion criteria before live usage:

- Positive ROI on out-of-sample window.
- Better calibration than baseline policy.
- Drawdown within acceptable bankroll tolerance.

## Integration Plan

1. Add `MarketProbabilityEngine` to compute line probabilities from lambdas.
2. Add `OddsDecisionEngine` to compute implied prob, edge, EV, and stake.
3. Populate `picks` and `pass` arrays in local analysis response.
4. Extend Python backtests to simulate policy-level outcomes with stake caps.
5. Tune thresholds per league, starting with Championship (`40`).
