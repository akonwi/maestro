#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
from bisect import bisect_left
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from local_corner_model import (
    DEFAULT_PARAMS,
    LEAGUE_MODEL_PARAMS,
    MODEL_VERSION,
    ModelParams,
    RecentFixture,
    TeamModelInput,
    params_for_league,
    project,
)


@dataclass
class TeamHistoryRow:
    fixture_id: int
    league_id: int
    season: int
    timestamp: int
    is_home: bool
    corners_for: int
    corners_against: int
    shots: int
    shots_on_goal: int
    shots_in_box: int
    passes: int
    passes_completed: int
    xg: float
    possession: float


@dataclass
class FixtureRow:
    fixture_id: int
    league_id: int
    league_name: str
    season: int
    timestamp: int
    home_id: int
    away_id: int
    home_corners: int
    away_corners: int


@dataclass
class PredictionRow:
    fixture_id: int
    league_name: str
    season: int
    date_utc: str
    expected_home: float
    expected_away: float
    expected_total: float
    actual_home: int
    actual_away: int
    actual_total: int
    confidence: float


class ErrorMetrics:
    def __init__(self) -> None:
        self.count = 0
        self.sum_abs = 0.0
        self.sum_sq = 0.0
        self.sum_err = 0.0
        self.within_1 = 0
        self.within_2 = 0

    def add(self, predicted: float, actual: float) -> None:
        error = predicted - actual
        abs_error = abs(error)
        self.count += 1
        self.sum_abs += abs_error
        self.sum_sq += error * error
        self.sum_err += error
        if abs_error <= 1.0:
            self.within_1 += 1
        if abs_error <= 2.0:
            self.within_2 += 1

    def to_dict(self) -> dict:
        if self.count == 0:
            return {
                "n": 0,
                "mae": 0.0,
                "rmse": 0.0,
                "bias": 0.0,
                "within_1": 0.0,
                "within_2": 0.0,
            }
        return {
            "n": self.count,
            "mae": self.sum_abs / self.count,
            "rmse": (self.sum_sq / self.count) ** 0.5,
            "bias": self.sum_err / self.count,
            "within_1": self.within_1 / self.count,
            "within_2": self.within_2 / self.count,
        }


def default_db_path() -> Path:
    return Path.home() / "Library" / "Application Support" / "com.akonwi.maestro" / "maestro.sqlite"


def load_fixtures(conn: sqlite3.Connection) -> list[FixtureRow]:
    rows = conn.execute(
        """
        SELECT
          f.id,
          f.league_id,
          COALESCE(l.name, 'Unknown League') AS league_name,
          f.season,
          f.timestamp,
          f.home_id,
          f.away_id,
          hs.corners AS home_corners,
          aws.corners AS away_corners
        FROM fixtures f
        JOIN fixture_stats hs ON hs.fixture_id = f.id AND hs.team_id = f.home_id
        JOIN fixture_stats aws ON aws.fixture_id = f.id AND aws.team_id = f.away_id
        LEFT JOIN leagues l ON l.id = f.league_id
        WHERE f.finished = 1
        ORDER BY f.timestamp ASC, f.id ASC;
        """
    ).fetchall()

    output: list[FixtureRow] = []
    for row in rows:
        output.append(
            FixtureRow(
                fixture_id=int(row[0]),
                league_id=int(row[1]),
                league_name=str(row[2]),
                season=int(row[3]),
                timestamp=int(row[4]),
                home_id=int(row[5]),
                away_id=int(row[6]),
                home_corners=int(row[7]),
                away_corners=int(row[8]),
            )
        )
    return output


