#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from goal_projection_backtest import (
    build_team_history_index,
    default_db_path,
    load_fixtures,
    slice_prior_history,
    team_input_from_history,
)
from local_goal_model import DEFAULT_PARAMS, params_for_league, project


UTC = timezone.utc


@dataclass
class MarketPrediction:
    fixture_id: int
    league_id: int
    league_name: str
    season: int
    date_utc: str
    market: str
    probability_yes: float
    actual_yes: bool
    confidence: float


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
        picked_yes = prob >= 0.5
        self.count += 1
        self.sum_brier += (prob - actual_val) ** 2
        self.sum_pred += prob
        self.actual_positive += 1 if actual else 0
        self.predicted_positive += 1 if picked_yes else 0
        if picked_yes == actual:
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


class DecisionMetrics:
    def __init__(self) -> None:
        self.decisions = 0
        self.correct = 0
        self.yes_picks = 0
        self.no_picks = 0
        self.sum_edge = 0.0

    def add(self, probability_yes: float, actual_yes: bool, threshold: float) -> None:
        prob = clamp(probability_yes, 0.0, 1.0)
        if prob >= threshold:
            self.decisions += 1
            self.yes_picks += 1
            self.sum_edge += prob - 0.5
            if actual_yes:
                self.correct += 1
        elif prob <= (1.0 - threshold):
            self.decisions += 1
            self.no_picks += 1
            self.sum_edge += 0.5 - prob
            if not actual_yes:
                self.correct += 1

    def to_dict(self) -> dict:
        if self.decisions == 0:
            return {
                "decisions": 0,
                "accuracy": 0.0,
                "yes_picks": 0,
                "no_picks": 0,
                "avg_edge_from_50": 0.0,
            }
        return {
            "decisions": self.decisions,
            "accuracy": self.correct / self.decisions,
            "yes_picks": self.yes_picks,
            "no_picks": self.no_picks,
            "avg_edge_from_50": self.sum_edge / self.decisions,
        }


def poisson_under_0_5(lam: float) -> float:
    return poisson_pmf_zero(lam)


def poisson_over_0_5(lam: float) -> float:
    return 1.0 - poisson_under_0_5(lam)


def poisson_under_1_5(lam: float) -> float:
    p0 = poisson_pmf_zero(lam)
    p1 = p0 * lam
    return clamp(p0 + p1, 0.0, 1.0)


def poisson_over_1_5(lam: float) -> float:
    return 1.0 - poisson_under_1_5(lam)


