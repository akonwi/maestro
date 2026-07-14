#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from bet_performance_report import append_summary, default_db_path, load_bets, summarize_group


CORNER_MARKET_IDS = {45, 55, 56, 57, 58, 85}


def parse_side(line_name: str) -> str:
    text = (line_name or "").strip()
    if not text:
        return "Unknown"
    first = text.split()[0].lower()
    mapping = {
        "over": "Over",
        "under": "Under",
        "home": "Home",
        "away": "Away",
        "draw": "Draw",
        "yes": "Yes",
        "no": "No",
    }
    return mapping.get(first, text)


def parse_line_value(line_name: str) -> str:
    text = (line_name or "").strip()
    if not text:
        return "No line"
    match = re.search(r"([+-]?\d+(?:\.\d+)?)", text)
    if not match:
        return "No line"
    return match.group(1)


def filtered_corner_rows(db_path: Path, prompt_version: str | None) -> list:
    rows = [row for row in load_bets(db_path) if row.market_id in CORNER_MARKET_IDS]
    if prompt_version:
        rows = [row for row in rows if row.prompt_version == prompt_version]
    return rows


def summarize_groups(rows: list, key_fn, min_bets: int = 1) -> dict[str, dict]:
    grouped: dict[str, list] = defaultdict(list)
    for row in rows:
        grouped[key_fn(row)].append(row)

    ordered = sorted(grouped.items(), key=lambda item: (-len(item[1]), item[0]))
    return {
        key: summarize_group(group_rows)
        for key, group_rows in ordered
        if len(group_rows) >= min_bets
    }


def report_payload(rows: list, min_group_bets: int) -> dict:
    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "overall": summarize_group(rows),
        "prompt_versions": summarize_groups(rows, lambda row: row.prompt_version),
        "markets": summarize_groups(rows, lambda row: row.market),
        "sides": summarize_groups(rows, lambda row: parse_side(row.line_name)),
        "line_values": summarize_groups(rows, lambda row: parse_line_value(row.line_name), min_bets=min_group_bets),
        "selections": summarize_groups(rows, lambda row: row.line_name or "Unknown", min_bets=min_group_bets),
        "market_selections": summarize_groups(
            rows,
            lambda row: f"{row.market} | {row.line_name or 'Unknown'}",
            min_bets=min_group_bets,
        ),
        "leagues": summarize_groups(rows, lambda row: row.league_name or "Unknown League", min_bets=min_group_bets),
    }


def format_text(db_path: Path, payload: dict, min_group_bets: int, prompt_version: str | None) -> str:
    lines: list[str] = []
    lines.append(f"Database: {db_path}")
    lines.append(f"Generated (UTC): {payload['generated_at_utc']}")
    lines.append(f"Corner bets analyzed: {payload['overall']['total']}")
    if prompt_version:
        lines.append(f"Prompt filter: {prompt_version}")
    lines.append("")

    append_summary(lines, "Overall", payload["overall"])
    lines.append("")

    lines.append("By Market")
    for key, summary in payload["markets"].items():
        append_summary(lines, f"- {key}", summary)
    lines.append("")

    lines.append("By Side")
    for key, summary in payload["sides"].items():
        append_summary(lines, f"- {key}", summary)
    lines.append("")

    lines.append(f"By Line Value (min {min_group_bets} bets)")
    if not payload["line_values"]:
        lines.append("- none")
    else:
        for key, summary in payload["line_values"].items():
            append_summary(lines, f"- {key}", summary)
    lines.append("")

    lines.append(f"By Selection (min {min_group_bets} bets)")
    if not payload["selections"]:
        lines.append("- none")
    else:
        for key, summary in payload["selections"].items():
            append_summary(lines, f"- {key}", summary)
    lines.append("")

    lines.append(f"By Market + Selection (min {min_group_bets} bets)")
    if not payload["market_selections"]:
        lines.append("- none")
    else:
        for key, summary in payload["market_selections"].items():
            append_summary(lines, f"- {key}", summary)
    lines.append("")

    lines.append(f"By League (min {min_group_bets} bets)")
    if not payload["leagues"]:
        lines.append("- none")
    else:
        for key, summary in payload["leagues"].items():
            append_summary(lines, f"- {key}", summary)

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a corner-only betting performance report")
    parser.add_argument("--db-path", default=str(default_db_path()), help="Path to sqlite database")
    parser.add_argument("--prompt-version", help="Optional prompt version filter (e.g. corner-local-v1.0)")
    parser.add_argument("--min-group-bets", type=int, default=2, help="Minimum bets required for line/selection/league breakdowns")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--out", help="Write output to file")
    args = parser.parse_args()

    db_path = Path(args.db_path).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")

    rows = filtered_corner_rows(db_path, args.prompt_version)
    if not rows:
        raise SystemExit("No corner bets found for the selected filters.")

    payload = {
        "database": str(db_path),
        "settings": {
            "prompt_version": args.prompt_version,
            "min_group_bets": max(1, args.min_group_bets),
            "corner_market_ids": sorted(CORNER_MARKET_IDS),
        },
        **report_payload(rows, min_group_bets=max(1, args.min_group_bets)),
    }

    if args.json:
        output = json.dumps(payload, indent=2)
    else:
        output = format_text(
            db_path=db_path,
            payload=payload,
            min_group_bets=max(1, args.min_group_bets),
            prompt_version=args.prompt_version,
        )

    print(output, end="" if output.endswith("\n") else "\n")

    if args.out:
        out_path = Path(args.out).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output if output.endswith("\n") else output + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
