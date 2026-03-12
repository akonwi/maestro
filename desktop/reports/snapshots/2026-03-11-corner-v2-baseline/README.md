# Corner Model Snapshot (v2 Baseline) — 2026-03-11

This snapshot freezes the current corner model baseline as **v2** before v3 changes.

## Snapshot identity

- Baseline label: `corner-v2`
- Underlying local projection model label in code/backtests: `corner-local-v1.0`
- Current app prompt version constant: `corner-v2.0`
- Next working version: `corner-v3`
- Snapshot date: `2026-03-11`
- Source database: `~/Library/Application Support/com.akonwi.maestro/maestro.sqlite`

## Included artifacts

- `corner-backtest-latest.json` — full chronological projection backtest summary
- `championship-team-corners-latest.json` — Championship team-level error analysis
- `corner-market-report-latest.json` — corner-only betting performance report
- `corner-market-report-latest.txt` — text summary of corner-only betting performance
- `local_corner_model.py` — Python model definition used by backtest tooling
- `LocalCornerProjectionService.swift` — app-side local projection implementation
- `corner-analysis.md` — current corner analysis prompt file for reference

## Baseline summary

### Projection accuracy
- Eligible fixtures: `1262 / 2594` (`48.7%` coverage)
- Total corners: `MAE 2.583`, `RMSE 3.246`, `Bias +0.025`
- Improvement vs baseline MAE (total): `+0.5%`
- Home bias: `-0.485`
- Away bias: `+0.509`

### Championship team-level check
- Base team-corners MAE: `2.095`
- Online residual-adjusted MAE: `2.108`
- Current residual adjustment does **not** improve aggregate accuracy

### Corner market performance
- Filter used: bets tagged `corner-local-v1.0`
- Bets: `62`
- Win rate: `43.5%`
- Net: `-$13.69`
- ROI: `-11.4%`
- Implied break-even: `50.9%`

### Main takeaways
- The projection model is slightly better than baseline overall, but only marginally on total corners.
- Current market performance is not acceptable as-is for long-run deployment.
- `Over` bets have been the biggest problem; `Under` bets have performed much better so far.
- Weakest current pocket: `Away Corners | Over 3.5`.

## Important note

For historical reference, this snapshot should be treated as the **v2 baseline** even though some underlying code/backtest labels still say `corner-local-v1.0`.

This snapshot is intended to preserve the current **corner model / realized-results baseline** before the next round of changes, which will be tracked as **v3**.
