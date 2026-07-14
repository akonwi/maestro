#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
from bisect import bisect_left
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from local_goal_model import (
    DEFAULT_PARAMS,
    LEAGUE_MODEL_PARAMS,
    MODEL_VERSION,
    ModelParams,
    RecentFixture,
    TeamModelInput,
    params_for_league,
    project,
)


UTC = timezone.utc


@dataclass
class TeamHistoryRow:
    fixture_id: int
    league_id: int
    season: int
    timestamp: int
    is_home: bool
    goals_for: int
    goals_against: int
    xg_for: float
    xg_against: float
    shots: int
    shots_on_goal: int
    shots_in_box: int
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
    home_goals: int
    away_goals: int


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
    over_2_5_prob: float
    actual_over_2_5: bool
    btts_prob: float
    actual_btts: bool
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


class BinaryMetrics:
    def __init__(self) -> None:
        self.count = 0
        self.correct = 0
        self.sum_brier = 0.0
        self.sum_pred = 0.0
        self.actual_positive = 0
        self.predicted_positive = 0

    def add(self, probability: float, actual: bool) -> None:
        prob = clamp(probability, 0.0, 1.0)
        actual_val = 1.0 if actual else 0.0
        self.count += 1
        self.sum_brier += (prob - actual_val) ** 2
        self.sum_pred += prob
        self.actual_positive += 1 if actual else 0
        predicted_positive = prob >= 0.5
        self.predicted_positive += 1 if predicted_positive else 0
        if predicted_positive == actual:
            self.correct += 1

    def to_dict(self) -> dict:
        if self.count == 0:
            return {
                "n": 0,
                "accuracy": 0.0,
                "brier": 0.0,
                "avg_pred": 0.0,
                "actual_rate": 0.0,
                "pick_rate": 0.0,
            }
        return {
            "n": self.count,
            "accuracy": self.correct / self.count,
            "brier": self.sum_brier / self.count,
            "avg_pred": self.sum_pred / self.count,
            "actual_rate": self.actual_positive / self.count,
            "pick_rate": self.predicted_positive / self.count,
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
          f.home_goals,
          f.away_goals
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
                home_goals=int(row[7]),
                away_goals=int(row[8]),
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
          CASE WHEN f.home_id = fs.team_id THEN f.home_goals ELSE f.away_goals END AS goals_for,
          CASE WHEN f.home_id = fs.team_id THEN f.away_goals ELSE f.home_goals END AS goals_against,
          fs.xg,
          opp.xg,
          fs.shots,
          fs.shots_on_goal,
          fs.shots_in_box,
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
                goals_for=int(row[6]),
                goals_against=int(row[7]),
                xg_for=float(row[8] or 0.0),
                xg_against=float(row[9] or 0.0),
                shots=int(row[10] or 0),
                shots_on_goal=int(row[11] or 0),
                shots_in_box=int(row[12] or 0),
                possession=float(row[13] or 0.0),
            )
        )
    return index


def slice_prior_history(rows: list[TeamHistoryRow], fixture_timestamp: int) -> list[TeamHistoryRow]:
    timestamps = [row.timestamp for row in rows]
    split_idx = bisect_left(timestamps, fixture_timestamp)
    return rows[:split_idx]