def poisson_pmf_zero(lam: float) -> float:
    return 2.718281828459045 ** (-lam)


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def build_market_predictions(
    conn: sqlite3.Connection,
    league_ids: set[int] | None,
    min_history: int,
    recent_limit: int,
) -> list[MarketPrediction]:
    fixtures_all = load_fixtures(conn)
    fixtures = [f for f in fixtures_all if not league_ids or f.league_id in league_ids]
    history_index = build_team_history_index(fixtures_all, conn)

    rows: list[MarketPrediction] = []

    for fixture in fixtures:
        home_prior = slice_prior_history(history_index.get((fixture.home_id, fixture.league_id, fixture.season), []), fixture.timestamp)
        away_prior = slice_prior_history(history_index.get((fixture.away_id, fixture.league_id, fixture.season), []), fixture.timestamp)

        if len(home_prior) < min_history or len(away_prior) < min_history:
            continue

        home_input = team_input_from_history(home_prior, target_is_home=True, recent_limit=recent_limit)
        away_input = team_input_from_history(away_prior, target_is_home=False, recent_limit=recent_limit)
        params = params_for_league(fixture.league_id, fallback=DEFAULT_PARAMS)
        prediction = project(home_input, away_input, params=params)

        home_over_0_5 = poisson_over_0_5(prediction.expected_home_goals)
        home_over_1_5 = poisson_over_1_5(prediction.expected_home_goals)
        away_over_0_5 = poisson_over_0_5(prediction.expected_away_goals)
        away_over_1_5 = poisson_over_1_5(prediction.expected_away_goals)

        date_utc = datetime.fromtimestamp(fixture.timestamp / 1000, UTC).strftime("%Y-%m-%d")

        rows.extend(
            [
                MarketPrediction(
                    fixture_id=fixture.fixture_id,
                    league_id=fixture.league_id,
                    league_name=fixture.league_name,
                    season=fixture.season,
                    date_utc=date_utc,
                    market="home_over_0_5",
                    probability_yes=home_over_0_5,
                    actual_yes=fixture.home_goals >= 1,
                    confidence=prediction.confidence,
                ),
                MarketPrediction(
                    fixture_id=fixture.fixture_id,
                    league_id=fixture.league_id,
                    league_name=fixture.league_name,
                    season=fixture.season,
                    date_utc=date_utc,
                    market="home_over_1_5",
                    probability_yes=home_over_1_5,
                    actual_yes=fixture.home_goals >= 2,
                    confidence=prediction.confidence,
                ),
                MarketPrediction(
                    fixture_id=fixture.fixture_id,
                    league_id=fixture.league_id,
                    league_name=fixture.league_name,
                    season=fixture.season,
                    date_utc=date_utc,
                    market="away_over_0_5",
                    probability_yes=away_over_0_5,
                    actual_yes=fixture.away_goals >= 1,
                    confidence=prediction.confidence,
                ),
                MarketPrediction(
                    fixture_id=fixture.fixture_id,
                    league_id=fixture.league_id,
                    league_name=fixture.league_name,
                    season=fixture.season,
                    date_utc=date_utc,
                    market="away_over_1_5",
                    probability_yes=away_over_1_5,
                    actual_yes=fixture.away_goals >= 2,
                    confidence=prediction.confidence,
                ),
                MarketPrediction(
                    fixture_id=fixture.fixture_id,
                    league_id=fixture.league_id,
                    league_name=fixture.league_name,
                    season=fixture.season,
                    date_utc=date_utc,
                    market="btts",
                    probability_yes=prediction.btts_prob,
                    actual_yes=fixture.home_goals >= 1 and fixture.away_goals >= 1,
                    confidence=prediction.confidence,
                ),
            ]
        )

    return rows


def summarize(rows: list[MarketPrediction], threshold: float, min_league_samples: int) -> dict:
    by_market: dict[str, list[MarketPrediction]] = defaultdict(list)
    by_market_league: dict[tuple[str, str], list[MarketPrediction]] = defaultdict(list)
    by_market_confidence: dict[tuple[str, str], list[MarketPrediction]] = defaultdict(list)

    for row in rows:
        by_market[row.market].append(row)
        by_market_league[(row.market, row.league_name)].append(row)
        by_market_confidence[(row.market, confidence_band_label(row.confidence))].append(row)

    overall: dict[str, dict] = {}
    by_league: dict[str, dict[str, dict]] = {}
    by_confidence: dict[str, dict[str, dict]] = {}

    for market, market_rows in sorted(by_market.items()):
        metrics = BinaryMetrics()
        decisions = DecisionMetrics()
        for row in market_rows:
            metrics.add(row.probability_yes, row.actual_yes)
            decisions.add(row.probability_yes, row.actual_yes, threshold=threshold)
        overall[market] = {
            "all_fixtures": metrics.to_dict(),
            "actionable": decisions.to_dict(),
        }

        league_map: dict[str, dict] = {}
        for (mkt, league_name), league_rows in sorted(by_market_league.items()):
            if mkt != market or len(league_rows) < min_league_samples:
                continue
            lm = BinaryMetrics()
            ld = DecisionMetrics()
            for row in league_rows:
                lm.add(row.probability_yes, row.actual_yes)
                ld.add(row.probability_yes, row.actual_yes, threshold=threshold)
            league_map[league_name] = {
                "all_fixtures": lm.to_dict(),
                "actionable": ld.to_dict(),
            }
        by_league[market] = league_map

        conf_map: dict[str, dict] = {}
        for (mkt, band), band_rows in sorted(by_market_confidence.items()):
            if mkt != market:
                continue
            cm = BinaryMetrics()
            for row in band_rows:
                cm.add(row.probability_yes, row.actual_yes)
            conf_map[band] = cm.to_dict()
        by_confidence[market] = conf_map

    return {
        "threshold": threshold,
        "market_count": len(overall),
        "overall": overall,
        "by_league": by_league,
        "by_confidence": by_confidence,
    }


