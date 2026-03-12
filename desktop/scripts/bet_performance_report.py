#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


MARKET_NAMES = {
    45: "Total Corners",
    55: "Most Corners",
    56: "Asian Corners",
    57: "Home Corners",
    58: "Away Corners",
    85: "Total Corners (3-Way)",
}


@dataclass
class BetRow:
    id: int
    fixture_id: int
    market_id: int
    market: str
    line_name: str
    odds: int
    stake: float
    result: str
    created_at: int
    created_at_iso: str
    league_name: str | None
    prompt_version: str
    confidence_pct: float | None
    ev_pct: float | None
    implied_prob: float
    est_prob: float | None
    edge_pp: float | None
    profit: float | None


def parse_pct_value(pattern: str, text: str) -> float | None:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def implied_probability(odds: int) -> float:
    if odds > 0:
        return 100.0 / (odds + 100.0)
    return abs(odds) / (abs(odds) + 100.0)


def bet_profit(stake: float, odds: int, result: str) -> float | None:
    if result == "won":
        if odds > 0:
            return stake * (odds / 100.0)
        return stake * (100.0 / abs(odds))
    if result == "lost":
        return -stake
    if result == "push":
        return 0.0
    return None


def summarize_group(rows: list[BetRow]) -> dict:
    wl = [r for r in rows if r.result in ("won", "lost")]
    wins = sum(1 for r in wl if r.result == "won")
    losses = sum(1 for r in wl if r.result == "lost")
    staked = sum(r.stake for r in wl)
    profit = sum((r.profit or 0.0) for r in wl)
    win_rate = wins / len(wl) if wl else 0.0
    roi = profit / staked if staked > 0 else 0.0
    implied = sum(r.implied_prob * r.stake for r in wl) / staked if staked > 0 else 0.0
    return {
        "total": len(rows),
        "resolved_wl": len(wl),
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "total_staked": staked,
        "net_profit": profit,
        "roi": roi,
        "implied_break_even": implied,
        "edge_gap": win_rate - implied,
    }


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def append_summary(lines: list[str], title: str, summary: dict) -> None:
    lines.append(title)
    lines.append(
        "  bets={total} wl={resolved_wl} wins={wins} losses={losses} win_rate={win_rate} roi={roi}".format(
            total=summary["total"],
            resolved_wl=summary["resolved_wl"],
            wins=summary["wins"],
            losses=summary["losses"],
            win_rate=format_pct(summary["win_rate"]),
            roi=format_pct(summary["roi"]),
        )
    )
    lines.append(
        "  staked=${:.2f} net=${:.2f} implied_break_even={} gap={}".format(
            summary["total_staked"],
            summary["net_profit"],
            format_pct(summary["implied_break_even"]),
            format_pct(summary["edge_gap"]),
        )
    )