def build_team_history_index(fixtures: list[FixtureRow], conn: sqlite3.Connection) -> dict[tuple[int, int, int], list[TeamHistoryRow]]:
    fixture_ids = [f.fixture_id for f in fixtures]
    if not fixture_ids:
        return {}

    placeholders = ",".join(["?"] * len(fixture_ids))
    rows = conn.execute(
        f"""
        SELECT
          f.id,
          f.league_id,
          f.season,
          f.timestamp,
          fs.team_id,
          CASE WHEN f.home_id = fs.team_id THEN 1 ELSE 0 END AS is_home,
          fs.corners,
          opp.corners,
          fs.shots,
          fs.shots_on_goal,
          fs.shots_in_box,
          fs.passes,
          fs.passes_completed,
          fs.xg,
          fs.possession
        FROM fixtures f
        JOIN fixture_stats fs ON fs.fixture_id = f.id
        JOIN fixture_stats opp ON opp.fixture_id = f.id AND opp.team_id != fs.team_id
        WHERE f.id IN ({placeholders})
          AND f.finished = 1
        ORDER BY f.timestamp ASC, f.id ASC;
        """,
        fixture_ids,
    ).fetchall()

    index: dict[tuple[int, int, int], list[TeamHistoryRow]] = defaultdict(list)
    for row in rows:
        key = (int(row[4]), int(row[1]), int(row[2]))
        index[key].append(
            TeamHistoryRow(
                fixture_id=int(row[0]),
                league_id=int(row[1]),
                season=int(row[2]),
                timestamp=int(row[3]),
                is_home=bool(int(row[5])),
                corners_for=int(row[6]),
                corners_against=int(row[7]),
                shots=int(row[8] or 0),
                shots_on_goal=int(row[9] or 0),
                shots_in_box=int(row[10] or 0),
                passes=int(row[11] or 0),
                passes_completed=int(row[12] or 0),
                xg=float(row[13] or 0.0),
                possession=float(row[14] or 0.0),
            )
        )
    return index


def slice_prior_history(rows: list[TeamHistoryRow], fixture_timestamp: int) -> list[TeamHistoryRow]:
    timestamps = [row.timestamp for row in rows]
    split_idx = bisect_left(timestamps, fixture_timestamp)
    return rows[:split_idx]


def team_input_from_history(
    history: list[TeamHistoryRow],
    target_is_home: bool,
    recent_limit: int,
) -> TeamModelInput:
    season_games = len(history)
    season_corners_for = mean([float(row.corners_for) for row in history]) or 0.0
    season_corners_against = mean([float(row.corners_against) for row in history]) or 0.0

    venue_history = [row for row in history if row.is_home == target_is_home]
    venue_games = len(venue_history)
    venue_corners_for = mean([float(row.corners_for) for row in venue_history]) or season_corners_for
    venue_corners_against = mean([float(row.corners_against) for row in venue_history]) or season_corners_against

    shots_per_game = mean([float(row.shots) for row in history]) or 0.0
    shots_on_goal_per_game = mean([float(row.shots_on_goal) for row in history]) or 0.0
    total_shots = sum(row.shots for row in history)
    total_shots_in_box = sum(row.shots_in_box for row in history)
    shots_in_box_share = (float(total_shots_in_box) / float(total_shots)) if total_shots > 0 else 0.55
    passes_per_game = mean([float(row.passes) for row in history]) or 0.0
    total_passes = sum(row.passes for row in history)
    total_passes_completed = sum(row.passes_completed for row in history)
    pass_completion_rate = (float(total_passes_completed) / float(total_passes)) if total_passes > 0 else 0.78
    xg_per_game = mean([float(row.xg) for row in history]) or 0.0
    possession_avg = mean([float(row.possession) for row in history]) or 0.0

    recent_rows = history[-recent_limit:]
    recent_form = [
        RecentFixture(corners_won=row.corners_for, corners_conceded=row.corners_against)
        for row in reversed(recent_rows)
    ]

    return TeamModelInput(
        season_games=season_games,
        season_corners_for=season_corners_for,
        season_corners_against=season_corners_against,
        venue_games=venue_games,
        venue_corners_for=venue_corners_for,
        venue_corners_against=venue_corners_against,
        shots_per_game=shots_per_game,
        shots_on_goal_per_game=shots_on_goal_per_game,
        shots_in_box_share=shots_in_box_share,
        passes_per_game=passes_per_game,
        pass_completion_rate=pass_completion_rate,
        xg_per_game=xg_per_game,
        possession_avg=possession_avg,
        recent_form=recent_form,
    )


def mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / float(len(values))


