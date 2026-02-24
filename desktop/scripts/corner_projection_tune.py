#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import asdict
from datetime import UTC, datetime
from itertools import product
from pathlib import Path

from corner_projection_backtest import build_team_history_index, default_db_path, evaluate, load_fixtures
from local_corner_model import DEFAULT_PARAMS, MODEL_VERSION, ModelParams


def generate_candidates() -> list[ModelParams]:
    candidates: list[ModelParams] = []

    attack_weights = [0.5, 0.55, 0.6, 0.65]
    venue_weights = [0.2, 0.4, 0.6]
    recent_weights = [0.12, 0.18, 0.22, 0.28]
    shots_weights = [0.0, 0.3, 0.5]
    shot_quality_weights = [0.0, 0.2, 0.4]
    tempo_quality_weights = [0.0, 0.15, 0.3]
    xg_weights = [0.0, 0.2, 0.4]

    for attack_weight, venue_weight, recent_weight, shots_weight, shot_quality_weight, tempo_quality_weight, xg_weight in product(
        attack_weights,
        venue_weights,
        recent_weights,
        shots_weights,
        shot_quality_weights,
        tempo_quality_weights,
        xg_weights,
    ):
        if shots_weight + shot_quality_weight + tempo_quality_weight + xg_weight > 1.0:
            continue
        defense_weight = round(1.0 - attack_weight, 2)
        possession_weight = round(1.0 - shots_weight - shot_quality_weight - tempo_quality_weight - xg_weight, 2)
        candidates.append(
            ModelParams(
                attack_weight=attack_weight,
                defense_weight=defense_weight,
                venue_weight=venue_weight,
                recent_weight=recent_weight,
                pace_weight_shots=shots_weight,
                pace_weight_shot_quality=shot_quality_weight,
                pace_weight_tempo_quality=tempo_quality_weight,
                pace_weight_xg=xg_weight,
                pace_weight_possession=possession_weight,
            )
        )

    return candidates


def evaluate_candidate(
    params: ModelParams,
    fixtures,
    history_index,
    min_history: int,
    recent_limit: int,
    league_ids: set[int] | None,
) -> dict:
    _, summary = evaluate(
        fixtures=fixtures,
        history_index=history_index,
        min_history_per_team=min_history,
        recent_limit=recent_limit,
        model_params=params,
        league_id_filter=league_ids,
        use_league_specific_models=False,
    )

    acc = summary["accuracy"]
    total_mae = float(acc["total"]["mae"])
    total_rmse = float(acc["total"]["rmse"])
    total_bias = float(acc["total"]["bias"])

    score = total_mae + (0.1 * abs(total_bias))

    return {
        "params": asdict(params),
        "coverage": summary["coverage"],
        "total_mae": total_mae,
        "total_rmse": total_rmse,
        "total_bias": total_bias,
        "home_mae": float(acc["home"]["mae"]),
        "away_mae": float(acc["away"]["mae"]),
        "score": score,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Grid-search tuning for local corner projection weights")
    parser.add_argument("--db-path", default=str(default_db_path()), help="Path to sqlite database")
    parser.add_argument("--min-history", type=int, default=10, help="Minimum prior fixtures per team")
    parser.add_argument("--recent-limit", type=int, default=5, help="Recent form window size")
    parser.add_argument("--top", type=int, default=10, help="How many top candidates to print")
    parser.add_argument("--out", help="Write full tuning result JSON to file")
    parser.add_argument("--league-id", type=int, action="append", help="Optional league id filter for tuning")
    args = parser.parse_args()

    db_path = Path(args.db_path).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    fixtures = load_fixtures(conn)
    history_index = build_team_history_index(fixtures, conn)

    min_history = max(0, args.min_history)
    recent_limit = max(1, args.recent_limit)

    league_ids = set(args.league_id) if args.league_id else None

    baseline = evaluate_candidate(DEFAULT_PARAMS, fixtures, history_index, min_history, recent_limit, league_ids)

    candidates = generate_candidates()
    results = [
        evaluate_candidate(candidate, fixtures, history_index, min_history, recent_limit, league_ids)
        for candidate in candidates
    ]

    results_sorted = sorted(results, key=lambda item: (item["score"], item["total_mae"], abs(item["total_bias"])))
    top_n = max(1, args.top)
    top_results = results_sorted[:top_n]

    print(f"Database: {db_path}")
    print(f"Model family: {MODEL_VERSION}")
    if league_ids:
        print(f"League filter: {sorted(league_ids)}")
    print(f"Candidates tested: {len(results)}")
    print(
        "Baseline total MAE={:.3f} RMSE={:.3f} bias={:.3f}".format(
            baseline["total_mae"], baseline["total_rmse"], baseline["total_bias"]
        )
    )
    print("")
    print(f"Top {top_n} candidates by total-corners score")
    for idx, row in enumerate(top_results, start=1):
        params = row["params"]
        print(
            "{idx}. mae={mae:.3f} rmse={rmse:.3f} bias={bias:.3f} home_mae={h:.3f} away_mae={a:.3f} | "
            "atk={atk:.2f} def={df:.2f} venue={vw:.2f} recent={recent:.2f} "
            "pace_shots={ps:.2f} pace_quality={pq:.2f} pace_tempo={pt:.2f} pace_xg={px:.2f} pace_poss={pp:.2f}".format(
                idx=idx,
                mae=row["total_mae"],
                rmse=row["total_rmse"],
                bias=row["total_bias"],
                h=row["home_mae"],
                a=row["away_mae"],
                atk=params["attack_weight"],
                df=params["defense_weight"],
                vw=params["venue_weight"],
                recent=params["recent_weight"],
                ps=params["pace_weight_shots"],
                pq=params["pace_weight_shot_quality"],
                pt=params["pace_weight_tempo_quality"],
                px=params["pace_weight_xg"],
                pp=params["pace_weight_possession"],
            )
        )

    payload = {
        "database": str(db_path),
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "model_version": MODEL_VERSION,
        "settings": {
            "min_history": min_history,
            "recent_limit": recent_limit,
            "league_ids": sorted(league_ids) if league_ids else [],
            "candidate_count": len(results),
        },
        "baseline": baseline,
        "top_results": top_results,
        "all_results": results_sorted,
    }

    if args.out:
        out_path = Path(args.out).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
