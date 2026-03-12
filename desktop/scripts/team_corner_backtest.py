#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from corner_projection_backtest import (
    build_team_history_index,
    default_db_path,
    load_fixtures,
    slice_prior_history,
    team_input_from_history,
)
from local_corner_model import DEFAULT_PARAMS, params_for_league, project


@dataclass
class TeamEvalRow:
    fixture_id: int
    timestamp: int
    team_id: int
    team_name: str
    opponent_id: int
    predicted: float
    predicted_adjusted: float
    actual: int


class TeamMetrics:
    def __init__(self) -> None:
        self.n = 0
        self.abs_error_sum = 0.0
        self.sq_error_sum = 0.0
        self.bias_sum = 0.0

    def add(self, predicted: float, actual: float) -> None:
        err = predicted - actual
        self.n += 1
        self.abs_error_sum += abs(err)
        self.sq_error_sum += err * err
        self.bias_sum += err

    def as_dict(self) -> dict:
        if self.n == 0:
            return {"n": 0, "mae": 0.0, "rmse": 0.0, "bias": 0.0}
        return {
            "n": self.n,
            "mae": self.abs_error_sum / self.n,
            "rmse": (self.sq_error_sum / self.n) ** 0.5,
            "bias": self.bias_sum / self.n,
        }


def load_team_names(conn: sqlite3.Connection) -> dict[int, str]:
    rows = conn.execute("SELECT id, name FROM teams;").fetchall()
    return {int(r[0]): str(r[1]) for r in rows}


def run_backtest(
    conn: sqlite3.Connection,
    league_id: int,
    min_history: int,
    recent_limit: int,
    bias_alpha: float,
) -> tuple[dict, list[dict]]:
    fixtures_all = load_fixtures(conn)
    fixtures = [f for f in fixtures_all if f.league_id == league_id]
    history_index = build_team_history_index(fixtures_all, conn)
    team_names = load_team_names(conn)

    rows: list[TeamEvalRow] = []

    # Online residual calibration by team id.
    team_bias_sum: dict[int, float] = defaultdict(float)
    team_bias_n: dict[int, int] = defaultdict(int)

    for fixture in fixtures:
        home_prior = slice_prior_history(history_index.get((fixture.home_id, fixture.league_id, fixture.season), []), fixture.timestamp)
        away_prior = slice_prior_history(history_index.get((fixture.away_id, fixture.league_id, fixture.season), []), fixture.timestamp)

        if len(home_prior) < min_history or len(away_prior) < min_history:
            continue

        home_input = team_input_from_history(home_prior, target_is_home=True, recent_limit=recent_limit)
        away_input = team_input_from_history(away_prior, target_is_home=False, recent_limit=recent_limit)
        params = params_for_league(league_id, fallback=DEFAULT_PARAMS)
        prediction = project(home_input, away_input, params=params)

        home_base = prediction.expected_home_corners
        away_base = prediction.expected_away_corners

        home_bias = (team_bias_sum[fixture.home_id] / team_bias_n[fixture.home_id]) if team_bias_n[fixture.home_id] > 0 else 0.0
        away_bias = (team_bias_sum[fixture.away_id] / team_bias_n[fixture.away_id]) if team_bias_n[fixture.away_id] > 0 else 0.0

        home_adjusted = max(0.5, min(12.0, home_base + (bias_alpha * home_bias)))
        away_adjusted = max(0.5, min(12.0, away_base + (bias_alpha * away_bias)))

        rows.append(
            TeamEvalRow(
                fixture_id=fixture.fixture_id,
                timestamp=fixture.timestamp,
                team_id=fixture.home_id,
                team_name=team_names.get(fixture.home_id, str(fixture.home_id)),
                opponent_id=fixture.away_id,
                predicted=home_base,
                predicted_adjusted=home_adjusted,
                actual=fixture.home_corners,
            )
        )
        rows.append(
            TeamEvalRow(
                fixture_id=fixture.fixture_id,
                timestamp=fixture.timestamp,
                team_id=fixture.away_id,
                team_name=team_names.get(fixture.away_id, str(fixture.away_id)),
                opponent_id=fixture.home_id,
                predicted=away_base,
                predicted_adjusted=away_adjusted,
                actual=fixture.away_corners,
            )
        )

        # Update online residual tracking after evaluation
        home_residual = fixture.home_corners - home_adjusted
        away_residual = fixture.away_corners - away_adjusted
        team_bias_sum[fixture.home_id] += home_residual
        team_bias_n[fixture.home_id] += 1
        team_bias_sum[fixture.away_id] += away_residual
        team_bias_n[fixture.away_id] += 1

    overall_base = TeamMetrics()
    overall_adjusted = TeamMetrics()
    by_team_base: dict[int, TeamMetrics] = defaultdict(TeamMetrics)
    by_team_adjusted: dict[int, TeamMetrics] = defaultdict(TeamMetrics)

    for row in rows:
        overall_base.add(row.predicted, row.actual)
        overall_adjusted.add(row.predicted_adjusted, row.actual)
        by_team_base[row.team_id].add(row.predicted, row.actual)
        by_team_adjusted[row.team_id].add(row.predicted_adjusted, row.actual)

    team_rows = []
    for team_id in sorted(by_team_base.keys(), key=lambda t: by_team_base[t].n, reverse=True):
        base = by_team_base[team_id].as_dict()
        adj = by_team_adjusted[team_id].as_dict()
        team_rows.append(
            {
                "team_id": team_id,
                "team_name": team_names.get(team_id, str(team_id)),
                "base": base,
                "adjusted": adj,
                "mae_improvement": (base["mae"] - adj["mae"]),
            }
        )

    summary = {
        "league_id": league_id,
        "fixtures_in_league": len(fixtures),
        "team_predictions": len(rows),
        "settings": {
            "min_history": min_history,
            "recent_limit": recent_limit,
            "bias_alpha": bias_alpha,
        },
        "overall": {
            "base": overall_base.as_dict(),
            "adjusted": overall_adjusted.as_dict(),
            "mae_improvement": overall_base.as_dict()["mae"] - overall_adjusted.as_dict()["mae"],
        },
    }

    return summary, team_rows