def evaluate(
    fixtures: list[FixtureRow],
    history_index: dict[tuple[int, int, int], list[TeamHistoryRow]],
    min_history_per_team: int,
    recent_limit: int,
    model_params: ModelParams = DEFAULT_PARAMS,
    league_id_filter: set[int] | None = None,
    use_league_specific_models: bool = True,
) -> tuple[list[PredictionRow], dict]:
    filtered_fixtures = fixtures
    if league_id_filter:
        filtered_fixtures = [f for f in fixtures if f.league_id in league_id_filter]

    total_finished_with_stats = len(filtered_fixtures)
    attempted = 0
    skipped_no_history = 0

    predictions: list[PredictionRow] = []

    for fixture in filtered_fixtures:
        home_key = (fixture.home_id, fixture.league_id, fixture.season)
        away_key = (fixture.away_id, fixture.league_id, fixture.season)

        home_history_all = history_index.get(home_key, [])
        away_history_all = history_index.get(away_key, [])

        home_prior = slice_prior_history(home_history_all, fixture.timestamp)
        away_prior = slice_prior_history(away_history_all, fixture.timestamp)

        if len(home_prior) < min_history_per_team or len(away_prior) < min_history_per_team:
            skipped_no_history += 1
            continue

        attempted += 1

        home_input = team_input_from_history(home_prior, target_is_home=True, recent_limit=recent_limit)
        away_input = team_input_from_history(away_prior, target_is_home=False, recent_limit=recent_limit)

        fixture_params = params_for_league(fixture.league_id, fallback=model_params) if use_league_specific_models else model_params
        projection = project(home_input, away_input, params=fixture_params)
        predictions.append(
            PredictionRow(
                fixture_id=fixture.fixture_id,
                league_name=fixture.league_name,
                season=fixture.season,
                date_utc=datetime.fromtimestamp(fixture.timestamp / 1000, UTC).strftime("%Y-%m-%d"),
                expected_home=projection.expected_home_corners,
                expected_away=projection.expected_away_corners,
                expected_total=projection.expected_total_corners,
                actual_home=fixture.home_corners,
                actual_away=fixture.away_corners,
                actual_total=fixture.home_corners + fixture.away_corners,
                confidence=projection.confidence,
            )
        )

    overall_home = ErrorMetrics()
    overall_away = ErrorMetrics()
    overall_total = ErrorMetrics()
    baseline_home = ErrorMetrics()
    baseline_away = ErrorMetrics()
    baseline_total = ErrorMetrics()

    league_metrics: dict[str, dict[str, ErrorMetrics]] = defaultdict(
        lambda: {
            "home": ErrorMetrics(),
            "away": ErrorMetrics(),
            "total": ErrorMetrics(),
        }
    )

    confidence_band_metrics: dict[str, ErrorMetrics] = defaultdict(ErrorMetrics)

    running_home_sum = 0.0
    running_away_sum = 0.0
    running_n = 0
    running_by_league: dict[str, tuple[float, float, int]] = {}

    for row in predictions:
        overall_home.add(row.expected_home, float(row.actual_home))
        overall_away.add(row.expected_away, float(row.actual_away))
        overall_total.add(row.expected_total, float(row.actual_total))

        lg = league_metrics[row.league_name]
        lg["home"].add(row.expected_home, float(row.actual_home))
        lg["away"].add(row.expected_away, float(row.actual_away))
        lg["total"].add(row.expected_total, float(row.actual_total))

        confidence_band = confidence_band_label(row.confidence)
        confidence_band_metrics[confidence_band].add(row.expected_total, float(row.actual_total))

        prev_league = running_by_league.get(row.league_name)
        if prev_league and prev_league[2] > 0:
            league_home_avg = prev_league[0] / prev_league[2]
            league_away_avg = prev_league[1] / prev_league[2]
        elif running_n > 0:
            league_home_avg = running_home_sum / running_n
            league_away_avg = running_away_sum / running_n
        else:
            league_home_avg = 5.0
            league_away_avg = 4.5

        baseline_home.add(league_home_avg, float(row.actual_home))
        baseline_away.add(league_away_avg, float(row.actual_away))
        baseline_total.add(league_home_avg + league_away_avg, float(row.actual_total))

        running_home_sum += float(row.actual_home)
        running_away_sum += float(row.actual_away)
        running_n += 1

        lg_home_sum, lg_away_sum, lg_n = running_by_league.get(row.league_name, (0.0, 0.0, 0))
        running_by_league[row.league_name] = (
            lg_home_sum + float(row.actual_home),
            lg_away_sum + float(row.actual_away),
            lg_n + 1,
        )

    summary = {
        "model_version": MODEL_VERSION,
        "model_params": {
            "attack_weight": model_params.attack_weight,
            "defense_weight": model_params.defense_weight,
            "venue_weight": model_params.venue_weight,
            "recent_weight": model_params.recent_weight,
            "pace_weight_shots": model_params.pace_weight_shots,
            "pace_weight_shot_quality": model_params.pace_weight_shot_quality,
            "pace_weight_tempo_quality": model_params.pace_weight_tempo_quality,
            "pace_weight_xg": model_params.pace_weight_xg,
            "pace_weight_possession": model_params.pace_weight_possession,
        },
        "league_model_overrides": {
            str(league_id): {
                "attack_weight": params.attack_weight,
                "defense_weight": params.defense_weight,
                "venue_weight": params.venue_weight,
                "recent_weight": params.recent_weight,
                "pace_weight_shots": params.pace_weight_shots,
                "pace_weight_shot_quality": params.pace_weight_shot_quality,
                "pace_weight_tempo_quality": params.pace_weight_tempo_quality,
                "pace_weight_xg": params.pace_weight_xg,
                "pace_weight_possession": params.pace_weight_possession,
            }
            for league_id, params in sorted(LEAGUE_MODEL_PARAMS.items())
        },
        "coverage": {
            "finished_with_stats": total_finished_with_stats,
            "eligible_for_projection": len(predictions),
            "coverage_rate": (len(predictions) / total_finished_with_stats) if total_finished_with_stats else 0.0,
            "skipped_for_insufficient_history": skipped_no_history,
        },
        "accuracy": {
            "home": overall_home.to_dict(),
            "away": overall_away.to_dict(),
            "total": overall_total.to_dict(),
        },
        "baseline_accuracy": {
            "home": baseline_home.to_dict(),
            "away": baseline_away.to_dict(),
            "total": baseline_total.to_dict(),
        },
        "improvement_vs_baseline_mae": {
            "home": safe_improvement(baseline_home, overall_home),
            "away": safe_improvement(baseline_away, overall_away),
            "total": safe_improvement(baseline_total, overall_total),
        },
        "by_league_total_mae": {
            league: metrics["total"].to_dict()
            for league, metrics in sorted(
                league_metrics.items(),
                key=lambda item: item[1]["total"].count,
                reverse=True,
            )
            if metrics["total"].count >= 30
        },
        "by_confidence_band_total": {
            band: metrics.to_dict()
            for band, metrics in sorted(confidence_band_metrics.items())
        },
    }

    return predictions, summary


