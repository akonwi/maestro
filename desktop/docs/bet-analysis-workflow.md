# Bet Analysis Workflow

This workflow is for tracking prompt performance over time and improving prompt quality with real outcomes.

## Run the report

From `desktop/`:

```bash
python3 scripts/bet_performance_report.py
```

JSON output (for archiving or charting):

```bash
python3 scripts/bet_performance_report.py --json
```

Write report output to a file:

```bash
python3 scripts/bet_performance_report.py --out ./reports/weekly.txt
python3 scripts/bet_performance_report.py --json --out ./reports/weekly.json
```

Custom DB path:

```bash
python3 scripts/bet_performance_report.py --db-path "~/Library/Application Support/com.akonwi.maestro/maestro.sqlite"
```

## Corner-only market report

Use this when you want a cleaner breakdown of corner bet performance only.

```bash
python3 scripts/corner_market_report.py
python3 scripts/corner_market_report.py --json
python3 scripts/corner_market_report.py --prompt-version corner-local-v1.0
python3 scripts/corner_market_report.py --out ./reports/corner-market-report-latest.txt
python3 scripts/corner_market_report.py --json --out ./reports/corner-market-report-latest.json
```

This report includes:
- overall corner-only ROI and win rate
- breakdown by corner market
- breakdown by side (`Over` / `Under`)
- breakdown by numeric line value (`3.5`, `4.5`, `5.5`, etc.)
- breakdown by exact selection and by market + selection
- breakdown by league

## What gets tracked

- Overall win rate, ROI, net profit, and implied break-even hit rate from odds.
- Performance by prompt version (reads `Prompt: <version>` from bet notes).
- Performance by market, confidence bands, and league.
- Recent 10 bets versus previous 10 bets.

## Prompt versioning

- New notes include `Prompt: corner-v2.0` automatically when saving AI picks.
- Older bets are grouped as `legacy-v1`.
- Legacy prompt is preserved in `prompts/corner-analysis-v1.md`.
- When you update the system prompt, bump `OpenAIService.promptVersion` and keep changelog notes in `prompts/corner-analysis.md`.

## Scientific iteration loop

1. Keep the prompt fixed for a defined sample window (example: next 25 settled bets).
2. Run the report and save JSON snapshots weekly.
3. Compare prompt versions only after enough sample size.
4. Change one policy at a time (edge threshold, confidence cap, or stake cap), not all at once.
5. Promote a new prompt only when it improves ROI and calibration together.
