# Reports

## Current reports

These files should be treated as current snapshots of the **live database state**:

- `latest.json`
- `latest.txt`
- `corner-backtest-latest.json`
- `championship-team-corners-latest.json`
- other `*-latest.*` files that are regenerated from the current DB/model state

Note: after deleting bets tagged `Prompt: corner-local-v1.0`, current betting performance in `latest.*` no longer includes those old corner-model bets.

## Historical comparison baselines

These files are **not current**. Keep them for before/after comparison:

- `corner-market-report-v2-baseline.json`
- `corner-market-report-v2-baseline.txt`
- everything under `snapshots/2026-03-11-corner-v2-baseline/`

Those archived reports preserve the old corner-model realized betting performance so future v3+ results can be compared against the same baseline.

## Recommended interpretation

- Use `latest.*` for what the app/database reflects now.
- Use `snapshots/2026-03-11-corner-v2-baseline/` and `corner-market-report-v2-baseline.*` for historical comparison only.