def format_text(summary: dict, teams: list[dict]) -> str:
    lines = []
    lines.append(f"League: {summary['league_id']}")
    lines.append(f"Fixtures: {summary['fixtures_in_league']}")
    lines.append(f"Team predictions: {summary['team_predictions']}")
    lines.append("")

    base = summary["overall"]["base"]
    adj = summary["overall"]["adjusted"]
    lines.append("Overall Team-Corners Accuracy")
    lines.append(f"- base: mae={base['mae']:.3f} rmse={base['rmse']:.3f} bias={base['bias']:.3f}")
    lines.append(f"- adjusted: mae={adj['mae']:.3f} rmse={adj['rmse']:.3f} bias={adj['bias']:.3f}")
    lines.append(f"- mae improvement: {summary['overall']['mae_improvement']:.3f}")
    lines.append("")

    lines.append("Top Teams by MAE Improvement")
    top = sorted(teams, key=lambda x: x["mae_improvement"], reverse=True)[:8]
    if not top:
        lines.append("- none")
    else:
        for t in top:
            lines.append(
                f"- {t['team_name']}: base_mae={t['base']['mae']:.3f} adjusted_mae={t['adjusted']['mae']:.3f} delta={t['mae_improvement']:.3f}"
            )

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Backtest per-team corners prediction in a league")
    parser.add_argument("--db-path", default=str(default_db_path()), help="Path to sqlite database")
    parser.add_argument("--league-id", type=int, required=True, help="League id (e.g. 40)")
    parser.add_argument("--min-history", type=int, default=10, help="Minimum prior fixtures per team")
    parser.add_argument("--recent-limit", type=int, default=5, help="Recent form window")
    parser.add_argument("--bias-alpha", type=float, default=0.25, help="Online team-residual adjustment weight")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--out", help="Write output to file")
    args = parser.parse_args()

    db_path = Path(args.db_path).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    summary, team_rows = run_backtest(
        conn=conn,
        league_id=args.league_id,
        min_history=max(0, args.min_history),
        recent_limit=max(1, args.recent_limit),
        bias_alpha=max(0.0, min(1.0, args.bias_alpha)),
    )

    payload = {
        "database": str(db_path),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "teams": team_rows,
    }

    if args.json:
        output = json.dumps(payload, indent=2)
    else:
        output = format_text(summary, team_rows)

    print(output, end="" if output.endswith("\n") else "\n")

    if args.out:
        out_path = Path(args.out).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output if output.endswith("\n") else output + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
