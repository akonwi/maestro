# Local Corner Analysis Plan

## Goal

Replace LLM corner analysis with deterministic, local statistical modeling in the desktop app.

Primary objectives:
- Generate robust corner performance projections (home, away, total) directly from local DB data.
- Keep existing analysis UX while deprioritizing market/odds recommendations.
- Improve repeatability, auditability, and backtestability.

## Current Baseline

- Fixture and team stats are stored in SQLite (`fixtures`, `fixture_stats`, `teams`).
- Odds snapshots are stored in `odds_cache`.
- Analysis output is cached in `analysis_cache`.
- UI currently expects `CornerAnalysisResponse`.

The new local model should continue returning `CornerAnalysisResponse` so UI changes stay minimal.

## Data Quality Rule (Required)

If analysis is requested and the target fixture is finished but missing complete stats:
- Automatically import the missing fixture stats via existing sync foundations.
- Show in-UI status text such as: `Importing fixture stats...`.
- Re-run analysis automatically after sync completes.
- If sync fails, show a clear error and keep retry available.

"Complete stats" means two `fixture_stats` rows exist for the fixture (home + away teams).

## Modeling Approach (Phase 1)

Use a deterministic Poisson framework for corners:

1. Estimate expected home corners (`lambda_home`)
2. Estimate expected away corners (`lambda_away`)
3. Total expectation: `lambda_total = lambda_home + lambda_away`

Feature inputs:
- Team corners-for baseline (season and recent form blend)
- Opponent corners-against baseline
- Venue split (home/away)
- Optional pace modifiers (shots, xG, possession)

Stabilization:
- Shrink recent form toward season baseline when sample size is small.
- Enforce minimum sample gates and downgrade confidence when data is thin.

## Output Scope (Phase 1)

Focus only on performance prediction, not odds evaluation.

Primary outputs:
- Expected home corners
- Expected away corners
- Expected total corners
- Model confidence and data quality notes

Deferred outputs (later phase):
- Implied probability vs estimated probability
- Edge and EV calculations
- Market-by-market picks/pass decisions

## Architecture Changes

Planned additions:
- `CornerModelService` (local analysis engine)
- `CornerFeatureBuilder` (DB-derived modeling features)
- `MarketProbabilityEngine` (line probability + EV calculations)
- `AnalysisQualityGate` (sample-size and reliability scoring)

Integration points:
- `FixtureDetailView.runAnalysis()` calls local model path.
- Keep `analysis_cache` behavior unchanged.
- Keep bet note fields for downstream reporting (`Prompt/Model Version`, edge, implied, estimated, EV, confidence).

## Versioning and Traceability

Add local model versioning (example: `corner-local-v1.0`).

Each saved analysis artifact should include version metadata so model performance can be segmented over time.

## League-Specific Models

- The model supports league-specific parameter overrides on top of global defaults.
- Initial rollout starts with English Championship (`league_id = 40`).
- Championship override is tuned from historical walk-forward backtests and applied in both app and scripts.
- Tune command for a specific league:

```bash
python3 scripts/corner_projection_tune.py --league-id 40 --out ./reports/championship-tune-latest.json
```

## Backtesting and Evaluation

Add a Python backtest script in `desktop/scripts/` with strict chronological evaluation:
- Train/fit only on data available before each fixture kickoff (no leakage).
- Evaluate calibration (Brier/log loss where applicable) and prediction accuracy (MAE for home, away, total corners).

Outputs:
- Human-readable report
- JSON snapshot for weekly tracking and version comparisons

## Phased Delivery

1. Implement local model service and wire into UI analysis flow.
2. Implement auto-import for finished fixtures missing stats and auto-retry analysis.
3. Keep cache and save-bet workflow intact with model-version metadata.
4. Add offline backtest/report script and baseline metrics.
5. Tune weights and confidence calibration using observed predictive performance.

## Acceptance Criteria

- Analysis can run without OpenAI key.
- Finished fixture with missing stats triggers auto-import and analysis retry.
- Analysis response renders in existing card without regressions.
- Projection outputs are deterministic for same input.
- Model version appears in saved analysis metadata.
- Backtest script runs against local DB and exports JSON/text reports.