def team_input_from_history(history: list[TeamHistoryRow], target_is_home: bool, recent_limit: int) -> TeamModelInput:
    season_games = len(history)
    season_goals_for = mean([float(row.goals_for) for row in history]) or 0.0
    season_goals_against = mean([float(row.goals_against) for row in history]) or 0.0
    season_xg_for = mean([float(row.xg_for) for row in history]) or 0.0
    season_xg_against = mean([float(row.xg_against) for row in history]) or 0.0

    venue_history = [row for row in history if row.is_home == target_is_home]
    venue_games = len(venue_history)
    venue_goals_for = mean([float(row.goals_for) for row in venue_history]) or season_goals_for
    venue_goals_against = mean([float(row.goals_against) for row in venue_history]) or season_goals_against
    venue_xg_for = mean([float(row.xg_for) for row in venue_history]) or season_xg_for
    venue_xg_against = mean([float(row.xg_against) for row in venue_history]) or season_xg_against

    shots_per_game = mean([float(row.shots) for row in history]) or 0.0
    shots_on_goal_per_game = mean([float(row.shots_on_goal) for row in history]) or 0.0
    total_shots = sum(row.shots for row in history)
    total_shots_in_box = sum(row.shots_in_box for row in history)
    shots_in_box_share = (float(total_shots_in_box) / float(total_shots)) if total_shots > 0 else 0.52
    xg_per_game = season_xg_for
    xg_against_per_game = season_xg_against
    possession_avg = mean([float(row.possession) for row in history]) or 0.0

    recent_rows = history[-recent_limit:]
    recent_form = [
        RecentFixture(
            goals_for=row.goals_for,
            goals_against=row.goals_against,
            xg_for=row.xg_for,
            xg_against=row.xg_against,
        )
        for row in reversed(recent_rows)
    ]

    return TeamModelInput(
        season_games=season_games,
        season_goals_for=season_goals_for,
        season_goals_against=season_goals_against,
        season_xg_for=season_xg_for,
        season_xg_against=season_xg_against,
        venue_games=venue_games,
        venue_goals_for=venue_goals_for,
        venue_goals_against=venue_goals_against,
        venue_xg_for=venue_xg_for,
        venue_xg_against=venue_xg_against,
        shots_per_game=shots_per_game,
        shots_on_goal_per_game=shots_on_goal_per_game,
        shots_in_box_share=shots_in_box_share,
        xg_per_game=xg_per_game,
        xg_against_per_game=xg_against_per_game,
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

        home_input = team_input_from_history(home_prior, target_is_home=True, recent_limit=recent_limit)
        away_input = team_input_from_history(away_prior, target_is_home=False, recent_limit=recent_limit)

        fixture_params = params_for_league(fixture.league_id, fallback=model_params) if use_league_specific_models else model_params
        projection = project(home_input, away_input, params=fixture_params)

        actual_total = fixture.home_goals + fixture.away_goals
        predictions.append(
            PredictionRow(
                fixture_id=fixture.fixture_id,
                league_name=fixture.league_name,
                season=fixture.season,
                date_utc=datetime.fromtimestamp(fixture.timestamp / 1000, UTC).strftime("%Y-%m-%d"),
                expected_home=projection.expected_home_goals,
                expected_away=projection.expected_away_goals,
                expected_total=projection.expected_total_goals,
                actual_home=fixture.home_goals,
                actual_away=fixture.away_goals,
                actual_total=actual_total,
                over_2_5_prob=projection.over_2_5_prob,
                actual_over_2_5=actual_total >= 3,
                btts_prob=projection.btts_prob,
                actual_btts=fixture.home_goals > 0 and fixture.away_goals > 0,
                confidence=projection.confidence,
            )
        )

    overall_home = ErrorMetrics()
    overall_away = ErrorMetrics()
    overall_total = ErrorMetrics()
    baseline_home = ErrorMetrics()
    baseline_away = ErrorMetrics()
    baseline_total = ErrorMetrics()

    over_2_5_metrics = BinaryMetrics()
    btts_metrics = BinaryMetrics()
    baseline_over_2_5_metrics = BinaryMetrics()
    baseline_btts_metrics = BinaryMetrics()

    league_total_metrics: dict[str, ErrorMetrics] = defaultdict(ErrorMetrics)
    confidence_band_total_metrics: dict[str, ErrorMetrics] = defaultdict(ErrorMetrics)

    running_home_sum = 0.0
    running_away_sum = 0.0
    running_n = 0
    running_over_2_5 = 0
    running_btts = 0
    running_by_league: dict[str, tuple[float, float, int, int, int]] = {}

    for row in predictions:
        overall_home.add(row.expected_home, float(row.actual_home))
        overall_away.add(row.expected_away, float(row.actual_away))
        overall_total.add(row.expected_total, float(row.actual_total))

        over_2_5_metrics.add(row.over_2_5_prob, row.actual_over_2_5)
        btts_metrics.add(row.btts_prob, row.actual_btts)

        league_total_metrics[row.league_name].add(row.expected_total, float(row.actual_total))
        confidence_band_total_metrics[confidence_band_label(row.confidence)].add(row.expected_total, float(row.actual_total))

        prev_league = running_by_league.get(row.league_name)
        if prev_league and prev_league[2] > 0:
            league_home_avg = prev_league[0] / prev_league[2]
            league_away_avg = prev_league[1] / prev_league[2]
            league_over_rate = prev_league[3] / prev_league[2]
            league_btts_rate = prev_league[4] / prev_league[2]
        elif running_n > 0:
            league_home_avg = running_home_sum / running_n
            league_away_avg = running_away_sum / running_n
            league_over_rate = running_over_2_5 / running_n
            league_btts_rate = running_btts / running_n
        else:
            league_home_avg = 1.45
            league_away_avg = 1.15
            league_over_rate = 0.50
            league_btts_rate = 0.48

        baseline_home.add(league_home_avg, float(row.actual_home))
        baseline_away.add(league_away_avg, float(row.actual_away))
        baseline_total.add(league_home_avg + league_away_avg, float(row.actual_total))
        baseline_over_2_5_metrics.add(league_over_rate, row.actual_over_2_5)
        baseline_btts_metrics.add(league_btts_rate, row.actual_btts)

        running_home_sum += float(row.actual_home)
        running_away_sum += float(row.actual_away)
        running_n += 1
        running_over_2_5 += 1 if row.actual_over_2_5 else 0
        running_btts += 1 if row.actual_btts else 0

        lg_home_sum, lg_away_sum, lg_n, lg_over_hits, lg_btts_hits = running_by_league.get(row.league_name, (0.0, 0.0, 0, 0, 0))
        running_by_league[row.league_name] = (
            lg_home_sum + float(row.actual_home),
            lg_away_sum + float(row.actual_away),
            lg_n + 1,
            lg_over_hits + (1 if row.actual_over_2_5 else 0),
            lg_btts_hits + (1 if row.actual_btts else 0),
        )

    summary = {
        "model_version": MODEL_VERSION,
        "model_params": {
            "attack_weight": model_params.attack_weight,
            "defense_weight": model_params.defense_weight,
            "venue_weight": model_params.venue_weight,
            "recent_weight": model_params.recent_weight,
            "goals_weight": model_params.goals_weight,
            "xg_weight": model_params.xg_weight,
            "shot_volume_weight": model_params.shot_volume_weight,
            "shot_quality_weight": model_params.shot_quality_weight,
            "possession_weight": model_params.possession_weight,
            "finishing_weight": model_params.finishing_weight,
            "home_advantage_goals": model_params.home_advantage_goals,
        },
        "league_model_overrides": {
            str(league_id): {
                "attack_weight": params.attack_weight,
                "defense_weight": params.defense_weight,
                "venue_weight": params.venue_weight,
                "recent_weight": params.recent_weight,
                "goals_weight": params.goals_weight,
                "xg_weight": params.xg_weight,
                "shot_volume_weight": params.shot_volume_weight,
                "shot_quality_weight": params.shot_quality_weight,
                "possession_weight": params.possession_weight,
                "finishing_weight": params.finishing_weight,
                "home_advantage_goals": params.home_advantage_goals,
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
        "market_accuracy": {
            "over_2_5": over_2_5_metrics.to_dict(),
            "btts": btts_metrics.to_dict(),
        },
        "baseline_market_accuracy": {
            "over_2_5": baseline_over_2_5_metrics.to_dict(),
            "btts": baseline_btts_metrics.to_dict(),
        },
        "by_league_total_goals": {
            league: metrics.to_dict()
            for league, metrics in sorted(league_total_metrics.items(), key=lambda item: item[1].count, reverse=True)
            if metrics.count >= 30
        },
        "by_confidence_band_total_goals": {
            band: metrics.to_dict()
            for band, metrics in sorted(confidence_band_total_metrics.items())
        },
    }

    return predictions, summary


def confidence_band_label(value: float) -> str:
    pct = value * 100
    if pct < 60:
        return "50-59%"
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


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def format_summary_text(summary: dict, db_path: Path) -> str:
    lines: list[str] = []
    cov = summary["coverage"]
    lines.append(f"Database: {db_path}")
    lines.append(f"Model: {summary['model_version']}")
    lines.append("Coverage")
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

    lines.append("Betting Market Accuracy")
    for market_key, label in (("over_2_5", "Over 2.5"), ("btts", "BTTS")):
        stats = summary["market_accuracy"][market_key]
        baseline = summary["baseline_market_accuracy"][market_key]
        lines.append(
            f"- {label}: acc={format_pct(stats['accuracy'])} brier={stats['brier']:.3f} "
            f"avg_pred={format_pct(stats['avg_pred'])} actual={format_pct(stats['actual_rate'])} "
            f"pick_rate={format_pct(stats['pick_rate'])}"
        )
        lines.append(
            f"  baseline: acc={format_pct(baseline['accuracy'])} brier={baseline['brier']:.3f} "
            f"avg_pred={format_pct(baseline['avg_pred'])}"
        )
    lines.append("")

    lines.append("By League Total Goals MAE (min 30 fixtures)")
    by_league = summary["by_league_total_goals"]
    if not by_league:
        lines.append("- none")
    else:
        for league, stats in by_league.items():
            lines.append(
                f"- {league}: n={stats['n']} mae={stats['mae']:.3f} rmse={stats['rmse']:.3f} bias={stats['bias']:.3f}"
            )
    lines.append("")

    lines.append("By Confidence Band (total goals)")
    by_conf = summary["by_confidence_band_total_goals"]
    if not by_conf:
        lines.append("- none")
    else:
        for band, stats in by_conf.items():
            lines.append(f"- {band}: n={stats['n']} mae={stats['mae']:.3f} rmse={stats['rmse']:.3f}")

    return "\n".join(lines) + "\n"


def write_optional_output(path: Path | None, content: str) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backtest local goals projection model with chronological no-leakage evaluation")
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
                    "over_2_5_prob": round(row.over_2_5_prob, 4),
                    "actual_over_2_5": row.actual_over_2_5,
                    "btts_prob": round(row.btts_prob, 4),
                    "actual_btts": row.actual_btts,
                    "confidence": round(row.confidence, 4),
                }
                for row in predictions
            ],
        }
        pred_out.parent.mkdir(parents=True, exist_ok=True)
        pred_out.write_text(json.dumps(prediction_payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
