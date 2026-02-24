# Corner Backtesting Workflow

Use this workflow to evaluate local corner projection accuracy from the desktop SQLite database.

## Run the backtest

From `desktop/`:

```bash
python3 scripts/corner_projection_backtest.py
```

JSON summary output:

```bash
python3 scripts/corner_projection_backtest.py --json
```

Write report outputs to files:

```bash
python3 scripts/corner_projection_backtest.py --out ./reports/corner-backtest.txt
python3 scripts/corner_projection_backtest.py --json --out ./reports/corner-backtest.json
```

Write per-fixture predictions:

```bash
python3 scripts/corner_projection_backtest.py --predictions-out ./reports/corner-predictions.json
```

## Useful settings

- `--min-history <n>`: minimum prior finished fixtures required per team (default: `10`).
- `--recent-limit <n>`: recent-form window length used in feature construction (default: `5`).
- `--db-path <path>`: override SQLite path.
- `--league-id <id>`: run backtest on one league only (repeatable flag).

Example:

```bash
python3 scripts/corner_projection_backtest.py --min-history 10 --recent-limit 5
python3 scripts/corner_projection_backtest.py --league-id 40
```

## What it reports

- Coverage: how many finished fixtures with complete stats are eligible for projection.
- Accuracy for home, away, and total corners:
  - MAE
  - RMSE
  - Bias
  - Within 1 corner / within 2 corners
- Baseline comparison against a simple historical league-average predictor.
- League-level total-corners MAE (minimum 30 fixtures).
- Confidence-band accuracy slices.

## Evaluation protocol

- Chronological walk-forward only.
- For each fixture, features use only matches with timestamps strictly earlier than kickoff.
- No future leakage is allowed.

## Tune model weights

Run grid-search tuning focused on total-corners prediction error:

```bash
python3 scripts/corner_projection_tune.py
```

Save full tuning results:

```bash
python3 scripts/corner_projection_tune.py --out ./reports/corner-tune-latest.json
python3 scripts/corner_projection_tune.py --league-id 40 --out ./reports/championship-tune.json
```

Tuning compares parameter sets and prints top candidates by total-corners score (MAE with small bias penalty).

## Team-level corner backtest (within one league)

Evaluate per-team corner predictions inside a competition (example: Championship `40`):

```bash
python3 scripts/team_corner_backtest.py --league-id 40
```

JSON output:

```bash
python3 scripts/team_corner_backtest.py --league-id 40 --json
```

This report includes:
- overall per-team MAE/RMSE/bias
- optional online team-residual adjustment comparison
- team-by-team error table for identifying clubs with persistent under/over prediction