def confidence_band_label(value: float) -> str:
    pct = value * 100.0
    if pct < 60:
        return "50-59%"
    if pct < 70:
        return "60-69%"
    if pct < 80:
        return "70-79%"
    return "80%+"


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def format_text(summary: dict) -> str:
    lines: list[str] = []
    lines.append(f"Decision threshold: {summary['threshold']:.2f}")
    lines.append("")

    lines.append("Overall Market Ranking (actionable accuracy)")
    ranked = sorted(
        summary["overall"].items(),
        key=lambda item: (
            item[1]["actionable"]["accuracy"],
            item[1]["actionable"]["decisions"],
            -item[1]["all_fixtures"]["brier"],
        ),
        reverse=True,
    )
    for market, stats in ranked:
        all_stats = stats["all_fixtures"]
        actionable = stats["actionable"]
        lines.append(
            f"- {market}: all_n={all_stats['n']} brier={all_stats['brier']:.3f} acc={format_pct(all_stats['accuracy'])} "
            f"actual={format_pct(all_stats['actual_rate'])} avg_pred={format_pct(all_stats['avg_pred'])}"
        )
        lines.append(
            f"  actionable: decisions={actionable['decisions']} acc={format_pct(actionable['accuracy'])} "
            f"yes={actionable['yes_picks']} no={actionable['no_picks']} edge={format_pct(actionable['avg_edge_from_50'])}"
        )
    lines.append("")

    lines.append("Best League Fits (actionable accuracy, min sample filter applied)")
    for market, leagues in summary["by_league"].items():
        lines.append(f"- {market}")
        if not leagues:
            lines.append("  none")
            continue
        ranked_leagues = sorted(
            leagues.items(),
            key=lambda item: (
                item[1]["actionable"]["accuracy"],
                item[1]["actionable"]["decisions"],
                -item[1]["all_fixtures"]["brier"],
            ),
            reverse=True,
        )[:6]
        for league_name, stats in ranked_leagues:
            actionable = stats["actionable"]
            all_stats = stats["all_fixtures"]
            lines.append(
                f"  {league_name}: decisions={actionable['decisions']} acc={format_pct(actionable['accuracy'])} "
                f"brier={all_stats['brier']:.3f} avg_pred={format_pct(all_stats['avg_pred'])} actual={format_pct(all_stats['actual_rate'])}"
            )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Backtest betting-style goal markets from the local goals model")
    parser.add_argument("--db-path", default=str(default_db_path()), help="Path to sqlite database")
    parser.add_argument("--league-id", type=int, action="append", help="Optional league id filter (repeatable)")
    parser.add_argument("--min-history", type=int, default=10, help="Minimum prior finished fixtures per team")
    parser.add_argument("--recent-limit", type=int, default=5, help="Recent form window size")
    parser.add_argument("--threshold", type=float, default=0.57, help="Decision threshold for actionable yes/no picks")
    parser.add_argument("--min-league-samples", type=int, default=60, help="Minimum fixtures per league-market slice")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--out", help="Write output to file")
    args = parser.parse_args()

    db_path = Path(args.db_path).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    predictions = build_market_predictions(
        conn=conn,
        league_ids=set(args.league_id) if args.league_id else None,
        min_history=max(0, args.min_history),
        recent_limit=max(1, args.recent_limit),
    )

    summary = summarize(
        rows=predictions,
        threshold=max(0.5, min(0.8, args.threshold)),
        min_league_samples=max(20, args.min_league_samples),
    )

    payload = {
        "database": str(db_path),
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "settings": {
            "league_ids": args.league_id or [],
            "min_history": max(0, args.min_history),
            "recent_limit": max(1, args.recent_limit),
            "threshold": max(0.5, min(0.8, args.threshold)),
            "min_league_samples": max(20, args.min_league_samples),
        },
        "summary": summary,
    }

    if args.json:
        output = json.dumps(payload, indent=2)
    else:
        output = format_text(summary)

    print(output, end="" if output.endswith("\n") else "\n")

    if args.out:
        out_path = Path(args.out).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output if output.endswith("\n") else output + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
