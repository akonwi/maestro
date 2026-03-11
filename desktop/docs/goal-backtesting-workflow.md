# Goal Backtesting Workflow

Use this workflow to evaluate local goal projection accuracy from the desktop SQLite database.

## Run the projection backtest

From `desktop/`:

```bash
python3 scripts/goal_projection_backtest.py
```

JSON summary output:

```bash
python3 scripts/goal_projection_backtest.py --json
```

Write report outputs to files:

```bash
python3 scripts/goal_projection_backtest.py --out ./reports/goals-backtest.txt
python3 scripts/goal_projection_backtest.py --json --out ./reports/goals-backtest.json
```

Write per-fixture predictions:

```bash
python3 scripts/goal_projection_backtest.py --predictions-out ./reports/goals-predictions.json
```

## Run the goal-market backtest

This converts projected goals into betting-style market probabilities and evaluates where the model may be most usable.

```bash
python3 scripts/goal_market_backtest.py
```

JSON output:

```bash
python3 scripts/goal_market_backtest.py --json
```

Save output:

```bash
python3 scripts/goal_market_backtest.py --out ./reports/goals-market-backtest.txt
python3 scripts/goal_market_backtest.py --json --out ./reports/goals-market-backtest.json
```

## Useful settings

- `--min-history <n>`: minimum prior finished fixtures required per team (default: `10`)
- `--recent-limit <n>`: recent-form window length used in feature construction (default: `5`)
- `--db-path <path>`: override SQLite path
- `--league-id <id>`: run backtest on one league only (repeatable flag)
- `--disable-league-models`: ignore league-specific parameter overrides for the projection backtest
- `--threshold <p>`: actionable pick threshold for the market backtest (default: `0.57`)
- `--min-league-samples <n>`: minimum sample size for league slices in the market backtest

Examples:

```bash
python3 scripts/goal_projection_backtest.py --min-history 10 --recent-limit 5
python3 scripts/goal_projection_backtest.py --league-id 40
python3 scripts/goal_market_backtest.py --threshold 0.60
python3 scripts/goal_market_backtest.py --league-id 40 --threshold 0.58
```

## What it reports

Projection backtest:
- Coverage: how many finished fixtures with complete stats are eligible for projection
- Accuracy for home, away, and total goals:
  - MAE
  - RMSE
  - Bias
  - Within 1 goal / within 2 goals
- Baseline comparison against a simple historical league-average predictor
- Betting-oriented evaluation for:
  - Over 2.5 goals
  - BTTS
- League-level total-goals MAE (minimum 30 fixtures)
- Confidence-band accuracy slices

Market backtest:
- team goals over 0.5
- team goals over 1.5
- BTTS
- all-fixture probability quality (Brier / accuracy)
- actionable pick accuracy using a probability threshold
- league-by-league fit for each market

## Evaluation protocol

- Chronological walk-forward only
- For each fixture, features use only matches with timestamps strictly earlier than kickoff
- No future leakage is allowed