def confidence_band_label(value: float) -> str:
    pct = value * 100
    if pct < 60:
        return "52-59%"
    if pct < 70:
        return "60-69%"
    if pct < 80:
        return "70-79%"
    return "80%+"


def safe_improvement(baseline: ErrorMetrics, model: ErrorMetrics) -> float:
    baseline_dict = baseline.to_dict()
    model_dict = model.to_dict()
    baseline_mae = float(baseline_dict["mae"])
    model_mae = float(model_dict["mae"])
    if baseline_mae <= 0:
        return 0.0
    return (baseline_mae - model_mae) / baseline_mae


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def format_summary_text(summary: dict, db_path: Path) -> str:
    lines: list[str] = []
    cov = summary["coverage"]
    lines.append(f"Database: {db_path}")
    lines.append(f"Model: {summary['model_version']}")
    lines.append(
        "Coverage"
    )
    lines.append(
        "  finished_with_stats={finished} eligible={eligible} skipped={skipped} coverage={coverage}".format(
            finished=cov["finished_with_stats"],
            eligible=cov["eligible_for_projection"],
            skipped=cov["skipped_for_insufficient_history"],
            coverage=format_pct(cov["coverage_rate"]),
        )
    )
    lines.append("")

    lines.append("Accuracy (MAE / RMSE / Bias)")
    for key in ("home", "away", "total"):
        stats = summary["accuracy"][key]
        lines.append(
            f"- {key}: mae={stats['mae']:.3f} rmse={stats['rmse']:.3f} bias={stats['bias']:.3f} "
            f"within1={format_pct(stats['within_1'])} within2={format_pct(stats['within_2'])}"
        )
    lines.append("")

    lines.append("Baseline Comparison (MAE improvement)")
    for key in ("home", "away", "total"):
        improve = summary["improvement_vs_baseline_mae"][key]
        lines.append(f"- {key}: {format_pct(improve)}")
    lines.append("")

    lines.append("By League Total MAE (min 30 fixtures)")
    by_league = summary["by_league_total_mae"]
    if not by_league:
        lines.append("- none")
    else:
        for league, stats in by_league.items():
            lines.append(
                f"- {league}: n={stats['n']} mae={stats['mae']:.3f} rmse={stats['rmse']:.3f} bias={stats['bias']:.3f}"
            )
    lines.append("")

    lines.append("By Confidence Band (total corners)")
    by_conf = summary["by_confidence_band_total"]
    if not by_conf:
        lines.append("- none")
    else:
        for band, stats in by_conf.items():
            lines.append(
                f"- {band}: n={stats['n']} mae={stats['mae']:.3f} rmse={stats['rmse']:.3f}"
            )

    return "\n".join(lines) + "\n"