def load_bets(db_path: Path) -> list[BetRow]:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT b.id, b.fixture_id, b.market_id, b.line_name, b.odds, b.stake, b.result, b.notes, b.created_at,
               l.name AS league_name
        FROM bets b
        LEFT JOIN fixtures f ON f.id = b.fixture_id
        LEFT JOIN leagues l ON l.id = f.league_id
        ORDER BY b.created_at ASC;
        """
    ).fetchall()

    output: list[BetRow] = []
    for row in rows:
        notes = row["notes"] or ""
        prompt_version = "legacy-v1"
        prompt_match = re.search(r"Prompt:\s*([^\n]+)", notes, flags=re.IGNORECASE)
        if prompt_match:
            prompt_version = prompt_match.group(1).strip()

        confidence = parse_pct_value(r"Confidence:\s*([+-]?\d+(?:\.\d+)?)\s*%", notes)
        ev_pct = parse_pct_value(r"EV:\s*([+-]?\d+(?:\.\d+)?)\s*%", notes)
        implied = parse_pct_value(r"Implied Prob:\s*([+-]?\d+(?:\.\d+)?)\s*%", notes)
        estimated = parse_pct_value(r"Estimated Prob:\s*([+-]?\d+(?:\.\d+)?)\s*%", notes)
        edge_pp = parse_pct_value(r"Edge \(pp\):\s*([+-]?\d+(?:\.\d+)?)", notes)

        implied_prob = implied_probability(int(row["odds"]))
        if implied is not None:
            implied_prob = implied / 100.0

        output.append(
            BetRow(
                id=int(row["id"]),
                fixture_id=int(row["fixture_id"]),
                market_id=int(row["market_id"]),
                market=MARKET_NAMES.get(int(row["market_id"]), f"Unknown({int(row['market_id'])})"),
                line_name=(row["line_name"] or "").strip(),
                odds=int(row["odds"]),
                stake=float(row["stake"]),
                result=str(row["result"]),
                created_at=int(row["created_at"]),
                created_at_iso=datetime.fromtimestamp(int(row["created_at"]) / 1000, timezone.utc).strftime("%Y-%m-%d"),
                league_name=row["league_name"],
                prompt_version=prompt_version,
                confidence_pct=confidence,
                ev_pct=ev_pct,
                implied_prob=implied_prob,
                est_prob=(estimated / 100.0) if estimated is not None else None,
                edge_pp=edge_pp,
                profit=bet_profit(float(row["stake"]), int(row["odds"]), str(row["result"])),
            )
        )

    return output


def run_report(db_path: Path, output_json: bool, out_path: Path | None) -> None:
    rows = load_bets(db_path)
    if not rows:
        print("No bets found.")
        return

    summary = summarize_group(rows)

    by_prompt: dict[str, list[BetRow]] = defaultdict(list)
    by_market: dict[str, list[BetRow]] = defaultdict(list)
    by_league: dict[str, list[BetRow]] = defaultdict(list)
    by_conf_band: dict[str, list[BetRow]] = defaultdict(list)

    for row in rows:
        by_prompt[row.prompt_version].append(row)
        by_market[row.market].append(row)
        by_league[row.league_name or "Unknown League"].append(row)
        if row.confidence_pct is not None:
            if row.confidence_pct < 70:
                by_conf_band["<70%"].append(row)
            elif row.confidence_pct < 80:
                by_conf_band["70-79%"].append(row)
            elif row.confidence_pct < 85:
                by_conf_band["80-84%"].append(row)
            else:
                by_conf_band["85%+"].append(row)

    recent = rows[-10:]
    previous = rows[-20:-10] if len(rows) >= 20 else []

    report = {
        "database": str(db_path),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "overall": summary,
        "prompt_versions": {k: summarize_group(v) for k, v in sorted(by_prompt.items())},
        "markets": {k: summarize_group(v) for k, v in sorted(by_market.items())},
        "leagues": {k: summarize_group(v) for k, v in sorted(by_league.items()) if len(v) >= 2},
        "confidence_bands": {k: summarize_group(v) for k, v in sorted(by_conf_band.items())},
        "window_previous_10": summarize_group(previous) if previous else None,
        "window_recent_10": summarize_group(recent),
    }

    if output_json:
        json_output = json.dumps(report, indent=2)
        print(json_output)
        if out_path is not None:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json_output + "\n", encoding="utf-8")
        return

    lines: list[str] = []
    lines.append(f"Database: {db_path}")
    lines.append(f"Generated (UTC): {report['generated_at_utc']}")
    append_summary(lines, "Overall", summary)
    lines.append("")

    lines.append("By Prompt Version")
    for version in sorted(by_prompt):
        append_summary(lines, f"- {version}", summarize_group(by_prompt[version]))
    lines.append("")

    lines.append("By Market")
    for market in sorted(by_market):
        append_summary(lines, f"- {market}", summarize_group(by_market[market]))
    lines.append("")

    if by_conf_band:
        lines.append("By Confidence Band")
        for band in sorted(by_conf_band):
            append_summary(lines, f"- {band}", summarize_group(by_conf_band[band]))
        lines.append("")

    lines.append("By League (min 2 bets)")
    for league, league_rows in sorted(by_league.items(), key=lambda item: len(item[1]), reverse=True):
        if len(league_rows) < 2:
            continue
        append_summary(lines, f"- {league}", summarize_group(league_rows))
    lines.append("")

    if previous:
        append_summary(lines, "Previous 10 Bets", summarize_group(previous))
    append_summary(lines, "Recent 10 Bets", summarize_group(recent))

    output_text = "\n".join(lines) + "\n"
    print(output_text, end="")
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output_text, encoding="utf-8")


def default_db_path() -> Path:
    return Path.home() / "Library" / "Application Support" / "com.akonwi.maestro" / "maestro.sqlite"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate betting performance report from Maestro SQLite database")
    parser.add_argument("--db-path", default=str(default_db_path()), help="Path to sqlite database")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument(
        "--out",
        help="Write output to file. Writes JSON when --json is set, otherwise plain text.",
    )
    args = parser.parse_args()

    db_path = Path(args.db_path).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")

    out_path = Path(args.out).expanduser().resolve() if args.out else None

    run_report(db_path, output_json=args.json, out_path=out_path)


if __name__ == "__main__":
    main()