def write_optional_output(path: Path | None, content: str) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backtest local corner projection model with chronological no-leakage evaluation")
    parser.add_argument("--db-path", default=str(default_db_path()), help="Path to sqlite database")
    parser.add_argument("--json", action="store_true", help="Output JSON summary")
    parser.add_argument("--out", help="Write report output to file")
    parser.add_argument("--predictions-out", help="Write per-fixture predictions as JSON")
    parser.add_argument("--min-history", type=int, default=10, help="Minimum prior finished fixtures per team")
    parser.add_argument("--recent-limit", type=int, default=5, help="Recent fixture window size")
    parser.add_argument("--league-id", type=int, action="append", help="Optional league id filter (can be used multiple times)")
    parser.add_argument(
        "--disable-league-models",
        action="store_true",
        help="Use only global default model params and ignore league overrides",
    )
    args = parser.parse_args()

    db_path = Path(args.db_path).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    fixtures = load_fixtures(conn)
    history_index = build_team_history_index(fixtures, conn)
    predictions, summary = evaluate(
        fixtures=fixtures,
        history_index=history_index,
        min_history_per_team=max(0, args.min_history),
        recent_limit=max(1, args.recent_limit),
        model_params=DEFAULT_PARAMS,
        league_id_filter=set(args.league_id) if args.league_id else None,
        use_league_specific_models=not args.disable_league_models,
    )

    summary_payload = {
        "database": str(db_path),
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "settings": {
            "min_history": max(0, args.min_history),
            "recent_limit": max(1, args.recent_limit),
            "league_ids": args.league_id or [],
            "use_league_specific_models": not args.disable_league_models,
        },
        **summary,
    }

    out_path = Path(args.out).expanduser().resolve() if args.out else None

    if args.json:
        text = json.dumps(summary_payload, indent=2)
        print(text)
        write_optional_output(out_path, text + "\n")
    else:
        text = format_summary_text(summary_payload, db_path)
        print(text, end="")
        write_optional_output(out_path, text)

    if args.predictions_out:
        pred_out = Path(args.predictions_out).expanduser().resolve()
        prediction_payload = {
            "database": str(db_path),
            "generated_at_utc": datetime.now(UTC).isoformat(),
            "model_version": MODEL_VERSION,
            "predictions": [
                {
                    "fixture_id": row.fixture_id,
                    "league_name": row.league_name,
                    "season": row.season,
                    "date_utc": row.date_utc,
                    "expected_home": round(row.expected_home, 4),
                    "expected_away": round(row.expected_away, 4),
                    "expected_total": round(row.expected_total, 4),
                    "actual_home": row.actual_home,
                    "actual_away": row.actual_away,
                    "actual_total": row.actual_total,
                    "confidence": round(row.confidence, 4),
                }
                for row in predictions
            ],
        }
        pred_out.parent.mkdir(parents=True, exist_ok=True)
        pred_out.write_text(json.dumps(prediction_payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
